-- Acerto do condicional mais flexível:
--   p_compras: [{ item_id, quantidade, preco_unitario? }] — preço opcional
--              muda o valor da venda (desconto); sem ele, vale o da saída.
--   p_extras:  [{ produto_id, quantidade, preco_unitario? }] — peças que o
--              cliente resolveu levar na hora do acerto; saem do estoque agora.
-- Tudo vira um pedido só, com o vendedor e o cliente do condicional.

drop function if exists public.fechar_condicional(uuid, jsonb);

create function public.fechar_condicional(
  p_condicional_id uuid,
  p_compras jsonb default '[]'::jsonb,
  p_extras jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_cond     public.condicionais%rowtype;
  v_item     public.condicional_itens%rowtype;
  v_produto  public.produtos%rowtype;
  v_extra    jsonb;
  v_comprado numeric;
  v_preco    numeric;
  v_qtd      numeric;
  v_pedido   uuid := gen_random_uuid();
  v_vendeu   boolean := false;
begin
  select * into v_cond from condicionais c where c.id = p_condicional_id for update;
  if not found or not public.eh_membro(v_cond.cliente_id) then
    raise exception 'condicional_nao_encontrado' using errcode = 'P0001';
  end if;
  if v_cond.situacao <> 'aberto' then
    raise exception 'condicional_ja_fechado' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_extras, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_extras, '[]'::jsonb)) > 100 then
    raise exception 'carrinho_grande_demais' using errcode = 'P0001';
  end if;

  -- Peças que ele levou: compra ou devolve.
  for v_item in select * from condicional_itens i where i.condicional_id = v_cond.id for update loop
    select coalesce(sum((c ->> 'quantidade')::numeric), 0), max((c ->> 'preco_unitario')::numeric)
      into v_comprado, v_preco
      from jsonb_array_elements(coalesce(p_compras, '[]'::jsonb)) c
     where (c ->> 'item_id')::uuid = v_item.id;
    if v_comprado < 0 or v_comprado > v_item.quantidade then
      raise exception 'quantidade_invalida' using errcode = 'P0001', detail = v_item.produto_nome;
    end if;
    v_preco := coalesce(v_preco, v_item.preco_unitario);
    if v_preco < 0 then
      raise exception 'preco_invalido' using errcode = 'P0001', detail = v_item.produto_nome;
    end if;

    update condicional_itens set comprado = v_comprado, devolvido = quantidade - v_comprado where id = v_item.id;

    if v_item.quantidade - v_comprado > 0 and v_item.produto_id is not null then
      update produtos set quantidade = quantidade + (v_item.quantidade - v_comprado) where id = v_item.produto_id;
    end if;

    if v_comprado > 0 then
      insert into vendas (cliente_id, produto_id, produto_nome, vendedor_id, vendedor_nome, quantidade,
                          preco_unitario, custo_unitario, pedido_id, cliente_loja_id)
      values (v_cond.cliente_id, v_item.produto_id, v_item.produto_nome, v_cond.vendedor_id, v_cond.vendedor_nome,
              v_comprado, v_preco, v_item.custo_unitario, v_pedido, v_cond.cliente_loja_id);
      v_vendeu := true;
    end if;
  end loop;

  -- Peças a mais, escolhidas no acerto: saem do estoque agora.
  for v_extra in select * from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) loop
    select * into v_produto from produtos p where p.id = (v_extra ->> 'produto_id')::uuid for update;
    if not found or v_produto.cliente_id <> v_cond.cliente_id then
      raise exception 'produto_nao_encontrado' using errcode = 'P0001';
    end if;
    v_qtd := (v_extra ->> 'quantidade')::numeric;
    if v_qtd is null or v_qtd <= 0 then
      raise exception 'quantidade_invalida' using errcode = 'P0001', detail = v_produto.nome;
    end if;
    if v_qtd > v_produto.quantidade then
      raise exception 'estoque_insuficiente' using errcode = 'P0001', detail = v_produto.nome;
    end if;
    v_preco := coalesce((v_extra ->> 'preco_unitario')::numeric, v_produto.preco_venda);
    if v_preco is null or v_preco < 0 then
      raise exception 'preco_invalido' using errcode = 'P0001', detail = v_produto.nome;
    end if;

    update produtos set quantidade = quantidade - v_qtd where id = v_produto.id;
    insert into vendas (cliente_id, produto_id, produto_nome, vendedor_id, vendedor_nome, quantidade,
                        preco_unitario, custo_unitario, pedido_id, cliente_loja_id)
    values (v_cond.cliente_id, v_produto.id, v_produto.nome, v_cond.vendedor_id, v_cond.vendedor_nome,
            v_qtd, v_preco, v_produto.preco_custo, v_pedido, v_cond.cliente_loja_id);
    v_vendeu := true;
  end loop;

  update condicionais
     set situacao = 'fechado', fechado_em = now(), pedido_id = case when v_vendeu then v_pedido end
   where id = v_cond.id;

  return case when v_vendeu then v_pedido end;
end
$fn$;

revoke execute on function public.fechar_condicional(uuid, jsonb, jsonb) from public, anon;
grant  execute on function public.fechar_condicional(uuid, jsonb, jsonb) to authenticated;
