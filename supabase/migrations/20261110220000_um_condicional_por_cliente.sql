-- Um cliente só pode ter UM condicional em aberto. Precisa acertar o atual
-- antes de levar peças de novo.
--
-- O índice garante a regra até com dois cadastros ao mesmo tempo; a checagem
-- na função dá a mensagem certa para a tela.

create unique index condicionais_um_aberto_por_cliente
  on public.condicionais(cliente_loja_id) where situacao = 'aberto';

create or replace function public.abrir_condicional(
  p_cliente_loja_id uuid,
  p_itens jsonb,
  p_vendedor_id uuid default null,
  p_saiu_em date default null,
  p_devolver_ate date default null,
  p_observacoes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_pessoa   public.clientes_loja%rowtype;
  v_vendedor public.vendedores%rowtype;
  v_cond     uuid;
  v_item     jsonb;
  v_produto  public.produtos%rowtype;
  v_qtd      numeric;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  select * into v_pessoa from clientes_loja c where c.id = p_cliente_loja_id;
  if not found or not public.eh_membro(v_pessoa.cliente_id) then
    raise exception 'cliente_loja_nao_encontrado' using errcode = 'P0001';
  end if;
  if exists (select 1 from condicionais k where k.cliente_loja_id = v_pessoa.id and k.situacao = 'aberto') then
    raise exception 'cliente_ja_tem_condicional' using errcode = 'P0001', detail = v_pessoa.nome;
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'carrinho_vazio' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_itens) > 100 then
    raise exception 'carrinho_grande_demais' using errcode = 'P0001';
  end if;

  if p_vendedor_id is not null then
    select * into v_vendedor from vendedores v
     where v.id = p_vendedor_id and v.cliente_id = v_pessoa.cliente_id and v.ativo;
    if not found then
      raise exception 'vendedor_invalido' using errcode = 'P0001';
    end if;
  end if;

  insert into condicionais (cliente_id, cliente_loja_id, vendedor_id, vendedor_nome, saiu_em, devolver_ate, observacoes)
  values (v_pessoa.cliente_id, v_pessoa.id, v_vendedor.id, v_vendedor.nome,
          coalesce(p_saiu_em, current_date), p_devolver_ate, nullif(btrim(coalesce(p_observacoes, '')), ''))
  returning id into v_cond;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    select * into v_produto from produtos p where p.id = (v_item ->> 'produto_id')::uuid for update;
    if not found or v_produto.cliente_id <> v_pessoa.cliente_id then
      raise exception 'produto_nao_encontrado' using errcode = 'P0001';
    end if;
    v_qtd := (v_item ->> 'quantidade')::numeric;
    if v_qtd is null or v_qtd <= 0 then
      raise exception 'quantidade_invalida' using errcode = 'P0001', detail = v_produto.nome;
    end if;
    if v_qtd > v_produto.quantidade then
      raise exception 'estoque_insuficiente' using errcode = 'P0001', detail = v_produto.nome;
    end if;

    update produtos set quantidade = quantidade - v_qtd where id = v_produto.id;
    insert into condicional_itens (condicional_id, cliente_id, produto_id, produto_nome, produto_codigo,
                                   quantidade, preco_unitario, custo_unitario)
    values (v_cond, v_pessoa.cliente_id, v_produto.id, v_produto.nome, v_produto.codigo, v_qtd,
            coalesce((v_item ->> 'preco_unitario')::numeric, v_produto.preco_venda, 0), v_produto.preco_custo);
  end loop;

  return v_cond;
end
$fn$;
