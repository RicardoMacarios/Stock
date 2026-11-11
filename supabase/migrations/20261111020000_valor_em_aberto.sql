-- Venda com parte em aberto ("pagou só uma parte"). Ex.: peça de R$ 90, o
-- cliente paga R$ 40 agora e ficam R$ 50 no nome dele. Depois ele paga o
-- resto pela ficha do cliente (pode ser em partes de novo).
--
--   contas_receber: o que ficou em aberto de UM pedido (uma por pedido).
--   recebimentos:   cada pagamento recebido depois, com a forma.
--
-- O Financeiro conta o dinheiro que entrou no caixa: no dia da venda, o
-- total menos o que ficou em aberto; no dia de cada recebimento, o valor
-- recebido. `lucro_aberto` guarda a parte do lucro que ficou em aberto
-- (proporcional), para o lucro seguir a mesma regra.

create table public.contas_receber (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  cliente_loja_id uuid not null references public.clientes_loja(id) on delete restrict,
  pedido_id       uuid not null unique,
  vendedor_id     uuid references public.vendedores(id) on delete set null,
  vendedor_nome   text,
  valor_total     numeric(12, 2) not null check (valor_total > 0),     -- total da compra
  valor_aberto    numeric(12, 2) not null check (valor_aberto > 0),    -- o que ficou faltando na hora
  valor_recebido  numeric(12, 2) not null default 0 check (valor_recebido >= 0),
  lucro_aberto    numeric(12, 2),                                      -- null: compra sem custo conhecido
  criado_em       timestamptz not null default now(),
  quitado_em      timestamptz,
  constraint contas_receber_limite check (valor_aberto <= valor_total and valor_recebido <= valor_aberto)
);
create index contas_receber_cliente_idx on public.contas_receber(cliente_id, criado_em);
create index contas_receber_pessoa_idx on public.contas_receber(cliente_loja_id) where quitado_em is null;

create table public.recebimentos (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  conta_id        uuid not null references public.contas_receber(id) on delete cascade,
  valor           numeric(12, 2) not null check (valor > 0),
  forma_pagamento text not null check (forma_pagamento in ('pix', 'credito', 'debito', 'dinheiro')),
  recebido_em     timestamptz not null default now(),
  criado_por      uuid references auth.users(id) on delete set null default auth.uid()
);
create index recebimentos_cliente_idx on public.recebimentos(cliente_id, recebido_em);
create index recebimentos_conta_idx on public.recebimentos(conta_id);

alter table public.contas_receber enable row level security;
alter table public.recebimentos enable row level security;

-- Ler: membro. Escrever: só pelas RPCs.
create policy contas_receber_membro_le on public.contas_receber
  for select to authenticated using (public.eh_membro(cliente_id));
create policy recebimentos_membro_le on public.recebimentos
  for select to authenticated using (public.eh_membro(cliente_id));

-- ===== registrar_pedido com valor pago =====
-- p_valor_pago: null = pagou tudo (como antes). Menor que o total = o resto
-- fica em aberto no nome do cliente (cliente obrigatório). 0 = tudo em aberto.

drop function if exists public.registrar_pedido(jsonb, uuid, uuid, text, uuid, jsonb);

create function public.registrar_pedido(
  p_itens jsonb,
  p_vendedor_id uuid default null,
  p_cliente_loja_id uuid default null,
  p_forma_pagamento text default null,
  p_condicional_id uuid default null,
  p_condicional_itens jsonb default '[]'::jsonb,
  p_valor_pago numeric default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_pedido uuid := gen_random_uuid();
  v_item   jsonb;
  v_venda  public.vendas%rowtype;
  v_pessoa public.clientes_loja%rowtype;
  v_cond   public.condicionais%rowtype;
  v_ci     public.condicional_itens%rowtype;
  v_qtd    numeric;
  v_preco  numeric;
  v_soma   numeric;
  v_total  numeric;
  v_lucro  numeric;
  v_tem_custo boolean;
  v_aberto numeric;
  v_vend_id uuid;
  v_vend_nome text;
begin
  p_itens := coalesce(p_itens, '[]'::jsonb);
  p_condicional_itens := coalesce(p_condicional_itens, '[]'::jsonb);
  if jsonb_typeof(p_itens) <> 'array' or jsonb_typeof(p_condicional_itens) <> 'array' then
    raise exception 'carrinho_vazio' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_itens) = 0 and (p_condicional_id is null or jsonb_array_length(p_condicional_itens) = 0) then
    raise exception 'carrinho_vazio' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_itens) > 100 or jsonb_array_length(p_condicional_itens) > 200 then
    raise exception 'carrinho_grande_demais' using errcode = 'P0001';
  end if;
  if p_forma_pagamento is not null and p_forma_pagamento not in ('pix', 'credito', 'debito', 'dinheiro') then
    raise exception 'forma_pagamento_invalida' using errcode = 'P0001';
  end if;
  if p_valor_pago is not null and p_valor_pago < 0 then
    raise exception 'valor_pago_invalido' using errcode = 'P0001';
  end if;
  if p_cliente_loja_id is not null then
    select * into v_pessoa from clientes_loja c where c.id = p_cliente_loja_id;
    if not found or not public.eh_membro(v_pessoa.cliente_id) then
      raise exception 'cliente_loja_nao_encontrado' using errcode = 'P0001';
    end if;
  end if;

  -- O condicional tem de ser do cliente escolhido e estar aberto.
  if p_condicional_id is not null then
    select * into v_cond from condicionais c where c.id = p_condicional_id for update;
    if not found or v_pessoa.id is null or v_cond.cliente_loja_id <> v_pessoa.id
       or not public.eh_membro(v_cond.cliente_id) then
      raise exception 'condicional_nao_encontrado' using errcode = 'P0001';
    end if;
    if v_cond.situacao <> 'aberto' then
      raise exception 'condicional_ja_fechado' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_condicional_itens) c
       where not exists (select 1 from condicional_itens i
                          where i.condicional_id = v_cond.id and i.id = (c ->> 'item_id')::uuid)
    ) then
      raise exception 'condicional_nao_encontrado' using errcode = 'P0001';
    end if;
  end if;

  -- Peças de hoje.
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_venda := public.registrar_venda(
      (v_item ->> 'produto_id')::uuid,
      (v_item ->> 'quantidade')::numeric,
      (v_item ->> 'preco_unitario')::numeric,
      p_vendedor_id
    );
    -- Cliente de outra loja não pode entrar na venda desta.
    if v_pessoa.id is not null and v_pessoa.cliente_id <> v_venda.cliente_id then
      raise exception 'cliente_loja_nao_encontrado' using errcode = 'P0001';
    end if;
    update vendas
       set pedido_id = v_pedido, cliente_loja_id = v_pessoa.id, forma_pagamento = p_forma_pagamento
     where id = v_venda.id;
    v_vend_id := coalesce(v_vend_id, v_venda.vendedor_id);
    v_vend_nome := coalesce(v_vend_nome, v_venda.vendedor_nome);
  end loop;

  -- Peças do condicional: compradas agora; o resto volta ao estoque.
  if v_cond.id is not null then
    for v_ci in select * from condicional_itens i where i.condicional_id = v_cond.id for update loop
      v_soma := 0;
      for v_item in select * from jsonb_array_elements(p_condicional_itens) c
                     where (c ->> 'item_id')::uuid = v_ci.id loop
        v_qtd := (v_item ->> 'quantidade')::numeric;
        v_preco := coalesce((v_item ->> 'preco_unitario')::numeric, v_ci.preco_unitario);
        if v_qtd is null or v_qtd <= 0 then
          raise exception 'quantidade_invalida' using errcode = 'P0001', detail = v_ci.produto_nome;
        end if;
        if v_preco < 0 then
          raise exception 'preco_invalido' using errcode = 'P0001', detail = v_ci.produto_nome;
        end if;
        v_soma := v_soma + v_qtd;
        insert into vendas (cliente_id, produto_id, produto_nome, vendedor_id, vendedor_nome, quantidade,
                            preco_unitario, custo_unitario, pedido_id, cliente_loja_id, forma_pagamento)
        values (v_cond.cliente_id, v_ci.produto_id, v_ci.produto_nome, v_cond.vendedor_id, v_cond.vendedor_nome,
                v_qtd, v_preco, v_ci.custo_unitario, v_pedido, v_cond.cliente_loja_id, p_forma_pagamento);
      end loop;
      if v_soma > v_ci.quantidade then
        raise exception 'quantidade_invalida' using errcode = 'P0001', detail = v_ci.produto_nome;
      end if;

      update condicional_itens set comprado = v_soma, devolvido = quantidade - v_soma where id = v_ci.id;
      if v_ci.quantidade - v_soma > 0 and v_ci.produto_id is not null then
        update produtos set quantidade = quantidade + (v_ci.quantidade - v_soma) where id = v_ci.produto_id;
      end if;
    end loop;

    update condicionais
       set situacao = 'fechado', fechado_em = now(), pedido_id = v_pedido
     where id = v_cond.id;
    v_vend_id := coalesce(v_vend_id, v_cond.vendedor_id);
    v_vend_nome := coalesce(v_vend_nome, v_cond.vendedor_nome);
  end if;

  -- Pagou só uma parte: o resto fica em aberto no nome do cliente.
  if p_valor_pago is not null then
    select sum(quantidade * preco_unitario),
           sum(case when custo_unitario is not null then quantidade * (preco_unitario - custo_unitario) end),
           bool_or(custo_unitario is not null)
      into v_total, v_lucro, v_tem_custo
      from vendas where pedido_id = v_pedido;
    if p_valor_pago > v_total then
      raise exception 'valor_pago_invalido' using errcode = 'P0001';
    end if;
    v_aberto := round(v_total - p_valor_pago, 2);
    if v_aberto > 0 then
      if v_pessoa.id is null then
        raise exception 'em_aberto_sem_cliente' using errcode = 'P0001';
      end if;
      insert into contas_receber (cliente_id, cliente_loja_id, pedido_id, vendedor_id, vendedor_nome,
                                  valor_total, valor_aberto, lucro_aberto)
      values (v_pessoa.cliente_id, v_pessoa.id, v_pedido, v_vend_id, v_vend_nome, v_total, v_aberto,
              case when v_tem_custo then round(v_lucro * v_aberto / v_total, 2) end);
    end if;
  end if;

  return v_pedido;
end
$fn$;

revoke execute on function public.registrar_pedido(jsonb, uuid, uuid, text, uuid, jsonb, numeric) from public, anon;
grant  execute on function public.registrar_pedido(jsonb, uuid, uuid, text, uuid, jsonb, numeric) to authenticated;

-- ===== Receber o que está em aberto (ficha do cliente) =====
-- Abate das compras mais antigas para as mais novas. Devolve quanto ainda
-- falta depois deste pagamento.
create function public.receber_em_aberto(p_cliente_loja_id uuid, p_valor numeric, p_forma_pagamento text)
returns numeric
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_pessoa public.clientes_loja%rowtype;
  v_conta  public.contas_receber%rowtype;
  v_resta  numeric := round(p_valor, 2);
  v_parte  numeric;
  v_saldo  numeric;
begin
  select * into v_pessoa from clientes_loja c where c.id = p_cliente_loja_id;
  if not found or not public.eh_membro(v_pessoa.cliente_id) then
    raise exception 'cliente_loja_nao_encontrado' using errcode = 'P0001';
  end if;
  if p_forma_pagamento is null or p_forma_pagamento not in ('pix', 'credito', 'debito', 'dinheiro') then
    raise exception 'forma_pagamento_invalida' using errcode = 'P0001';
  end if;
  if v_resta is null or v_resta <= 0 then
    raise exception 'valor_pago_invalido' using errcode = 'P0001';
  end if;

  select coalesce(sum(valor_aberto - valor_recebido), 0) into v_saldo
    from contas_receber where cliente_loja_id = v_pessoa.id and quitado_em is null;
  if v_resta > v_saldo then
    raise exception 'valor_maior_que_em_aberto' using errcode = 'P0001';
  end if;

  for v_conta in select * from contas_receber
                  where cliente_loja_id = v_pessoa.id and quitado_em is null
                  order by criado_em, id for update loop
    exit when v_resta <= 0;
    v_parte := least(v_resta, v_conta.valor_aberto - v_conta.valor_recebido);
    insert into recebimentos (cliente_id, conta_id, valor, forma_pagamento)
    values (v_conta.cliente_id, v_conta.id, v_parte, p_forma_pagamento);
    update contas_receber
       set valor_recebido = valor_recebido + v_parte,
           quitado_em = case when valor_recebido + v_parte >= valor_aberto then now() end
     where id = v_conta.id;
    v_resta := v_resta - v_parte;
  end loop;

  return v_saldo - round(p_valor, 2);
end
$fn$;

revoke execute on function public.receber_em_aberto(uuid, numeric, text) from public, anon;
grant  execute on function public.receber_em_aberto(uuid, numeric, text) to authenticated;

-- ===== Desfazer venda com parte em aberto =====
-- Sem recebimento depois: o em aberto some junto com a venda. Com
-- recebimento: não desfaz (o dinheiro já entrou no caixa).
create or replace function public.desfazer_pedido(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_id uuid;
  v_achou boolean := false;
begin
  if exists (select 1 from contas_receber c join recebimentos r on r.conta_id = c.id where c.pedido_id = p_pedido_id) then
    raise exception 'venda_com_recebimento' using errcode = 'P0001';
  end if;
  for v_id in select v.id from vendas v where v.pedido_id = p_pedido_id loop
    perform public.desfazer_venda(v_id); -- confere eh_membro por linha
    v_achou := true;
  end loop;
  if not v_achou then
    raise exception 'venda_nao_encontrada' using errcode = 'P0001';
  end if;
  delete from contas_receber where pedido_id = p_pedido_id;
end
$fn$;

-- ===== Clientes com o que está em aberto =====
-- Tipo de retorno muda (coluna nova): drop + create.
drop function if exists public.clientes_loja_com_resumo(uuid);

create function public.clientes_loja_com_resumo(p_cliente_id uuid)
returns table (
  id uuid, nome text, telefone text, rua text, numero text, bairro text, endereco text, observacoes text,
  criado_em timestamptz, gasto numeric, pecas numeric, compras bigint, ultima_compra timestamptz,
  condicionais_abertos bigint, em_aberto numeric
)
language sql
stable security invoker
set search_path to 'public', 'pg_temp'
as $fn$
  select c.id, c.nome, c.telefone, c.rua, c.numero, c.bairro, c.endereco, c.observacoes, c.criado_em,
         coalesce(v.gasto, 0), coalesce(v.pecas, 0), coalesce(v.compras, 0), v.ultima_compra,
         (select count(*) from condicionais k where k.cliente_loja_id = c.id and k.situacao = 'aberto'),
         (select coalesce(sum(r.valor_aberto - r.valor_recebido), 0) from contas_receber r
           where r.cliente_loja_id = c.id and r.quitado_em is null)
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
