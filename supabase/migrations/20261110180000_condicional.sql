-- Condicional: o cliente leva peças para provar em casa. Na saída as peças
-- deixam o estoque; no acerto, o que ele comprou vira venda e o resto volta.
--
-- Nomes: `clientes` já é a LOJA (o cliente do Stock). Quem compra na loja é
-- `clientes_loja`.

-- ===== Clientes da loja =====
create table public.clientes_loja (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  nome        text not null check (length(btrim(nome)) between 1 and 120),
  telefone    text check (telefone is null or length(telefone) <= 30),
  endereco    text check (endereco is null or length(endereco) <= 300),
  observacoes text check (observacoes is null or length(observacoes) <= 1000),
  criado_em   timestamptz not null default now()
);
create index clientes_loja_cliente_id_idx on public.clientes_loja(cliente_id, nome);

alter table public.clientes_loja enable row level security;
create policy clientes_loja_do_cliente on public.clientes_loja
  for all to authenticated
  using (public.eh_membro(cliente_id))
  with check (public.eh_membro(cliente_id));

-- ===== Condicionais =====
create table public.condicionais (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  cliente_loja_id uuid not null references public.clientes_loja(id) on delete restrict,
  vendedor_id     uuid references public.vendedores(id) on delete set null,
  vendedor_nome   text,
  saiu_em         date not null default current_date,
  devolver_ate    date,
  observacoes     text check (observacoes is null or length(observacoes) <= 1000),
  situacao        text not null default 'aberto' check (situacao in ('aberto', 'fechado')),
  fechado_em      timestamptz,
  pedido_id       uuid,          -- as vendas que saíram do acerto
  criado_por      uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em       timestamptz not null default now(),
  constraint condicionais_prazo check (devolver_ate is null or devolver_ate >= saiu_em)
);
create index condicionais_cliente_situacao_idx on public.condicionais(cliente_id, situacao, saiu_em desc);
create index condicionais_cliente_loja_idx on public.condicionais(cliente_loja_id);

-- Peça levada. Preço e custo DA SAÍDA: o acerto vende pelo combinado.
create table public.condicional_itens (
  id             uuid primary key default gen_random_uuid(),
  condicional_id uuid not null references public.condicionais(id) on delete cascade,
  cliente_id     uuid not null references public.clientes(id) on delete cascade,
  produto_id     uuid references public.produtos(id) on delete set null,
  produto_nome   text not null,
  produto_codigo text,
  quantidade     numeric(12, 3) not null check (quantidade > 0),
  preco_unitario numeric(12, 2) not null check (preco_unitario >= 0),
  custo_unitario numeric(12, 2),
  comprado       numeric(12, 3) not null default 0 check (comprado >= 0),
  devolvido      numeric(12, 3) not null default 0 check (devolvido >= 0),
  constraint condicional_itens_acerto check (comprado + devolvido <= quantidade)
);
create index condicional_itens_condicional_idx on public.condicional_itens(condicional_id);

alter table public.condicionais enable row level security;
alter table public.condicional_itens enable row level security;

-- Ler: membro. Escrever: só pelas RPCs (mexem no estoque junto).
create policy condicionais_membro_le on public.condicionais
  for select to authenticated using (public.eh_membro(cliente_id));
create policy condicional_itens_membro_le on public.condicional_itens
  for select to authenticated using (public.eh_membro(cliente_id));

-- ===== Abrir =====
-- p_itens: [{ "produto_id": uuid, "quantidade": n, "preco_unitario": n|null }]
create or replace function public.abrir_condicional(
  p_cliente_loja_id uuid,
  p_itens jsonb,
  p_vendedor_id uuid default null,
  p_saiu_em date default null,
  p_devolver_ate date default null,
  p_observacoes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_pessoa   public.clientes_loja%rowtype;
  v_vendedor public.vendedores%rowtype;
  v_cond     uuid;
  v_item     jsonb;
  v_produto  public.produtos%rowtype;
  v_qtd      numeric;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  select * into v_pessoa from clientes_loja c where c.id = p_cliente_loja_id;
  if not found or not public.eh_membro(v_pessoa.cliente_id) then
    raise exception 'cliente_loja_nao_encontrado' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'carrinho_vazio' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_itens) > 100 then
    raise exception 'carrinho_grande_demais' using errcode = 'P0001';
  end if;

  if p_vendedor_id is not null then
    select * into v_vendedor from vendedores v
     where v.id = p_vendedor_id and v.cliente_id = v_pessoa.cliente_id and v.ativo;
    if not found then
      raise exception 'vendedor_invalido' using errcode = 'P0001';
    end if;
  end if;

  insert into condicionais (cliente_id, cliente_loja_id, vendedor_id, vendedor_nome, saiu_em, devolver_ate, observacoes)
  values (v_pessoa.cliente_id, v_pessoa.id, v_vendedor.id, v_vendedor.nome,
          coalesce(p_saiu_em, current_date), p_devolver_ate, nullif(btrim(coalesce(p_observacoes, '')), ''))
  returning id into v_cond;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    select * into v_produto from produtos p where p.id = (v_item ->> 'produto_id')::uuid for update;
    if not found or v_produto.cliente_id <> v_pessoa.cliente_id then
      raise exception 'produto_nao_encontrado' using errcode = 'P0001';
    end if;
    v_qtd := (v_item ->> 'quantidade')::numeric;
    if v_qtd is null or v_qtd <= 0 then
      raise exception 'quantidade_invalida' using errcode = 'P0001', detail = v_produto.nome;
    end if;
    if v_qtd > v_produto.quantidade then
      raise exception 'estoque_insuficiente' using errcode = 'P0001', detail = v_produto.nome;
    end if;

    update produtos set quantidade = quantidade - v_qtd where id = v_produto.id;
    insert into condicional_itens (condicional_id, cliente_id, produto_id, produto_nome, produto_codigo,
                                   quantidade, preco_unitario, custo_unitario)
    values (v_cond, v_pessoa.cliente_id, v_produto.id, v_produto.nome, v_produto.codigo, v_qtd,
            coalesce((v_item ->> 'preco_unitario')::numeric, v_produto.preco_venda, 0), v_produto.preco_custo);
  end loop;

  return v_cond;
end
$fn$;

-- ===== Acerto =====
-- p_compras: [{ "item_id": uuid, "quantidade": n }] — o que o cliente comprou.
-- Comprado vira venda (mesmo pedido_id, vendedor do condicional); o resto
-- volta ao estoque. Sem compras = devolveu tudo.
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
                          preco_unitario, custo_unitario, pedido_id)
      values (v_cond.cliente_id, v_item.produto_id, v_item.produto_nome, v_cond.vendedor_id, v_cond.vendedor_nome,
              v_comprado, v_item.preco_unitario, v_item.custo_unitario, v_pedido);
      v_vendeu := true;
    end if;
  end loop;

  update condicionais
     set situacao = 'fechado', fechado_em = now(), pedido_id = case when v_vendeu then v_pedido end
   where id = v_cond.id;

  return case when v_vendeu then v_pedido end;
end
$fn$;

revoke execute on function public.abrir_condicional(uuid, jsonb, uuid, date, date, text) from public, anon;
grant  execute on function public.abrir_condicional(uuid, jsonb, uuid, date, date, text) to authenticated;
revoke execute on function public.fechar_condicional(uuid, jsonb) from public, anon;
grant  execute on function public.fechar_condicional(uuid, jsonb) to authenticated;
