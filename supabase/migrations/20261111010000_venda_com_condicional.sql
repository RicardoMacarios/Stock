-- Venda do balcão que acerta junto o condicional em aberto do cliente.
-- No caixa, ao escolher um cliente com condicional aberto, a tela pergunta
-- se cobra junto ou só as peças de hoje. "Junto" = um pedido só: peças de
-- hoje (saem do estoque agora) + peças do condicional (já saíram na época),
-- mesma forma de pagamento, e o condicional fecha.
--
-- p_condicional_itens: [{ item_id, quantidade, preco_unitario? }]. O mesmo
-- item pode vir em mais de uma linha (o desconto às vezes divide uma linha
-- em duas para fechar o centavo); cada linha vira uma linha de `vendas`.
-- O que não vier (ou vier a menos) é devolvido e volta ao estoque, como no
-- acerto do condicional.
-- As peças do condicional ficam com o vendedor do condicional (quem fez
-- aquela venda), igual ao acerto; as de hoje, com o vendedor escolhido.

drop function if exists public.registrar_pedido(jsonb, uuid, uuid, text);

create function public.registrar_pedido(
  p_itens jsonb,
  p_vendedor_id uuid default null,
  p_cliente_loja_id uuid default null,
  p_forma_pagamento text default null,
  p_condicional_id uuid default null,
  p_condicional_itens jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_pedido uuid := gen_random_uuid();
  v_item   jsonb;
  v_venda  public.vendas%rowtype;
  v_pessoa public.clientes_loja%rowtype;
  v_cond   public.condicionais%rowtype;
  v_ci     public.condicional_itens%rowtype;
  v_qtd    numeric;
  v_preco  numeric;
  v_soma   numeric;
begin
  p_itens := coalesce(p_itens, '[]'::jsonb);
  p_condicional_itens := coalesce(p_condicional_itens, '[]'::jsonb);
  if jsonb_typeof(p_itens) <> 'array' or jsonb_typeof(p_condicional_itens) <> 'array' then
    raise exception 'carrinho_vazio' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_itens) = 0 and (p_condicional_id is null or jsonb_array_length(p_condicional_itens) = 0) then
    raise exception 'carrinho_vazio' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_itens) > 100 or jsonb_array_length(p_condicional_itens) > 200 then
    raise exception 'carrinho_grande_demais' using errcode = 'P0001';
  end if;
  if p_forma_pagamento is not null and p_forma_pagamento not in ('pix', 'credito', 'debito', 'dinheiro') then
    raise exception 'forma_pagamento_invalida' using errcode = 'P0001';
  end if;
  if p_cliente_loja_id is not null then
    select * into v_pessoa from clientes_loja c where c.id = p_cliente_loja_id;
    if not found or not public.eh_membro(v_pessoa.cliente_id) then
      raise exception 'cliente_loja_nao_encontrado' using errcode = 'P0001';
    end if;
  end if;

  -- O condicional tem de ser do cliente escolhido e estar aberto.
  if p_condicional_id is not null then
    select * into v_cond from condicionais c where c.id = p_condicional_id for update;
    if not found or v_pessoa.id is null or v_cond.cliente_loja_id <> v_pessoa.id
       or not public.eh_membro(v_cond.cliente_id) then
      raise exception 'condicional_nao_encontrado' using errcode = 'P0001';
    end if;
    if v_cond.situacao <> 'aberto' then
      raise exception 'condicional_ja_fechado' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_condicional_itens) c
       where not exists (select 1 from condicional_itens i
                          where i.condicional_id = v_cond.id and i.id = (c ->> 'item_id')::uuid)
    ) then
      raise exception 'condicional_nao_encontrado' using errcode = 'P0001';
    end if;
  end if;

  -- Peças de hoje.
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_venda := public.registrar_venda(
      (v_item ->> 'produto_id')::uuid,
      (v_item ->> 'quantidade')::numeric,
      (v_item ->> 'preco_unitario')::numeric,
      p_vendedor_id
    );
    -- Cliente de outra loja não pode entrar na venda desta.
    if v_pessoa.id is not null and v_pessoa.cliente_id <> v_venda.cliente_id then
      raise exception 'cliente_loja_nao_encontrado' using errcode = 'P0001';
    end if;
    update vendas
       set pedido_id = v_pedido, cliente_loja_id = v_pessoa.id, forma_pagamento = p_forma_pagamento
     where id = v_venda.id;
  end loop;

  -- Peças do condicional: compradas agora; o resto volta ao estoque.
  if v_cond.id is not null then
    for v_ci in select * from condicional_itens i where i.condicional_id = v_cond.id for update loop
      v_soma := 0;
      for v_item in select * from jsonb_array_elements(p_condicional_itens) c
                     where (c ->> 'item_id')::uuid = v_ci.id loop
        v_qtd := (v_item ->> 'quantidade')::numeric;
        v_preco := coalesce((v_item ->> 'preco_unitario')::numeric, v_ci.preco_unitario);
        if v_qtd is null or v_qtd <= 0 then
          raise exception 'quantidade_invalida' using errcode = 'P0001', detail = v_ci.produto_nome;
        end if;
        if v_preco < 0 then
          raise exception 'preco_invalido' using errcode = 'P0001', detail = v_ci.produto_nome;
        end if;
        v_soma := v_soma + v_qtd;
        insert into vendas (cliente_id, produto_id, produto_nome, vendedor_id, vendedor_nome, quantidade,
                            preco_unitario, custo_unitario, pedido_id, cliente_loja_id, forma_pagamento)
        values (v_cond.cliente_id, v_ci.produto_id, v_ci.produto_nome, v_cond.vendedor_id, v_cond.vendedor_nome,
                v_qtd, v_preco, v_ci.custo_unitario, v_pedido, v_cond.cliente_loja_id, p_forma_pagamento);
      end loop;
      if v_soma > v_ci.quantidade then
        raise exception 'quantidade_invalida' using errcode = 'P0001', detail = v_ci.produto_nome;
      end if;

      update condicional_itens set comprado = v_soma, devolvido = quantidade - v_soma where id = v_ci.id;
      if v_ci.quantidade - v_soma > 0 and v_ci.produto_id is not null then
        update produtos set quantidade = quantidade + (v_ci.quantidade - v_soma) where id = v_ci.produto_id;
      end if;
    end loop;

    update condicionais
       set situacao = 'fechado', fechado_em = now(), pedido_id = v_pedido
     where id = v_cond.id;
  end if;

  return v_pedido;
end
$fn$;

revoke execute on function public.registrar_pedido(jsonb, uuid, uuid, text, uuid, jsonb) from public, anon;
grant  execute on function public.registrar_pedido(jsonb, uuid, uuid, text, uuid, jsonb) to authenticated;
