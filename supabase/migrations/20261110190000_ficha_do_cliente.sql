-- Ficha do cliente da loja: a venda passa a saber (opcionalmente) QUEM
-- comprou. Compras do balcão com cliente escolhido e compras que saíram de
-- um condicional somam no "quanto já gastou" e nas peças compradas.

alter table public.vendas
  add column cliente_loja_id uuid references public.clientes_loja(id) on delete set null;
create index vendas_cliente_loja_idx on public.vendas(cliente_loja_id) where cliente_loja_id is not null;

-- Compras que já saíram de condicionais fechados ganham o cliente.
update public.vendas v
   set cliente_loja_id = c.cliente_loja_id
  from public.condicionais c
 where c.pedido_id is not null and v.pedido_id = c.pedido_id and v.cliente_loja_id is null;

-- ===== Venda do balcão com cliente (opcional) =====
-- Assinatura muda (novo parâmetro): sai a antiga para o PostgREST não ficar
-- com duas versões ambíguas.
drop function if exists public.registrar_pedido(jsonb, uuid);

create function public.registrar_pedido(
  p_itens jsonb,
  p_vendedor_id uuid default null,
  p_cliente_loja_id uuid default null
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
begin
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'carrinho_vazio' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_itens) > 100 then
    raise exception 'carrinho_grande_demais' using errcode = 'P0001';
  end if;
  if p_cliente_loja_id is not null then
    select * into v_pessoa from clientes_loja c where c.id = p_cliente_loja_id;
    if not found or not public.eh_membro(v_pessoa.cliente_id) then
      raise exception 'cliente_loja_nao_encontrado' using errcode = 'P0001';
    end if;
  end if;

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
    update vendas set pedido_id = v_pedido, cliente_loja_id = v_pessoa.id where id = v_venda.id;
  end loop;

  return v_pedido;
end
$fn$;

-- ===== Acerto do condicional grava o cliente na venda =====
create or replace function public.fechar_condicional(p_condicional_id uuid, p_compras jsonb default '[]'::jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_cond     public.condicionais%rowtype;
  v_item     public.condicional_itens%rowtype;
  v_comprado numeric;
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

  for v_item in select * from condicional_itens i where i.condicional_id = v_cond.id for update loop
    select coalesce(sum((c ->> 'quantidade')::numeric), 0) into v_comprado
      from jsonb_array_elements(coalesce(p_compras, '[]'::jsonb)) c
     where (c ->> 'item_id')::uuid = v_item.id;
    if v_comprado < 0 or v_comprado > v_item.quantidade then
      raise exception 'quantidade_invalida' using errcode = 'P0001', detail = v_item.produto_nome;
    end if;

    update condicional_itens set comprado = v_comprado, devolvido = quantidade - v_comprado where id = v_item.id;

    if v_item.quantidade - v_comprado > 0 and v_item.produto_id is not null then
      update produtos set quantidade = quantidade + (v_item.quantidade - v_comprado) where id = v_item.produto_id;
    end if;

    if v_comprado > 0 then
      insert into vendas (cliente_id, produto_id, produto_nome, vendedor_id, vendedor_nome, quantidade,
                          preco_unitario, custo_unitario, pedido_id, cliente_loja_id)
      values (v_cond.cliente_id, v_item.produto_id, v_item.produto_nome, v_cond.vendedor_id, v_cond.vendedor_nome,
              v_comprado, v_item.preco_unitario, v_item.custo_unitario, v_pedido, v_cond.cliente_loja_id);
      v_vendeu := true;
    end if;
  end loop;

  update condicionais
     set situacao = 'fechado', fechado_em = now(), pedido_id = case when v_vendeu then v_pedido end
   where id = v_cond.id;

  return case when v_vendeu then v_pedido end;
end
$fn$;

-- ===== Clientes com o resumo da ficha =====
-- security invoker: roda com o RLS de quem chama (só vê a própria loja).
create or replace function public.clientes_loja_com_resumo(p_cliente_id uuid)
returns table (
  id uuid, nome text, telefone text, endereco text, observacoes text, criado_em timestamptz,
  gasto numeric, pecas numeric, compras bigint, ultima_compra timestamptz, condicionais_abertos bigint
)
language sql
stable security invoker
set search_path to 'public', 'pg_temp'
as $fn$
  select c.id, c.nome, c.telefone, c.endereco, c.observacoes, c.criado_em,
         coalesce(v.gasto, 0), coalesce(v.pecas, 0), coalesce(v.compras, 0), v.ultima_compra,
         (select count(*) from condicionais k where k.cliente_loja_id = c.id and k.situacao = 'aberto')
    from clientes_loja c
    left join lateral (
      select sum(x.quantidade * x.preco_unitario) as gasto, sum(x.quantidade) as pecas,
             count(distinct x.pedido_id) as compras, max(x.vendido_em) as ultima_compra
        from vendas x where x.cliente_loja_id = c.id
    ) v on true
   where c.cliente_id = p_cliente_id
   order by c.nome
$fn$;

revoke execute on function public.registrar_pedido(jsonb, uuid, uuid) from public, anon;
grant  execute on function public.registrar_pedido(jsonb, uuid, uuid) to authenticated;
revoke execute on function public.clientes_loja_com_resumo(uuid) from public, anon;
grant  execute on function public.clientes_loja_com_resumo(uuid) to authenticated;
