-- Endereço do cliente da loja em partes: rua, número e bairro.
-- `endereco` vira coluna calculada ("Rua das Flores, 123 - Centro"): quem só
-- mostra o endereço continua lendo dela, sem mudar nada.

alter table public.clientes_loja
  add column rua    text check (rua is null or length(rua) <= 200),
  add column numero text check (numero is null or length(numero) <= 20),
  add column bairro text check (bairro is null or length(bairro) <= 100);

-- O que já foi digitado no campo único vai inteiro para a rua.
update public.clientes_loja set rua = endereco where endereco is not null;

-- A função do resumo devolve `endereco`; sai antes de trocar a coluna e
-- volta (com as partes) no fim.
drop function if exists public.clientes_loja_com_resumo(uuid);

alter table public.clientes_loja drop column endereco;
alter table public.clientes_loja add column endereco text generated always as (
  nullif(btrim(
    coalesce(nullif(btrim(rua), ''), '')
    || case when nullif(btrim(numero), '') is not null then ', ' || btrim(numero) else '' end
    || case when nullif(btrim(bairro), '') is not null then ' - ' || btrim(bairro) else '' end
  , ' ,-'), '')
) stored;

-- security invoker: roda com o RLS de quem chama (só vê a própria loja).
create function public.clientes_loja_com_resumo(p_cliente_id uuid)
returns table (
  id uuid, nome text, telefone text, rua text, numero text, bairro text, endereco text, observacoes text,
  criado_em timestamptz, gasto numeric, pecas numeric, compras bigint, ultima_compra timestamptz,
  condicionais_abertos bigint
)
language sql
stable security invoker
set search_path to 'public', 'pg_temp'
as $fn$
  select c.id, c.nome, c.telefone, c.rua, c.numero, c.bairro, c.endereco, c.observacoes, c.criado_em,
         coalesce(v.gasto, 0), coalesce(v.pecas, 0), coalesce(v.compras, 0), v.ultima_compra,
         (select count(*) from condicionais k where k.cliente_loja_id = c.id and k.situacao = 'aberto')
    from clientes_loja c
    left join lateral (
      select sum(x.quantidade * x.preco_unitario) as gasto, sum(x.quantidade) as pecas,
             count(distinct x.pedido_id) as compras, max(x.vendido_em) as ultima_compra
        from vendas x where x.cliente_loja_id = c.id
    ) v on true
   where c.cliente_id = p_cliente_id
   order by c.nome
$fn$;

revoke execute on function public.clientes_loja_com_resumo(uuid) from public, anon;
grant  execute on function public.clientes_loja_com_resumo(uuid) to authenticated;
