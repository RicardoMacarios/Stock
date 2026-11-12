import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Check, HandCoins, Pencil, Undo2, UserPlus, UserRound } from 'lucide-react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { useCliente } from '@/context/useCliente'
import { traduzirErro } from '@/lib/erros'
import { dinheiro, horaCurta, inicioDeHoje, lerNumero, quantidade as fmtQtd } from '@/lib/formato'
import { useCarrinho } from '@/hooks/useCarrinho'
import { useProdutos } from '@/hooks/useProdutos'
import { aplicarDesconto, lerPercentual, totalComDesconto } from '@/lib/desconto'
import SeletorDeDia from '@/components/ui/SeletorDeDia'
import CampoDeBipe from '@/components/vendas/CampoDeBipe'
import ListaDePecas from '@/components/vendas/ListaDePecas'
import Passo from '@/components/vendas/Passo'
import SeletorDeVendedor from '@/components/vendas/SeletorDeVendedor'
import SeletorDePagamento from '@/components/vendas/SeletorDePagamento'
import CondicionalNaVenda from '@/components/vendas/CondicionalNaVenda'
import EditarVenda from '@/components/vendas/EditarVenda'
import { rotuloPagamento } from '@/lib/pagamento'
import { totaisDoCondicional, useCondicionais } from '@/pages/condicional/dados'
import { BuscaCliente, CartaoCliente, FormCliente } from '@/components/clientes/PecasCliente'
import { CLIENTE_VAZIO, salvarCliente, useClientesDaLoja } from '@/pages/clientes/dados'
import { agruparPedidos, corDoVendedor, proximoDia, totaisDasVendas, useVendasDeHoje, useVendasDoDia, useVendedores } from './dados'

// /:slug/vendas — o caixa. Escolhe o vendedor, bipa as peças (pistola ou
// câmera) num carrinho e finaliza: o banco grava tudo de uma vez e baixa o
// estoque (registrar_pedido: tudo ou nada). Ao lado, as vendas do dia: abre
// em hoje e dá para voltar a ontem (ou qualquer dia) para conferir e desfazer.
// `children` deixa um cliente acrescentar algo sem copiar a tela.
export default function VendasPage({ children }) {
  const { cliente, slug, ehDono } = useCliente()
  const clienteId = cliente?.id
  const { vendedores } = useVendedores(clienteId)
  const hoje = useVendasDeHoje(clienteId)
  // Dia do painel da direita. Em "hoje" usa a mesma leitura do topo; outro
  // dia lê à parte (clienteId null = não lê nada).
  const meiaNoite = inicioDeHoje().getTime()
  const [dia, setDia] = useState(meiaNoite)
  const diaEfetivo = Math.min(dia, meiaNoite) // virou o dia com a tela aberta
  const ehHoje = diaEfetivo === meiaNoite
  const outroDia = useVendasDoDia(ehHoje ? null : clienteId, diaEfetivo)
  const doDia = ehHoje ? hoje : outroDia
  // Lista guardada no navegador: abre na hora e busca só o que mudou.
  const { produtos, recarregar: carregarProdutos } = useProdutos(clienteId)

  if (!supabaseConfigurado) {
    return <p className="text-sm text-texto-3">Banco não configurado (frontend/.env).</p>
  }

  const atualizar = () => { hoje.recarregar(); if (!ehHoje) outroDia.recarregar(); carregarProdutos() }
  // Venda nova é sempre de hoje: o painel volta para hoje para ela aparecer.
  const finalizou = () => { setDia(meiaNoite); atualizar() }
  const totais = totaisDasVendas(hoje.vendas)
  const data = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-texto-3 first-letter:uppercase">{data}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Vendas</h1>
        </div>
        <div className="flex gap-2 text-sm">
          <Resumo rotulo="Vendido hoje" valor={dinheiro(totais.valor)} />
          <Resumo rotulo="Peças" valor={fmtQtd(totais.pecas)} />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-5 lg:items-start lg:gap-6">
        <div className="lg:col-span-3">
          <Caixa clienteId={clienteId} produtos={produtos} vendedores={vendedores.filter((v) => v.ativo)} todosVendedores={vendedores}
            slug={slug} ehDono={ehDono} finalizou={finalizou} />
        </div>
        <div className="lg:col-span-2">
          <VendasDoDia {...doDia} dia={diaEfetivo} hoje={meiaNoite} setDia={setDia} vendedores={vendedores} desfez={atualizar} />
        </div>
      </div>
      {children}
    </div>
  )
}

function Resumo({ rotulo, valor }) {
  return (
    <div className="rounded-xl border border-borda bg-card px-3.5 py-2">
      <p className="text-xs text-texto-3">{rotulo}</p>
      <p className="font-semibold tabular-nums">{valor}</p>
    </div>
  )
}

// ── Caixa ─────────────────────────────────────────────────────────────────

function Caixa({ clienteId, produtos, vendedores, todosVendedores, slug, ehDono, finalizou }) {
  const [vendedorId, setVendedorId] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const carrinho = useCarrinho()
  const precisaVendedor = vendedores.length > 0
  const [pessoa, setPessoa] = useState(null) // cliente da compra (opcional)
  const [desconto, setDesconto] = useState('') // % sobre a compra inteira
  const [pagamento, setPagamento] = useState(null) // pix | credito | debito | dinheiro
  const [parcial, setParcial] = useState(false) // pagou só uma parte; o resto fica em aberto
  const [valorPago, setValorPago] = useState('')
  const pct = lerPercentual(desconto)
  const descontoInvalido = desconto.trim() !== '' && pct === null

  // Condicional em aberto do cliente escolhido (no máximo um por cliente):
  // a tela pergunta se cobra junto. A escolha vale só para aquele condicional.
  const abertos = useCondicionais(clienteId, 'aberto')
  const [escolhaCond, setEscolhaCond] = useState(null) // { id, juntar }
  const cond = pessoa ? abertos.lista.find((c) => c.cliente_loja_id === pessoa.id) ?? null : null
  const juntar = cond && escolhaCond?.id === cond.id ? escolhaCond.juntar : null
  const doCond = juntar ? totaisDoCondicional(cond) : { pecas: 0, valor: 0 }

  const bruto = carrinho.total + doCond.valor
  const total = totalComDesconto(bruto, pct)
  const pecas = carrinho.pecas + doCond.pecas
  const temAlgo = carrinho.itens.length > 0 || Boolean(juntar)

  // Pagou só uma parte: em centavos, para não errar a conta.
  const pago = parcial ? lerNumero(valorPago) : null
  const pagoValido = !parcial || (pago !== null && !Number.isNaN(pago) && pago >= 0 && Math.round(pago * 100) < Math.round(total * 100))
  const emAberto = parcial && pagoValido ? Math.round((total - pago) * 100) / 100 : 0

  function limpar() {
    carrinho.limpar()
    setDesconto('')
  }

  async function finalizar() {
    if (precisaVendedor && !vendedorId) return toast.error('Escolha quem vendeu.')
    if (cond && juntar === null) return toast.error(`${pessoa.nome} tem um condicional em aberto: escolha se entra nesta venda.`)
    if (!temAlgo) return toast.error('Bipe ou escolha pelo menos uma peça.')
    if (carrinho.semPreco) return toast.error(`Informe o preço de ${carrinho.semPreco.produto.nome}.`)
    if (descontoInvalido) return toast.error('O desconto deve ficar entre 0 e 100%.')
    if (parcial && !pessoa) return toast.error('Para deixar valor em aberto, escolha o cliente da compra.')
    if (!pagoValido) return toast.error(`Informe quanto ele pagou agora (menos que ${dinheiro(total)}).`)
    if (!pagamento && !(parcial && pago === 0)) return toast.error('Escolha a forma de pagamento.')

    // O desconto vale para a conta toda (peças de hoje + condicional).
    const linhas = aplicarDesconto([
      ...carrinho.paraEnviar(),
      ...(juntar ? cond.itens.map((i) => ({ item_id: i.id, quantidade: Number(i.quantidade), preco_unitario: Number(i.preco_unitario) })) : []),
    ], pct)

    setEnviando(true)
    const { error } = await supabase.rpc('registrar_pedido', {
      p_itens: linhas.filter((l) => !l.item_id), p_vendedor_id: vendedorId, p_cliente_loja_id: pessoa?.id ?? null,
      p_forma_pagamento: pagamento,
      p_condicional_id: juntar ? cond.id : null, p_condicional_itens: linhas.filter((l) => l.item_id),
      p_valor_pago: parcial ? pago : null,
    })
    setEnviando(false)
    if (error) return toast.error(traduzirErro(error))
    const vendedor = vendedores.find((v) => v.id === vendedorId)
    const comoPagou = parcial
      ? `pagou ${dinheiro(pago)}${pagamento ? ` (${rotuloPagamento(pagamento)})` : ''}, ficam ${dinheiro(emAberto)} em aberto`
      : rotuloPagamento(pagamento)
    toast.success(`Venda de ${dinheiro(total)} registrada${pct ? ` (${desconto.trim()}% de desconto)` : ''}${juntar ? ' com o condicional' : ''} · ${comoPagou}${vendedor ? ` · ${vendedor.nome}` : ''}`,
      { duration: parcial ? 6000 : undefined })
    limpar()
    setPessoa(null) // a próxima compra é de outra pessoa
    setPagamento(null) // e cada uma paga de um jeito
    setParcial(false)
    setValorPago('')
    setEscolhaCond(null)
    if (juntar) abertos.recarregar()
    finalizou()
    // O vendedor fica escolhido: o mesmo costuma atender várias seguidas.
  }

  return (
    <section className="rounded-2xl border border-borda bg-card">
      {/* 1. Vendedor */}
      <div className="border-b border-borda p-4 md:p-5">
        <Passo numero="1" titulo="Quem vendeu?" />
        <div className="mt-3">
          {precisaVendedor ? (
            <SeletorDeVendedor vendedores={vendedores} todos={todosVendedores} valor={vendedorId} aoMudar={setVendedorId} />
          ) : (
            <p className="flex items-center gap-2 text-sm text-texto-3">
              <UserRound size={16} /> Nenhum vendedor cadastrado.{' '}
              {ehDono
                ? <Link to={`/${slug}/configuracoes`} className="text-acento hover:underline">Cadastrar em Configurações</Link>
                : 'O dono cadastra em Configurações.'}
            </p>
          )}
        </div>
      </div>

      {/* Cliente (opcional): a compra entra na ficha dele */}
      <ClienteDaCompra clienteId={clienteId} pessoa={pessoa} setPessoa={setPessoa} />
      {cond && (
        <CondicionalNaVenda cond={cond} juntar={juntar} slug={slug}
          aoEscolher={(v) => setEscolhaCond({ id: cond.id, juntar: v })} />
      )}

      {/* 2. Peças */}
      <div className="space-y-4 p-4 md:p-5">
        <Passo numero="2" titulo="Peças" extra={carrinho.itens.length > 0 && (
          <button type="button" onClick={limpar} className="text-xs text-texto-3 hover:text-texto">Limpar</button>
        )} />
        <CampoDeBipe produtos={produtos} aoEscolher={carrinho.adicionar} />
        {produtos?.length === 0 && (
          <p className="text-sm text-texto-3">
            Nenhum produto cadastrado. <Link to={`/${slug}/produtos`} className="text-acento hover:underline">Cadastrar produtos</Link>
          </p>
        )}
        <ListaDePecas carrinho={carrinho} vazio="Bipe as peças da compra" />
      </div>

      {/* 3. Pagamento */}
      <div className="border-t border-borda p-4 md:p-5">
        <Passo numero="3" titulo="Pagamento" />
        <div className="mt-3">
          <SeletorDePagamento valor={pagamento} aoMudar={setPagamento} />
        </div>
        <PagouParte parcial={parcial} setParcial={setParcial} valor={valorPago} setValor={setValorPago}
          valido={pagoValido} emAberto={emAberto} pessoa={pessoa} />
      </div>

      {/* Total + finalizar: no celular gruda logo acima das abas de baixo, que têm
          altura fixa de 4rem (ClienteLayout). Fundo sólido: nada aparece por trás. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 in-data-[teclado=aberto]:bottom-0 rounded-b-2xl border-t border-borda bg-card px-4 py-3 shadow-[0_-8px_16px_-8px_rgb(0_0_0/0.5)] md:p-5 lg:static lg:shadow-none">
        {temAlgo && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm md:mb-3">
            <label className="flex items-center gap-2">
              <span className="text-texto-2">Desconto</span>
              <span className={`flex h-7 items-center rounded-lg border bg-fundo px-2 focus-within:border-acento ${descontoInvalido ? 'border-danger' : 'border-borda-forte'}`}>
                <input inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0"
                  aria-label="Desconto em porcentagem" className="w-10 bg-transparent text-right tabular-nums outline-none" />
                <span className="pl-1 text-xs text-texto-3">%</span>
              </span>
            </label>
            {pct > 0 && (
              <p className="text-xs text-texto-3 tabular-nums">
                {dinheiro(bruto)} <span className="text-danger">− {dinheiro(bruto - total)}</span>
              </p>
            )}
            {descontoInvalido && <p className="text-xs text-danger">Use de 0 a 100%</p>}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-texto-3">
              {pecas ? `${fmtQtd(pecas)} peça${pecas === 1 ? '' : 's'}` : 'Total'}
              {juntar && ` · ${fmtQtd(doCond.pecas)} do condicional`}
            </p>
            <p className="text-xl font-bold leading-tight tracking-tight tabular-nums md:text-3xl">
              {pct > 0 && <span className="mr-2 align-middle text-base font-normal text-texto-3 line-through">{dinheiro(bruto)}</span>}
              {dinheiro(total)}
            </p>
          </div>
          <button type="button" onClick={finalizar} disabled={enviando || !temAlgo}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-acento px-4 py-2.5 font-semibold text-sobre-acento shadow-lg shadow-acento/20 transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none md:px-6">
            <Check size={18} /> {enviando ? 'Registrando…' : 'Finalizar venda'}
          </button>
        </div>
      </div>
    </section>
  )
}

// ── Pagou só uma parte ────────────────────────────────────────────────────
// Ex.: compra de R$ 90, pagou R$ 40 agora → R$ 50 ficam em aberto no nome do
// cliente, e ele paga o resto pela ficha (Clientes).

function PagouParte({ parcial, setParcial, valor, setValor, valido, emAberto, pessoa }) {
  if (!parcial) {
    return (
      <button type="button" onClick={() => setParcial(true)}
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-texto-3 hover:text-acento">
        <HandCoins size={14} aria-hidden /> Pagou só uma parte? Deixar o resto em aberto
      </button>
    )
  }
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-warn/40 bg-warn/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-texto-2">Pagou agora</span>
          <span className={`flex h-9 items-center rounded-lg border bg-fundo px-2 focus-within:border-acento ${valor.trim() && !valido ? 'border-danger' : 'border-borda-forte'}`}>
            <span className="text-xs text-texto-3">R$</span>
            <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" autoFocus
              aria-label="Valor pago agora" className="w-20 bg-transparent pl-1 text-right tabular-nums outline-none" />
          </span>
        </label>
        <button type="button" onClick={() => { setParcial(false); setValor('') }} className="text-xs text-texto-3 hover:text-texto">
          Pagou tudo
        </button>
      </div>
      {!pessoa ? (
        <p className="text-xs text-warn">Escolha o cliente acima: o valor em aberto fica no nome dele.</p>
      ) : valido && valor.trim() ? (
        <p className="text-sm">
          Fica em aberto: <strong className="tabular-nums">{dinheiro(emAberto)}</strong>
          <span className="text-texto-3"> no nome de {pessoa.nome}</span>
        </p>
      ) : (
        <p className="text-xs text-texto-3">Quanto ele pagou agora (menos que o total). A forma de pagamento acima vale para esse valor.</p>
      )}
    </div>
  )
}

// ── Cliente da compra (opcional) ──────────────────────────────────────────
// Fechado: só um botão "Adicionar cliente". Escolhido: cartão com a ficha.
// Cadastrar ali mesmo salva na hora e já escolhe.

function ClienteDaCompra({ clienteId, pessoa, setPessoa }) {
  const clientes = useClientesDaLoja(clienteId)
  const [modo, setModo] = useState(null) // null | 'buscar' | 'novo'
  const [novo, setNovo] = useState(CLIENTE_VAZIO)
  const [salvando, setSalvando] = useState(false)

  async function cadastrar() {
    if (!novo.nome.trim()) return toast.error('Informe o nome do cliente.')
    setSalvando(true)
    const { data, error } = await salvarCliente(clienteId, novo)
    setSalvando(false)
    if (error) return toast.error(traduzirErro(error))
    setPessoa(data)
    setModo(null)
    setNovo(CLIENTE_VAZIO)
    clientes.recarregar()
  }

  return (
    <div className="border-b border-borda p-4 md:p-5">
      <Passo numero="·" titulo="Cliente" extra={<span className="text-xs text-texto-3">opcional · a compra entra na ficha</span>} />
      <div className="mt-3">
        {pessoa ? (
          <CartaoCliente cliente={clientes.lista.find((c) => c.id === pessoa.id) ?? pessoa} trocar={() => setPessoa(null)} />
        ) : modo === 'novo' ? (
          <div className="space-y-3 rounded-2xl border border-acento/40 bg-acento/5 p-4">
            <FormCliente valor={novo} mudar={setNovo} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setModo('buscar')} className="flex-1 rounded-xl border border-borda-forte py-2.5 text-sm text-texto-2 hover:bg-elevado">Voltar</button>
              <button type="button" onClick={cadastrar} disabled={salvando}
                className="flex-[2] rounded-xl bg-acento py-2.5 text-sm font-semibold text-sobre-acento disabled:opacity-60">
                {salvando ? 'Salvando…' : 'Cadastrar e usar'}
              </button>
            </div>
          </div>
        ) : modo === 'buscar' ? (
          <div className="space-y-2">
            <BuscaCliente clientes={clientes.lista} compacto
              escolher={(c) => { setPessoa(c); setModo(null) }}
              cadastrar={(nome) => { setNovo({ ...CLIENTE_VAZIO, nome }); setModo('novo') }} />
            <button type="button" onClick={() => setModo(null)} className="text-xs text-texto-3 hover:text-texto">Venda sem cliente</button>
          </div>
        ) : (
          <button type="button" onClick={() => setModo('buscar')}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-borda-forte py-2.5 text-sm text-texto-2 transition hover:border-acento hover:text-acento">
            <UserPlus size={16} /> Adicionar cliente
          </button>
        )}
      </div>
    </div>
  )
}

// ── Vendas do dia ─────────────────────────────────────────────────────────

function VendasDoDia({ vendas, carregando, erro, dia, hoje, setDia, vendedores, desfez }) {
  const [confirmando, setConfirmando] = useState(null)
  const [editando, setEditando] = useState(null) // pedido aberto no painel de edição
  const pedidos = agruparPedidos(vendas)
  const totais = totaisDasVendas(vendas)
  const ehHoje = dia === hoje
  const nome = ehHoje ? 'hoje' : dia === proximoDia(hoje, -1) ? 'ontem'
    : new Date(dia).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  async function desfazer(id) {
    const { error } = await supabase.rpc('desfazer_pedido', { p_pedido_id: id })
    setConfirmando(null)
    if (error) return toast.error(traduzirErro(error))
    toast.success('Venda desfeita; as peças voltaram ao estoque.')
    desfez()
  }

  return (
    <section className="rounded-2xl border border-borda bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">Vendas {ehHoje || nome === 'ontem' ? `de ${nome}` : 'do dia'}</h2>
          <p className="text-xs text-texto-3 first-letter:uppercase">
            {!ehHoje && nome !== 'ontem' && <>{nome} · </>}
            {pedidos.length} venda{pedidos.length === 1 ? '' : 's'}
            {pedidos.length > 0 && <> · {dinheiro(totais.valor)}</>}
          </p>
        </div>
        <SeletorDeDia dia={dia} hoje={hoje} setDia={setDia} />
      </div>

      {carregando ? (
        <p className="py-8 text-sm text-texto-3">Carregando…</p>
      ) : erro ? (
        <p className="py-8 text-center text-sm text-danger">Não foi possível carregar as vendas desse dia.</p>
      ) : pedidos.length === 0 ? (
        <p className="py-8 text-center text-sm text-texto-3">{ehHoje ? 'Nenhuma venda hoje ainda.' : 'Nenhuma venda nesse dia.'}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {pedidos.map((p) => {
            const cor = corDoVendedor(vendedores, p.vendedor_id)
            return (
              <li key={p.id} className="rounded-xl border border-borda bg-fundo/40 p-3">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-fundo" style={{ background: cor }}>
                    {(p.vendedor_nome ?? '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium">{p.vendedor_nome ?? 'Sem vendedor'}</p>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">{dinheiro(p.total)}</p>
                    </div>
                    <p className="text-xs text-texto-3">
                      {horaCurta(p.vendido_em)} · {fmtQtd(p.pecas)} peça{Number(p.pecas) === 1 ? '' : 's'}
                      {p.forma_pagamento && ` · ${rotuloPagamento(p.forma_pagamento)}`}
                    </p>
                    <ul className="mt-1.5 space-y-0.5 text-xs text-texto-2">
                      {p.itens.map((i) => (
                        <li key={i.id} className="truncate">{fmtQtd(i.quantidade)}× {i.produto_nome}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {confirmando === p.id ? (
                  <div className="mt-2 flex items-center justify-end gap-3 text-xs">
                    <span className="text-texto-2">Desfazer e devolver ao estoque?</span>
                    <button onClick={() => desfazer(p.id)} className="rounded-md bg-danger px-2 py-1 font-semibold text-fundo">Desfazer</button>
                    <button onClick={() => setConfirmando(null)} className="text-texto-3 hover:text-texto">Não</button>
                  </div>
                ) : (
                  <div className="mt-1 flex justify-end gap-4">
                    <button onClick={() => setEditando(p)} className="inline-flex items-center gap-1 text-xs text-texto-3 hover:text-texto">
                      <Pencil size={12} /> Editar
                    </button>
                    <button onClick={() => setConfirmando(p.id)} className="inline-flex items-center gap-1 text-xs text-texto-3 hover:text-texto">
                      <Undo2 size={12} /> Desfazer
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {editando && (
        <EditarVenda pedido={editando} vendedores={vendedores} fechar={() => setEditando(null)}
          salvou={() => { setEditando(null); desfez() }} />
      )}
    </section>
  )
}
