-- Forma de pagamento da venda: pix, crédito, débito ou dinheiro. Fica em
-- cada linha de `vendas` (como o pedido_id): todas as linhas da mesma compra
-- têm a mesma forma. Vendas antigas e as que saem do acerto do condicional
-- ficam sem (null).

alter table public.vendas
  add column forma_pagamento text
  constraint vendas_forma_pagamento_valida
  check (forma_pagamento is null or forma_pagamento in ('pix', 'credito', 'debito', 'dinheiro'));

-- ===== registrar_pedido com a forma de pagamento =====
-- Assinatura muda (novo parâmetro): sai a antiga para o PostgREST não ficar
-- com duas versões ambíguas. O parâmetro tem default, então a tela antiga
-- continua funcionando até o deploy; a tela nova exige a escolha.
drop function if exists public.registrar_pedido(jsonb, uuid, uuid);

create function public.registrar_pedido(
  p_itens jsonb,
  p_vendedor_id uuid default null,
  p_cliente_loja_id uuid default null,
  p_forma_pagamento text default null
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
begin
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'carrinho_vazio' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_itens) > 100 then
    raise exception 'carrinho_grande_demais' using errcode = 'P0001';
  end if;
  if p_forma_pagamento is not null and p_forma_pagamento not in ('pix', 'credito', 'debito', 'dinheiro') then
    raise exception 'forma_pagamento_invalida' using errcode = 'P0001';
  end if;
  if p_cliente_loja_id is not null then
    select * into v_pessoa from clientes_loja c where c.id = p_cliente_loja_id;
    if not found or not public.eh_membro(v_pessoa.cliente_id) then
      raise exception 'cliente_loja_nao_encontrado' using errcode = 'P0001';
    end if;
  end if;

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
  end loop;

  return v_pedido;
end
$fn$;

revoke execute on function public.registrar_pedido(jsonb, uuid, uuid, text) from public, anon;
grant  execute on function public.registrar_pedido(jsonb, uuid, uuid, text) to authenticated;
