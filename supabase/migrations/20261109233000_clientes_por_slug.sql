-- Base multi-cliente: um banco, um código, vários clientes identificados por slug.
--
-- Isolamento de dado é do BANCO (RLS), não da tela: toda tabela de negócio tem
-- `cliente_id` e uma policy que só deixa passar quem é membro daquele cliente.
-- A personalização visual/de regra de cada slug mora no frontend
-- (src/clientes/<slug>/); aqui fica só quem existe e quem pode o quê.

-- ===== Slugs reservados =====
-- Mesma lista de SLUGS_RESERVADOS em frontend/src/utils/slug.js. Repetida de
-- propósito: CHECK precisa de função IMMUTABLE, e ler tabela não é immutable.
-- Rota fixa nova no App.jsx entra nos dois lugares.
create or replace function public.slug_reservado(p_slug text)
returns boolean
language sql
immutable
set search_path to 'pg_catalog', 'pg_temp'
as $fn$
  select lower(btrim(coalesce(p_slug, ''))) = any (array[
    'login', 'cadastro', 'esqueci-senha', 'redefinir-senha', 'termos', 'privacidade',
    'admin', 'api', 'app', 'assets', 'www', 'suporte', 'ajuda', 'entrar', 'sair',
    'planos', '_modelo'
  ])
$fn$;

-- ===== Clientes =====
create table public.clientes (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  nome       text not null,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  constraint clientes_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint clientes_slug_nao_reservado check (not public.slug_reservado(slug))
);

-- Quem acessa cada cliente. Um usuário pode estar em mais de um.
create table public.cliente_membros (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  papel      text not null default 'membro' check (papel in ('dono', 'membro')),
  criado_em  timestamptz not null default now(),
  primary key (cliente_id, user_id)
);
create index cliente_membros_user_id_idx on public.cliente_membros(user_id);

-- ===== Funções =====

-- Usada nas policies. SECURITY DEFINER para não recursar no RLS de cliente_membros.
create or replace function public.eh_membro(p_cliente_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select exists (
    select 1 from cliente_membros m
     where m.cliente_id = p_cliente_id and m.user_id = auth.uid()
  )
$fn$;

-- O frontend resolve o slug da URL por aqui, inclusive deslogado (a tela de
-- login já abre com o nome do cliente). Devolve só o que é público.
create or replace function public.cliente_por_slug(p_slug text)
returns table (id uuid, slug text, nome text, ativo boolean)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select c.id, c.slug, c.nome, c.ativo from clientes c where c.slug = lower(btrim(p_slug))
$fn$;

revoke execute on function public.eh_membro(uuid) from public, anon;
grant  execute on function public.eh_membro(uuid) to authenticated;
revoke execute on function public.cliente_por_slug(text) from public;
grant  execute on function public.cliente_por_slug(text) to anon, authenticated;

-- ===== RLS =====
alter table public.clientes enable row level security;
alter table public.cliente_membros enable row level security;

create policy clientes_membro_le on public.clientes
  for select to authenticated using (public.eh_membro(id));

create policy cliente_membros_le_os_proprios on public.cliente_membros
  for select to authenticated using (user_id = auth.uid());

-- Criar cliente / adicionar membro: pelo painel do Supabase ou service role,
-- por enquanto. Não há policy de escrita de propósito.

-- ===== Primeiro módulo: produtos (molde para toda tabela de negócio) =====
create table public.produtos (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes(id) on delete cascade,
  nome           text not null check (btrim(nome) <> ''),
  quantidade     numeric not null default 0,
  estoque_minimo numeric,
  criado_em      timestamptz not null default now()
);
create index produtos_cliente_id_idx on public.produtos(cliente_id);

alter table public.produtos enable row level security;

create policy produtos_do_cliente on public.produtos
  for all to authenticated
  using (public.eh_membro(cliente_id))
  with check (public.eh_membro(cliente_id));
