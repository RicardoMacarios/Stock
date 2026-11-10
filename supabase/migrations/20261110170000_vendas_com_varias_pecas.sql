-- Venda com várias peças (carrinho): cada peça continua sendo uma linha em
-- `vendas` (é o que o dashboard e o lucro somam), e as linhas da mesma compra
-- ganham o mesmo `pedido_id`. "Quantas vendas" = quantos pedidos.

-- Default volátil: cada linha que já existe vira um pedido próprio.
alter table public.vendas add column pedido_id uuid not null default gen_random_uuid();
create index vendas_pedido_id_idx on public.vendas(pedido_id);

-- Mesmo registrar_venda, agora dizendo QUAL produto não tem estoque
-- (detail), para a tela avisar quando o carrinho tem várias peças.
create or replace function public.registrar_venda(
  p_produto_id uuid,
  p_quantidade numeric,
  p_preco_unitario numeric default null,
  p_vendedor_id uuid default null
)
returns public.vendas
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_produto  public.produtos%rowtype;
  v_vendedor public.vendedores%rowtype;
  v_preco    numeric;
  v_venda    public.vendas%rowtype;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  -- for update: duas vendas ao mesmo tempo do mesmo produto não furam o estoque.
  select * into v_produto from produtos p where p.id = p_produto_id for update;
  if not found or not public.eh_membro(v_produto.cliente_id) then
    raise exception 'produto_nao_encontrado' using errcode = 'P0001';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'quantidade_invalida' using errcode = 'P0001', detail = v_produto.nome;
  end if;
  if p_quantidade > v_produto.quantidade then
    raise exception 'estoque_insuficiente' using errcode = 'P0001', detail = v_produto.nome;
  end if;

  v_preco := coalesce(p_preco_unitario, v_produto.preco_venda);
  if v_preco is null or v_preco < 0 then
    raise exception 'preco_invalido' using errcode = 'P0001', detail = v_produto.nome;
  end if;

  if p_vendedor_id is not null then
    select * into v_vendedor from vendedores v
     where v.id = p_vendedor_id and v.cliente_id = v_produto.cliente_id and v.ativo;
    if not found then
      raise exception 'vendedor_invalido' using errcode = 'P0001';
    end if;
  elsif exists (select 1 from vendedores v where v.cliente_id = v_produto.cliente_id and v.ativo) then
    raise exception 'vendedor_obrigatorio' using errcode = 'P0001';
  end if;

  update produtos set quantidade = quantidade - p_quantidade where id = v_produto.id;

  insert into vendas (cliente_id, produto_id, produto_nome, vendedor_id, vendedor_nome,
                      quantidade, preco_unitario, custo_unitario)
  values (v_produto.cliente_id, v_produto.id, v_produto.nome, v_vendedor.id, v_vendedor.nome,
          p_quantidade, v_preco, v_produto.preco_custo)
  returning * into v_venda;

  return v_venda;
end
$fn$;

-- Carrinho inteiro de uma vez: tudo ou nada. Uma peça sem estoque desfaz as
-- outras (a exceção volta toda a função).
-- p_itens: [{ "produto_id": uuid, "quantidade": n, "preco_unitario": n }]
create or replace function public.registrar_pedido(p_itens jsonb, p_vendedor_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_pedido uuid := gen_random_uuid();
  v_item   jsonb;
  v_venda  public.vendas%rowtype;
begin
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'carrinho_vazio' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_itens) > 100 then
    raise exception 'carrinho_grande_demais' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_venda := public.registrar_venda(
      (v_item ->> 'produto_id')::uuid,
      (v_item ->> 'quantidade')::numeric,
      (v_item ->> 'preco_unitario')::numeric,
      p_vendedor_id
    );
    update vendas set pedido_id = v_pedido where id = v_venda.id;
  end loop;

  return v_pedido;
end
$fn$;

-- Desfaz a compra inteira (todas as peças voltam ao estoque).
create or replace function public.desfazer_pedido(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_id uuid;
  v_achou boolean := false;
begin
  for v_id in select v.id from vendas v where v.pedido_id = p_pedido_id loop
    perform public.desfazer_venda(v_id); -- confere eh_membro por linha
    v_achou := true;
  end loop;
  if not v_achou then
    raise exception 'venda_nao_encontrada' using errcode = 'P0001';
  end if;
end
$fn$;

revoke execute on function public.registrar_pedido(jsonb, uuid) from public, anon;
grant  execute on function public.registrar_pedido(jsonb, uuid) to authenticated;
revoke execute on function public.desfazer_pedido(uuid) from public, anon;
grant  execute on function public.desfazer_pedido(uuid) to authenticated;
