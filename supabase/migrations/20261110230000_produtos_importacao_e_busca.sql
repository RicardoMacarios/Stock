-- Campos de loja de roupa + código do sistema antigo (importação do backup
-- do cliente) e busca por parte do código.
-- Já aplicada no projeto pelo painel; idempotente para rodar de novo.

alter table public.produtos
  add column if not exists tamanho text check (tamanho is null or length(tamanho) <= 30),
  add column if not exists cor text check (cor is null or length(cor) <= 60),
  add column if not exists marca text check (marca is null or length(marca) <= 80),
  add column if not exists categoria text check (categoria is null or length(categoria) <= 80),
  add column if not exists codigo_legado integer,
  add column if not exists ativo boolean not null default true;

create index if not exists produtos_cliente_codigo_legado_idx on public.produtos (cliente_id, codigo_legado);

-- Busca parcial rápida (ilike '%…%') em código e nome.
create extension if not exists pg_trgm with schema extensions;
create index if not exists produtos_codigo_trgm on public.produtos using gin (codigo extensions.gin_trgm_ops);
create index if not exists produtos_nome_trgm on public.produtos using gin (nome extensions.gin_trgm_ops);

-- Busca no servidor (o front hoje filtra na memória; fica para quando a lista
-- crescer). security invoker: a RLS de produtos continua valendo.
create or replace function public.buscar_produtos(p_cliente_id uuid, p_termo text, p_limite int default 50)
returns setof public.produtos
language sql stable security invoker set search_path = public
as $$
  with t as (select btrim(coalesce(p_termo,'')) as q)
  select p.* from public.produtos p, t
  where p.cliente_id = p_cliente_id
    and t.q <> ''
    and (
      p.codigo_legado::text like '%' || t.q || '%'
      or p.codigo ilike '%' || t.q || '%'
      or p.nome ilike '%' || t.q || '%'
    )
  order by
    (p.codigo_legado::text = t.q or p.codigo = t.q) desc,
    (p.codigo_legado::text like t.q || '%') desc,
    p.ativo desc,
    p.nome
  limit greatest(1, least(coalesce(p_limite,50), 500));
$$;
grant execute on function public.buscar_produtos(uuid, text, int) to authenticated;
revoke execute on function public.buscar_produtos(uuid, text, int) from anon;
