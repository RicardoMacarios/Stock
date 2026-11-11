-- Editar uma venda (pedido) já registrada, de qualquer dia.
--
--   Sempre:  vendedor e forma de pagamento.
--   Peças:   quantidade e preço de cada linha; quantidade 0 tira a peça.
--            O estoque acompanha a diferença (vendeu 1 a mais = baixa 1;
--            tirou a peça = volta ao estoque), como no desfazer_venda.
--
-- Venda com valor em aberto (contas_receber) NÃO deixa mexer nas peças: o
-- total, o aberto e o lucro_aberto da conta dependem delas. Nesse caso,
-- desfazer e lançar de novo. Data e cliente da venda não mudam aqui.
--
-- p_itens: [{ "venda_id": uuid, "quantidade": n, "preco_unitario": n }].
-- Linha que não vier na lista fica como está.

create or replace function public.editar_pedido(
  p_pedido_id uuid,
  p_vendedor_id uuid default null,
  p_forma_pagamento text default null,
  p_itens jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_cliente   uuid;
  v_atual     uuid; -- vendedor de hoje do pedido
  v_vendedor  public.vendedores%rowtype;
  v_venda     public.vendas%rowtype;
  v_item      jsonb;
  v_qtd       numeric;
  v_preco     numeric;
  v_diferenca numeric;
  v_estoque   numeric;
  v_mexeu     boolean := false;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  -- Trava as linhas do pedido: duas edições ao mesmo tempo não se atropelam.
  perform 1 from vendas v where v.pedido_id = p_pedido_id for update;
  select v.cliente_id, v.vendedor_id into v_cliente, v_atual
    from vendas v where v.pedido_id = p_pedido_id limit 1;
  if v_cliente is null or not public.eh_membro(v_cliente) then
    raise exception 'venda_nao_encontrada' using errcode = 'P0001';
  end if;

  if p_forma_pagamento is not null and p_forma_pagamento not in ('pix', 'credito', 'debito', 'dinheiro') then
    raise exception 'forma_pagamento_invalida' using errcode = 'P0001';
  end if;

  -- Vendedor: um ativo da loja, ou o mesmo que já estava (pode ter sido
  -- desativado depois da venda). Sem vendedor só se a loja não tem ativos.
  if p_vendedor_id is not null then
    select * into v_vendedor from vendedores v
     where v.id = p_vendedor_id and v.cliente_id = v_cliente
       and (v.ativo or v.id is not distinct from v_atual);
    if not found then
      raise exception 'vendedor_invalido' using errcode = 'P0001';
    end if;
  elsif exists (select 1 from vendedores v where v.cliente_id = v_cliente and v.ativo) then
    raise exception 'vendedor_obrigatorio' using errcode = 'P0001';
  end if;

  p_itens := coalesce(p_itens, '[]'::jsonb);
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) > 200 then
    raise exception 'carrinho_vazio' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    select * into v_venda from vendas v
     where v.id = (v_item ->> 'venda_id')::uuid and v.pedido_id = p_pedido_id;
    if not found then
      raise exception 'venda_nao_encontrada' using errcode = 'P0001';
    end if;

    v_qtd := coalesce((v_item ->> 'quantidade')::numeric, v_venda.quantidade);
    v_preco := coalesce((v_item ->> 'preco_unitario')::numeric, v_venda.preco_unitario);
    if v_qtd < 0 then
      raise exception 'quantidade_invalida' using errcode = 'P0001', detail = v_venda.produto_nome;
    end if;
    if v_preco < 0 then
      raise exception 'preco_invalido' using errcode = 'P0001', detail = v_venda.produto_nome;
    end if;
    if v_qtd = v_venda.quantidade and v_preco = v_venda.preco_unitario then
      continue;
    end if;
    v_mexeu := true;

    -- Estoque: só a diferença. Produto apagado depois da venda: não há o que ajustar.
    v_diferenca := v_qtd - v_venda.quantidade;
    if v_diferenca <> 0 and v_venda.produto_id is not null then
      select p.quantidade into v_estoque from produtos p where p.id = v_venda.produto_id for update;
      if found then
        if v_diferenca > v_estoque then
          raise exception 'estoque_insuficiente' using errcode = 'P0001', detail = v_venda.produto_nome;
        end if;
        update produtos set quantidade = quantidade - v_diferenca where id = v_venda.produto_id;
      end if;
    end if;

    if v_qtd = 0 then
      delete from vendas where id = v_venda.id;
    else
      update vendas set quantidade = v_qtd, preco_unitario = v_preco where id = v_venda.id;
    end if;
  end loop;

  if v_mexeu then
    if exists (select 1 from contas_receber c where c.pedido_id = p_pedido_id) then
      raise exception 'venda_com_valor_em_aberto' using errcode = 'P0001';
    end if;
    -- Tirar todas as peças = desfazer a venda; isso tem botão próprio.
    if not exists (select 1 from vendas v where v.pedido_id = p_pedido_id) then
      raise exception 'venda_sem_pecas' using errcode = 'P0001';
    end if;
  end if;

  update vendas
     set vendedor_id = v_vendedor.id, vendedor_nome = v_vendedor.nome, forma_pagamento = p_forma_pagamento
   where pedido_id = p_pedido_id;
  update contas_receber
     set vendedor_id = v_vendedor.id, vendedor_nome = v_vendedor.nome
   where pedido_id = p_pedido_id;
end
$fn$;

revoke execute on function public.editar_pedido(uuid, uuid, text, jsonb) from public, anon;
grant  execute on function public.editar_pedido(uuid, uuid, text, jsonb) to authenticated;
