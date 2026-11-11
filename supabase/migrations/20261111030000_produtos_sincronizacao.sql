-- Lista de produtos guardada no navegador. A tela mostra o que está salvo na
-- hora e depois busca só o que mudou desde a última vez:
--   produtos.atualizado_em   muda em todo insert/update (edição, entrada de
--                            estoque, venda, condicional...);
--   produtos_removidos       guarda quem foi apagado, para sair da lista
--                            salva também.

alter table public.produtos add column atualizado_em timestamptz not null default clock_timestamp();
create index produtos_cliente_atualizado_idx on public.produtos(cliente_id, atualizado_em);

create function public.produtos_marca_atualizado()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $fn$
begin
  -- clock_timestamp: hora real da alteração (now() seria o início da transação).
  new.atualizado_em := clock_timestamp();
  return new;
end
$fn$;

create trigger produtos_atualizado_em
  before update on public.produtos
  for each row execute function public.produtos_marca_atualizado();

create table public.produtos_removidos (
  id          uuid primary key,
  cliente_id  uuid not null, -- sem FK: apagar a loja apaga os produtos, e o gatilho grava aqui no meio
  removido_em timestamptz not null default clock_timestamp()
);
create index produtos_removidos_cliente_idx on public.produtos_removidos(cliente_id, removido_em);

alter table public.produtos_removidos enable row level security;
create policy produtos_removidos_membro_le on public.produtos_removidos
  for select to authenticated using (public.eh_membro(cliente_id));

-- security definer: quem apaga não tem permissão de escrever na tabela.
create function public.produtos_registra_remocao()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  insert into produtos_removidos (id, cliente_id) values (old.id, old.cliente_id)
  on conflict (id) do update set removido_em = clock_timestamp();
  return old;
end
$fn$;

create trigger produtos_removido
  after delete on public.produtos
  for each row execute function public.produtos_registra_remocao();

revoke execute on function public.produtos_registra_remocao() from public, anon, authenticated;
