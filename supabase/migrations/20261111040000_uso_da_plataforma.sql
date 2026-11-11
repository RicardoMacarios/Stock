-- Painel de uso no /admin: quanto do plano Free do Supabase já foi gasto,
-- com um histórico diário para os gráficos de crescimento. Mesmo painel do
-- BarberVez, medindo com a régua do Supabase.
--
-- Banco: a cota de 500 MB conta todos os bancos do servidor, não só o
-- "postgres" (template0 e template1 somam ~15 MB).
--
-- Usuários ativos: o MAU do Supabase conta quem entrou OU renovou a sessão
-- dentro do ciclo de cobrança, e zera na virada.
--
-- Tráfego de saída (egress) e a fatura não aparecem aqui: só a API de
-- gerenciamento do Supabase sabe deles, e ela pede um token pessoal que não
-- pode morar no navegador. A tela leva ao painel do Supabase para isso.
--
-- O ciclo vira no dia 10 (a organização do Stock nasceu em 10/11/2026). Se o
-- Usage do Supabase mostrar outro dia, é aqui que se troca.

create extension if not exists pg_cron;

-- ===== Ciclo de cobrança =====

create or replace function public.ciclo_cobranca_atual(out inicio date, out fim date)
language sql
stable
set search_path to 'public', 'pg_temp'
as $fn$
  -- Dia 10 existe em todo mês: não precisa ajustar fim de mês.
  select c.ini, (c.ini + interval '1 month')::date
    from (
      select case when extract(day from h.d) >= 10
                  then date_trunc('month', h.d)::date + 9
                  else (date_trunc('month', h.d) - interval '1 month')::date + 9
             end as ini
        from (select (now() at time zone 'America/Sao_Paulo')::date as d) h
    ) c;
$fn$;

revoke execute on function public.ciclo_cobranca_atual() from public, anon, authenticated;

-- Quem entrou ou renovou a sessão desde o início do ciclo.
create or replace function public.usuarios_ativos_no_ciclo()
returns bigint
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
  with ini as (
    select (c.inicio::timestamp at time zone 'America/Sao_Paulo') as t
      from public.ciclo_cobranca_atual() c
  )
  select count(distinct x.u)
    from (
      select u.id as u from auth.users u, ini where u.last_sign_in_at >= ini.t
      union
      select s.user_id from auth.sessions s, ini
       where greatest(s.refreshed_at at time zone 'UTC', s.updated_at) >= ini.t
    ) x;
$fn$;

revoke execute on function public.usuarios_ativos_no_ciclo() from public, anon, authenticated;

-- ===== Uso de agora =====

create or replace function public.admin_uso_plataforma()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_ciclo     record;
  v_resultado jsonb;
begin
  if not public.eh_admin() then
    raise exception 'nao_autorizado' using errcode = 'P0001';
  end if;

  select * into v_ciclo from public.ciclo_cobranca_atual();

  select jsonb_build_object(
    'medido_em',        now(),
    'banco_bytes',      (select sum(pg_database_size(d.datname))::bigint from pg_database d),
    'arquivos_bytes',   (select coalesce(sum((o.metadata->>'size')::bigint), 0)
                           from storage.objects o),
    'arquivos_qtd',     (select count(*) from storage.objects),
    'usuarios_total',   (select count(*) from auth.users),
    'usuarios_ativos',  public.usuarios_ativos_no_ciclo(),
    'ciclo_inicio',     v_ciclo.inicio,
    'ciclo_fim',        v_ciclo.fim,
    'clientes',         (select count(*) from public.clientes),
    -- As maiores tabelas, para saber quem está enchendo o banco.
    -- n_live_tup se atualiza a cada gravação (reltuples só no ANALYZE).
    'tabelas', (
      select coalesce(jsonb_agg(t order by t.bytes desc), '[]'::jsonb)
        from (
          select c.relname as nome,
                 pg_total_relation_size(c.oid) as bytes,
                 coalesce(s.n_live_tup, 0) as linhas
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            left join pg_stat_user_tables s on s.relid = c.oid
           where n.nspname = 'public' and c.relkind = 'r'
           order by pg_total_relation_size(c.oid) desc
           limit 8
        ) t
    )
  ) into v_resultado;

  return v_resultado;
end
$fn$;

-- Função nova nasce com EXECUTE para anon (padrão do Supabase).
revoke execute on function public.admin_uso_plataforma() from public, anon;
grant  execute on function public.admin_uso_plataforma() to authenticated;

-- ===== Histórico diário =====
-- Uma medição por dia. O pg_cron grava às 03:00 de Brasília (06:00 UTC); se
-- rodar de novo no mesmo dia, sobrescreve a linha do dia.

create table if not exists public.uso_historico (
  dia              date primary key,
  banco_bytes      bigint not null,
  arquivos_bytes   bigint not null,
  usuarios_ativos  integer not null,
  usuarios_total   integer not null,
  medido_em        timestamptz not null default now()
);

-- Sem policy: ninguém lê ou grava direto pela API, só pelas funções abaixo.
alter table public.uso_historico enable row level security;
revoke all on table public.uso_historico from anon, authenticated;

create or replace function public.registrar_uso_diario()
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
  insert into public.uso_historico
    (dia, banco_bytes, arquivos_bytes, usuarios_ativos, usuarios_total, medido_em)
  select (now() at time zone 'America/Sao_Paulo')::date,
         (select sum(pg_database_size(d.datname))::bigint from pg_database d),
         (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o),
         public.usuarios_ativos_no_ciclo(),
         (select count(*) from auth.users),
         now()
  on conflict (dia) do update
     set banco_bytes     = excluded.banco_bytes,
         arquivos_bytes  = excluded.arquivos_bytes,
         usuarios_ativos = excluded.usuarios_ativos,
         usuarios_total  = excluded.usuarios_total,
         medido_em       = excluded.medido_em;
$fn$;

-- Quem chama é o cron (postgres); pela API ninguém.
revoke execute on function public.registrar_uso_diario() from public, anon, authenticated;

create or replace function public.admin_uso_historico(p_dias integer default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  if not public.eh_admin() then
    raise exception 'nao_autorizado' using errcode = 'P0001';
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(h) - 'medido_em' order by h.dia), '[]'::jsonb)
      from public.uso_historico h
     where h.dia > (now() at time zone 'America/Sao_Paulo')::date - least(greatest(p_dias, 1), 366)
  );
end
$fn$;

revoke execute on function public.admin_uso_historico(integer) from public, anon;
grant  execute on function public.admin_uso_historico(integer) to authenticated;

-- Com o mesmo nome, o cron.schedule substitui o agendamento em vez de duplicar.
select cron.schedule('registrar-uso-diario', '0 6 * * *', 'select public.registrar_uso_diario()');

-- Primeira medição já hoje, para o gráfico nascer com um ponto.
select public.registrar_uso_diario();
