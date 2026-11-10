-- Convites como no BarberVez: vida curta (minutos, não dias), anotação de
-- "para quem" e uma listagem que já diz quem usou e qual cliente virou.
--
-- Código continua XXXX-XXXX, sem letras/números que se confundem, com
-- aleatoriedade de gen_random_uuid() (criptográfica).

alter table public.convites
  add column nota text,
  add constraint convites_nota_tamanho check (nota is null or length(nota) <= 120);

-- Assinatura muda (minutos no lugar de dias, nota): sai a antiga.
drop function if exists public.gerar_convite(text, int);

-- p_minutos: 1 a 1440 (24 h). p_slug segue opcional: fixa o endereço do cliente.
create function public.gerar_convite(p_nota text default null, p_minutos int default 5, p_slug text default null)
returns public.convites
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes    bytea;
  v_codigo   text;
  v_minutos  int := greatest(1, least(coalesce(p_minutos, 5), 1440));
  v_slug     text := nullif(lower(btrim(coalesce(p_slug, ''))), '');
  v_convite  public.convites%rowtype;
begin
  if not public.eh_admin() then
    raise exception 'somente_admin' using errcode = 'P0001';
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

  insert into convites (codigo, nota, slug, criado_por, expira_em)
  values (v_codigo, nullif(btrim(coalesce(p_nota, '')), ''), v_slug, auth.uid(),
          now() + make_interval(mins => v_minutos))
  returning * into v_convite;

  return v_convite;
end
$fn$;

-- Convites mais recentes com o e-mail de quem usou e o cliente que nasceu.
-- SECURITY DEFINER para ler auth.users; confere eh_admin() por dentro.
create or replace function public.admin_listar_convites(p_limite int default 20)
returns table (
  codigo text, nota text, slug text, criado_em timestamptz, expira_em timestamptz,
  usado_em timestamptz, usado_por_email text, cliente_nome text, cliente_slug text
)
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  if not public.eh_admin() then
    raise exception 'somente_admin' using errcode = 'P0001';
  end if;
  return query
    select c.codigo, c.nota, c.slug, c.criado_em, c.expira_em, c.usado_em,
           u.email::text, cl.nome, cl.slug
      from convites c
      left join auth.users u on u.id = c.usado_por
      left join clientes cl on cl.id = c.cliente_id
     order by c.criado_em desc
     limit greatest(1, least(coalesce(p_limite, 20), 100));
end
$fn$;

-- Clientes com o e-mail do dono, para a lista do admin.
create or replace function public.admin_listar_clientes()
returns table (
  id uuid, slug text, nome text, ativo boolean, criado_em timestamptz,
  cor_primaria text, logo_url text, dono_email text
)
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  if not public.eh_admin() then
    raise exception 'somente_admin' using errcode = 'P0001';
  end if;
  return query
    select cl.id, cl.slug, cl.nome, cl.ativo, cl.criado_em, cl.cor_primaria, cl.logo_url,
           (select u.email::text
              from cliente_membros m join auth.users u on u.id = m.user_id
             where m.cliente_id = cl.id and m.papel = 'dono'
             order by m.criado_em limit 1)
      from clientes cl
     order by cl.criado_em desc;
end
$fn$;

revoke execute on function public.gerar_convite(text, int, text) from public, anon;
grant  execute on function public.gerar_convite(text, int, text) to authenticated;
revoke execute on function public.admin_listar_convites(int) from public, anon;
grant  execute on function public.admin_listar_convites(int) to authenticated;
revoke execute on function public.admin_listar_clientes() from public, anon;
grant  execute on function public.admin_listar_clientes() to authenticated;
