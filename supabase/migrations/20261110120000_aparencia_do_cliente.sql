-- Aparência no banco: o dono do cliente troca nome, cor e logo pela tela de
-- Configurações e vale na hora, sem deploy. A pasta src/clientes/<slug>/
-- continua existindo para o que é código (botão, aba nova).
--
-- Precedência no frontend: config/padrao.js < src/clientes/<slug>/config.js < banco.

alter table public.clientes
  add column cor_primaria text,
  add column logo_url     text,
  add constraint clientes_cor_primaria_hex check (cor_primaria is null or cor_primaria ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint clientes_logo_url_tamanho check (logo_url is null or length(logo_url) <= 500),
  add constraint clientes_nome_tamanho check (length(btrim(nome)) between 1 and 80);

-- ===== Papel =====
create or replace function public.eh_dono(p_cliente_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select exists (
    select 1 from cliente_membros m
     where m.cliente_id = p_cliente_id and m.user_id = auth.uid() and m.papel = 'dono'
  )
$fn$;
revoke execute on function public.eh_dono(uuid) from public, anon;
grant  execute on function public.eh_dono(uuid) to authenticated;

-- ===== Leitura pelo slug, agora com a aparência e o papel de quem acessa =====
-- O tipo de retorno mudou: precisa dropar antes de recriar.
drop function if exists public.cliente_por_slug(text);

create function public.cliente_por_slug(p_slug text)
returns table (id uuid, slug text, nome text, ativo boolean,
               cor_primaria text, logo_url text, meu_papel text)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select c.id, c.slug, c.nome, c.ativo, c.cor_primaria, c.logo_url,
         (select m.papel from cliente_membros m
           where m.cliente_id = c.id and m.user_id = auth.uid())
    from clientes c
   where c.slug = lower(btrim(p_slug))
$fn$;
revoke execute on function public.cliente_por_slug(text) from public;
grant  execute on function public.cliente_por_slug(text) to anon, authenticated;

-- ===== Escrita: só o dono, só estes três campos =====
-- RPC em vez de policy de UPDATE: assim o dono não consegue mexer em `ativo`
-- nem em `slug` (a URL e a pasta dependem dele).
create or replace function public.atualizar_aparencia(
  p_cliente_id   uuid,
  p_nome         text,
  p_cor_primaria text,
  p_logo_url     text
)
returns public.clientes
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_cliente public.clientes%rowtype;
begin
  if not public.eh_dono(p_cliente_id) then
    raise exception 'somente_dono' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_nome), '') = '' then
    raise exception 'nome_obrigatorio' using errcode = 'P0001';
  end if;

  update clientes
     set nome         = btrim(p_nome),
         cor_primaria = nullif(btrim(coalesce(p_cor_primaria, '')), ''),
         logo_url     = nullif(btrim(coalesce(p_logo_url, '')), '')
   where id = p_cliente_id
  returning * into v_cliente;

  return v_cliente;
end
$fn$;
revoke execute on function public.atualizar_aparencia(uuid, text, text, text) from public, anon;
grant  execute on function public.atualizar_aparencia(uuid, text, text, text) to authenticated;

-- ===== Storage dos logos =====
-- Público para leitura (a tela de login mostra o logo antes de entrar).
-- Caminho obrigatório: <cliente_id>/<arquivo>. Só o dono daquele cliente grava.
-- SVG fora de propósito: pode carregar script.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy logos_dono_envia on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and public.eh_dono(((storage.foldername(name))[1])::uuid)
  );

create policy logos_dono_apaga on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and public.eh_dono(((storage.foldername(name))[1])::uuid)
  );
