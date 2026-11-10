-- Vendas: o produto ganha preço de custo e de venda, e cada venda baixa o
-- estoque. Base para o dashboard (peças vendidas, valor vendido e lucro do
-- dia) e, depois, para o módulo Financeiro.

-- ===== Preços no produto =====
alter table public.produtos
  add column preco_custo numeric(12, 2),
  add column preco_venda numeric(12, 2),
  add constraint produtos_preco_custo_positivo check (preco_custo is null or preco_custo >= 0),
  add constraint produtos_preco_venda_positivo check (preco_venda is null or preco_venda >= 0),
  add constraint produtos_nome_tamanho check (length(btrim(nome)) <= 120);

-- ===== Vendedores =====
-- Quem vendeu, escolhido na hora da venda. Não precisa ter login: é um nome
-- da equipe. O dono cadastra em Configurações; desativar (em vez de apagar)
-- tira da lista da venda sem perder o histórico.
create table public.vendedores (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nome       text not null check (length(btrim(nome)) between 1 and 60),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
create index vendedores_cliente_id_idx on public.vendedores(cliente_id);
create unique index vendedores_nome_unico on public.vendedores(cliente_id, lower(btrim(nome)));

alter table public.vendedores enable row level security;

create policy vendedores_membro_le on public.vendedores
  for select to authenticated using (public.eh_membro(cliente_id));
create policy vendedores_dono_cria on public.vendedores
  for insert to authenticated with check (public.eh_dono(cliente_id));
create policy vendedores_dono_altera on public.vendedores
  for update to authenticated using (public.eh_dono(cliente_id)) with check (public.eh_dono(cliente_id));

-- ===== Vendas =====
-- Preço, custo e nomes são guardados DA HORA da venda: mudar o preço do
-- produto depois não altera o que já foi vendido nem o lucro do dia.
create table public.vendas (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes(id) on delete cascade,
  -- Produto apagado depois não apaga o histórico de venda.
  produto_id     uuid references public.produtos(id) on delete set null,
  produto_nome   text not null,
  vendedor_id    uuid references public.vendedores(id) on delete set null,
  vendedor_nome  text,
  quantidade     numeric(12, 3) not null check (quantidade > 0),
  preco_unitario numeric(12, 2) not null check (preco_unitario >= 0),
  -- null = produto sem custo cadastrado na hora; o lucro dessa venda é desconhecido.
  custo_unitario numeric(12, 2) check (custo_unitario is null or custo_unitario >= 0),
  vendido_por    uuid references auth.users(id) on delete set null default auth.uid(),
  vendido_em     timestamptz not null default now()
);
create index vendas_cliente_data_idx on public.vendas(cliente_id, vendido_em desc);
create index vendas_produto_id_idx on public.vendas(produto_id);

alter table public.vendas enable row level security;

-- Ler: membro do cliente. Escrever: só pelas RPCs abaixo, que mexem no
-- estoque junto (venda sem baixa de estoque não pode existir).
create policy vendas_membro_le on public.vendas
  for select to authenticated using (public.eh_membro(cliente_id));

-- Registra a venda e baixa o estoque, tudo ou nada. Preço vazio = preço de
-- venda do produto. Não deixa vender mais do que tem. Loja com vendedor
-- ativo cadastrado: escolher o vendedor é obrigatório.
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
    raise exception 'quantidade_invalida' using errcode = 'P0001';
  end if;
  if p_quantidade > v_produto.quantidade then
    raise exception 'estoque_insuficiente' using errcode = 'P0001';
  end if;

  v_preco := coalesce(p_preco_unitario, v_produto.preco_venda);
  if v_preco is null or v_preco < 0 then
    raise exception 'preco_invalido' using errcode = 'P0001';
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

-- Desfaz uma venda (lançada errado): apaga e devolve a quantidade ao estoque.
create or replace function public.desfazer_venda(p_venda_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_venda public.vendas%rowtype;
begin
  select * into v_venda from vendas v where v.id = p_venda_id for update;
  if not found or not public.eh_membro(v_venda.cliente_id) then
    raise exception 'venda_nao_encontrada' using errcode = 'P0001';
  end if;

  if v_venda.produto_id is not null then
    update produtos set quantidade = quantidade + v_venda.quantidade where id = v_venda.produto_id;
  end if;
  delete from vendas where id = v_venda.id;
end
$fn$;

revoke execute on function public.registrar_venda(uuid, numeric, numeric, uuid) from public, anon;
grant  execute on function public.registrar_venda(uuid, numeric, numeric, uuid) to authenticated;
revoke execute on function public.desfazer_venda(uuid) from public, anon;
grant  execute on function public.desfazer_venda(uuid) to authenticated;
