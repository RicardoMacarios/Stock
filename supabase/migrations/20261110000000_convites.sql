-- Cadastro de cliente por convite.
--
-- O admin gera um código único que expira; quem tem o código cria a conta e,
-- no mesmo passo, o cliente (com o slug = URL) e o vínculo como dono. Sem
-- código válido não nasce cliente, nem chamando a RPC direto: a checagem é
-- aqui, não na tela.

-- ===== Admins da plataforma (você) =====
create table public.plataforma_admins (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.plataforma_admins enable row level security;
-- Sem policy: ninguém lê nem escreve pela API. Admin entra pelo SQL Editor:
--   insert into public.plataforma_admins (user_id) values ('<seu auth.users.id>');

create or replace function public.eh_admin()
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select exists (select 1 from plataforma_admins a where a.user_id = auth.uid())
$fn$;

-- Membro do cliente ou admin. Usada pela tela para recusar quem abre a URL de
-- um cliente que não é o seu (o RLS já esconderia os dados; isto é para a tela
-- dizer "sem acesso" em vez de mostrar tudo vazio).
create or replace function public.pode_acessar(p_cliente_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select public.eh_membro(p_cliente_id) or public.eh_admin()
$fn$;

-- Admin enxerga todos os clientes.
create policy clientes_admin_le on public.clientes
  for select to authenticated using (public.eh_admin());

-- ===== Convites =====
create table public.convites (
  codigo     text primary key,
  -- Opcional: slug fixado pelo admin. Vazio = sai do nome que o cliente digitar.
  slug       text,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em  timestamptz not null default now(),
  expira_em  timestamptz not null,
  usado_por  uuid references auth.users(id) on delete set null,
  usado_em   timestamptz,
  cliente_id uuid references public.clientes(id) on delete set null,
  constraint convites_slug_formato check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint convites_slug_nao_reservado check (slug is null or not public.slug_reservado(slug))
);
alter table public.convites enable row level security;

create policy convites_admin_le on public.convites
  for select to authenticated using (public.eh_admin());

-- Código no formato XXXX-XXXX, sem letras/números que se confundem (0/O, 1/I/L).
-- Aleatoriedade de gen_random_uuid() (criptográfica), não de random().
create or replace function public.gerar_convite(p_slug text default null, p_dias int default 7)
returns public.convites
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes    bytea;
  v_codigo   text;
  v_slug     text := nullif(lower(btrim(coalesce(p_slug, ''))), '');
  v_convite  public.convites%rowtype;
begin
  if not public.eh_admin() then
    raise exception 'somente_admin' using errcode = 'P0001';
  end if;
  if p_dias is null or p_dias < 1 or p_dias > 90 then
    raise exception 'validade_invalida' using errcode = 'P0001';
  end if;
  if v_slug is not null and (
       exists (select 1 from clientes c where c.slug = v_slug)
    or exists (select 1 from convites c where c.slug = v_slug and c.usado_em is null and c.expira_em > now())
  ) then
    raise exception 'slug_em_uso' using errcode = 'P0001';
  end if;

  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_codigo := '';
    for i in 0..7 loop
      v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % length(v_alfabeto)) + 1, 1);
    end loop;
    v_codigo := substr(v_codigo, 1, 4) || '-' || substr(v_codigo, 5, 4);
    exit when not exists (select 1 from convites c where c.codigo = v_codigo);
  end loop;

  insert into convites (codigo, slug, criado_por, expira_em)
  values (v_codigo, v_slug, auth.uid(), now() + make_interval(days => p_dias))
  returning * into v_convite;

  return v_convite;
end
$fn$;

-- A tela de cadastro confere o código ANTES de criar o usuário, para não
-- deixar conta órfã quando o código está errado. Devolve o slug fixado, se houver.
create or replace function public.conferir_convite(p_codigo text)
returns table (valido boolean, motivo text, slug text)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select
    c.codigo is not null and c.usado_em is null and c.expira_em > now(),
    case
      when c.codigo is null then 'convite_invalido'
      when c.usado_em is not null then 'convite_usado'
      when c.expira_em <= now() then 'convite_expirado'
    end,
    c.slug
  from (select 1) _
  left join convites c on c.codigo = upper(btrim(coalesce(p_codigo, '')))
$fn$;

-- O passo que vale: confere o código de novo (com trava de linha), cria o
-- cliente, liga o usuário como dono e queima o código. Tudo ou nada.
create or replace function public.criar_cliente_com_convite(p_codigo text, p_nome text, p_slug text)
returns public.clientes
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_uid     uuid := auth.uid();
  v_codigo  text := upper(btrim(coalesce(p_codigo, '')));
  v_nome    text := btrim(coalesce(p_nome, ''));
  v_convite public.convites%rowtype;
  v_base    text;
  v_slug    text;
  v_n       int := 1;
  v_cliente public.clientes%rowtype;
begin
  if v_uid is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;
  if v_nome = '' then
    raise exception 'nome_obrigatorio' using errcode = 'P0001';
  end if;

  -- `for update`: dois cadastros simultâneos com o mesmo código, o segundo
  -- espera e encontra o código já usado.
  select * into v_convite from convites c where c.codigo = v_codigo for update;
  if not found then
    raise exception 'convite_invalido' using errcode = 'P0001';
  end if;
  if v_convite.usado_em is not null then
    raise exception 'convite_usado' using errcode = 'P0001';
  end if;
  if v_convite.expira_em <= now() then
    raise exception 'convite_expirado' using errcode = 'P0001';
  end if;

  -- Slug fixado no convite manda; senão vem o gerado pela tela a partir do nome.
  v_base := coalesce(v_convite.slug, nullif(lower(btrim(coalesce(p_slug, ''))), ''));
  if v_base is null or v_base !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'slug_invalido' using errcode = 'P0001';
  end if;
  if public.slug_reservado(v_base) then
    raise exception 'slug_reservado' using errcode = 'P0001';
  end if;

  -- Já existe? mercado-do-ze-2, -3… (só quando o slug veio do nome).
  v_slug := v_base;
  while exists (select 1 from clientes c where c.slug = v_slug) loop
    if v_convite.slug is not null then
      raise exception 'slug_em_uso' using errcode = 'P0001';
    end if;
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into clientes (slug, nome) values (v_slug, v_nome) returning * into v_cliente;
  insert into cliente_membros (cliente_id, user_id, papel) values (v_cliente.id, v_uid, 'dono');

  update convites
     set usado_por = v_uid, usado_em = now(), cliente_id = v_cliente.id
   where codigo = v_codigo;

  return v_cliente;
end
$fn$;

-- ===== Privilégios =====
revoke execute on function public.eh_admin() from public, anon;
grant  execute on function public.eh_admin() to authenticated;
revoke execute on function public.pode_acessar(uuid) from public, anon;
grant  execute on function public.pode_acessar(uuid) to authenticated;
revoke execute on function public.gerar_convite(text, int) from public, anon;
grant  execute on function public.gerar_convite(text, int) to authenticated;
revoke execute on function public.conferir_convite(text) from public;
grant  execute on function public.conferir_convite(text) to anon, authenticated;
revoke execute on function public.criar_cliente_com_convite(text, text, text) from public, anon;
grant  execute on function public.criar_cliente_com_convite(text, text, text) to authenticated;
