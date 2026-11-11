import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { AlarmClock, Banknote, CalendarDays, Check, Minus, Plus, Search, ShoppingBag, Shirt, UserPlus } from 'lucide-react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { useCliente } from '@/context/useCliente'
import { traduzirErro } from '@/lib/erros'
import { classeEntrada } from '@/lib/classes'
import { dinheiro, lerNumero, paraCampo, quantidade as fmtQtd } from '@/lib/formato'
import { useCarrinho } from '@/hooks/useCarrinho'
import { useProdutos } from '@/hooks/useProdutos'
import CampoDeBipe from '@/components/vendas/CampoDeBipe'
import ListaDePecas from '@/components/vendas/ListaDePecas'
import Passo from '@/components/vendas/Passo'
import SeletorDeVendedor from '@/components/vendas/SeletorDeVendedor'
import Painel from '@/components/ui/Painel'
import { Avatar, BuscaCliente, CartaoCliente, FormCliente } from '@/components/clientes/PecasCliente'
import { CLIENTE_VAZIO, salvarCliente, useClientesDaLoja } from '@/pages/clientes/dados'
import { corDoVendedor, useVendedores } from '@/pages/vendas/dados'
import {
  dataCurta, diaLocal, diasEntre, prazo, somarDias, totaisDoCondicional, useCondicionais,
} from './dados'

// /:slug/condicional — o cliente leva peças para provar em casa.
//   Abrir: cliente (nome, telefone, endereço, sobre), datas, peças bipadas.
//          As peças saem do estoque.
//   Acertar: marca o que ele comprou → vira venda; o resto volta ao estoque.
// `children` deixa um cliente acrescentar algo sem copiar a tela.

const SELO_PRAZO = {
  atrasado: 'bg-danger/12 text-danger',
  hoje: 'bg-warn/12 text-warn',
  ok: 'bg-elevado text-texto-2',
}

export default function CondicionalPage({ children }) {
  const { cliente } = useCliente()
  const clienteId = cliente?.id
  const [aba, setAba] = useState('aberto')
  const [painel, setPainel] = useState(null) // null | { tipo: 'novo' } | { tipo: 'acerto', cond }
  const [busca, setBusca] = useState('')
  const abertos = useCondicionais(clienteId, 'aberto')
  const fechados = useCondicionais(clienteId, 'fechado')
  const { vendedores } = useVendedores(clienteId)
  const hoje = diaLocal()

  const resumo = useMemo(() => {
    let pecas = 0
    let valor = 0
    let atrasados = 0
    for (const c of abertos.lista) {
      const t = totaisDoCondicional(c)
      pecas += t.pecas
      valor += t.valor
      if (prazo(c, hoje)?.tipo === 'atrasado') atrasados += 1
    }
    return { abertos: abertos.lista.length, pecas, valor, atrasados }
  }, [abertos.lista, hoje])

  const lista = (aba === 'aberto' ? abertos : fechados).lista.filter((c) => {
    const q = busca.trim().toLowerCase()
    return !q || c.cliente?.nome.toLowerCase().includes(q) || c.cliente?.telefone?.includes(q)
  })

  if (!supabaseConfigurado) return <p className="text-sm text-texto-3">Banco não configurado (frontend/.env).</p>

  const atualizar = () => { abertos.recarregar(); fechados.recarregar() }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Condicional</h1>
          <p className="mt-1 text-sm text-texto-3">Peças que os clientes levaram para provar em casa.</p>
        </div>
        <button onClick={() => setPainel({ tipo: 'novo' })}
          className="flex items-center gap-2 rounded-xl bg-acento px-4 py-2.5 font-semibold text-sobre-acento shadow-lg shadow-acento/15 transition hover:brightness-110">
          <Plus size={18} /> Novo condicional
        </button>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Numero icone={ShoppingBag} rotulo="Em aberto" valor={fmtQtd(resumo.abertos)} />
        <Numero icone={Shirt} rotulo="Peças com clientes" valor={fmtQtd(resumo.pecas)} />
        <Numero icone={Banknote} rotulo="Valor fora da loja" valor={dinheiro(resumo.valor)} />
        <Numero icone={AlarmClock} rotulo="Atrasados" valor={fmtQtd(resumo.atrasados)}
          chip={resumo.atrasados ? 'bg-danger/12 text-danger' : undefined} />
      </div>

      <section className="rounded-2xl border border-borda bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda p-4 md:p-5">
          <div className="flex rounded-xl border border-borda-forte bg-fundo p-1">
            {[['aberto', 'Em aberto', abertos.lista.length], ['fechado', 'Acertados', null]].map(([chave, rotulo, n]) => (
              <button key={chave} onClick={() => setAba(chave)} aria-pressed={aba === chave}
                className={`rounded-lg px-3.5 py-1.5 text-sm transition ${aba === chave ? 'bg-acento font-semibold text-sobre-acento' : 'text-texto-2 hover:text-texto'}`}>
                {rotulo}{n !== null && <span className="ml-1.5 tabular-nums opacity-80">{n}</span>}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-3" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou telefone"
              aria-label="Buscar condicional" className={`${classeEntrada} py-2 pl-9`} />
          </div>
        </div>

        {(aba === 'aberto' ? abertos : fechados).carregando ? (
          <p className="p-6 text-sm text-texto-3">Carregando…</p>
        ) : lista.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-acento/12 text-acento"><ShoppingBag size={26} /></span>
            <p className="mt-4 font-semibold">{aba === 'aberto' ? 'Nenhum condicional em aberto' : 'Nenhum condicional acertado ainda'}</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-texto-3">
              {aba === 'aberto' ? 'Quando um cliente levar peças para provar, registre em “Novo condicional”.' : 'Os acertos aparecem aqui.'}
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-3">
            {lista.map((c) => (
              <CartaoCondicional key={c.id} cond={c} hoje={hoje} vendedores={vendedores}
                abrir={() => setPainel({ tipo: 'acerto', cond: c })} />
            ))}
          </ul>
        )}
      </section>

      {painel?.tipo === 'novo' && (
        <NovoCondicional clienteId={clienteId} vendedores={vendedores} fechar={() => setPainel(null)}
          verAberto={(pessoaId) => {
            const aberto = abertos.lista.find((k) => k.cliente_loja_id === pessoaId)
            if (aberto) setPainel({ tipo: 'acerto', cond: aberto })
          }}
          salvo={() => { setPainel(null); setAba('aberto'); atualizar() }} />
      )}
      {painel?.tipo === 'acerto' && (
        <Acerto cond={painel.cond} vendedores={vendedores} fechar={() => setPainel(null)}
          salvo={() => { setPainel(null); atualizar() }} />
      )}
      {children}
    </div>
  )
}

function Numero({ icone: Icone, rotulo, valor, chip = 'bg-acento/12 text-acento' }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-borda bg-card p-4">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${chip}`}><Icone size={19} aria-hidden /></span>
      <div className="min-w-0">
        <p className="truncate text-xs text-texto-3">{rotulo}</p>
        <p className="truncate text-lg font-bold tabular-nums">{valor}</p>
      </div>
    </div>
  )
}

// ── Cartão da lista ───────────────────────────────────────────────────────

function CartaoCondicional({ cond: c, hoje, vendedores, abrir }) {
  const t = totaisDoCondicional(c)
  const p = c.situacao === 'aberto' ? prazo(c, hoje) : null
  const dias = diasEntre(c.saiu_em, hoje)
  const comprado = (c.itens ?? []).reduce((s, i) => s + Number(i.comprado) * Number(i.preco_unitario), 0)

  return (
    <li>
      <button onClick={abrir}
        className={`flex h-full w-full flex-col rounded-2xl border bg-fundo/40 p-4 text-left transition hover:border-acento/50 hover:bg-elevado/40 ${
          p?.tipo === 'atrasado' ? 'border-danger/40' : 'border-borda'
        }`}>
        <div className="flex items-start gap-3">
          <Avatar nome={c.cliente?.nome} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{c.cliente?.nome ?? 'Cliente'}</p>
            {c.cliente?.telefone && <p className="truncate text-xs text-texto-3">{c.cliente.telefone}</p>}
          </div>
          {p && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${SELO_PRAZO[p.tipo]}`}>{p.texto}</span>
          )}
        </div>

        <ul className="mt-3 space-y-0.5 text-xs text-texto-2">
          {(c.itens ?? []).slice(0, 3).map((i) => <li key={i.id} className="truncate">{fmtQtd(i.quantidade)}× {i.produto_nome}</li>)}
          {(c.itens?.length ?? 0) > 3 && <li className="text-texto-3">e mais {c.itens.length - 3}</li>}
        </ul>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="text-xs text-texto-3">
            <span className="flex items-center gap-1">
              <CalendarDays size={12} /> pegou {dataCurta(c.saiu_em)}{c.situacao === 'aberto' && ` · há ${dias} dia${dias === 1 ? '' : 's'}`}
            </span>
            {c.vendedor_nome && (
              <span className="mt-0.5 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: corDoVendedor(vendedores, c.vendedor_id) }} /> {c.vendedor_nome}
              </span>
            )}
          </p>
          <div className="text-right">
            {c.situacao === 'aberto' ? (
              <>
                <p className="text-xs text-texto-3">{fmtQtd(t.pecas)} peça{t.pecas === 1 ? '' : 's'}</p>
                <p className="font-semibold tabular-nums">{dinheiro(t.valor)}</p>
              </>
            ) : (
              <>
                <p className="text-xs text-texto-3">comprou</p>
                <p className="font-semibold tabular-nums">{dinheiro(comprado)}</p>
              </>
            )}
          </div>
        </div>
      </button>
    </li>
  )
}

// ── Novo condicional ──────────────────────────────────────────────────────

function NovoCondicional({ clienteId, vendedores, fechar, salvo, verAberto }) {
  const clientes = useClientesDaLoja(clienteId)
  const carrinho = useCarrinho()
  const [pessoa, setPessoa] = useState(null) // cliente escolhido
  const [novo, setNovo] = useState(null) // campos do cliente (CLIENTE_VAZIO) quando cadastrando
  const [vendedorId, setVendedorId] = useState(null)
  const [saiuEm, setSaiuEm] = useState(diaLocal())
  const [devolverAte, setDevolverAte] = useState(somarDias(diaLocal(), 3))
  const [observacoes, setObservacoes] = useState('')
  const { produtos, recarregar: carregarProdutos } = useProdutos(clienteId) // guardada no navegador
  const [enviando, setEnviando] = useState(false)

  const ativos = vendedores.filter((v) => v.ativo)
  // Um condicional aberto por cliente (o banco também barra).
  const jaTemAberto = Number(pessoa?.condicionais_abertos) > 0

  async function registrar() {
    if (!pessoa && !novo?.nome.trim()) return toast.error('Escolha ou cadastre o cliente.')
    if (jaTemAberto) return toast.error(`${pessoa.nome} já está com um condicional em aberto. Acerte o atual primeiro.`)
    if (carrinho.itens.length === 0) return toast.error('Bipe as peças que o cliente vai levar.')
    if (carrinho.semPreco) return toast.error(`Informe o preço de ${carrinho.semPreco.produto.nome}.`)
    if (devolverAte && devolverAte < saiuEm) return toast.error('A devolução não pode ser antes do dia em que pegou.')

    setEnviando(true)
    let pessoaId = pessoa?.id
    if (!pessoaId) {
      const { data, error } = await salvarCliente(clienteId, novo)
      if (error) { setEnviando(false); return toast.error(traduzirErro(error)) }
      pessoaId = data.id
      setPessoa(data) // se a saída falhar, não cadastra o cliente de novo
      setNovo(null)
      clientes.recarregar()
    }

    const { error } = await supabase.rpc('abrir_condicional', {
      p_cliente_loja_id: pessoaId,
      p_itens: carrinho.paraEnviar(),
      p_vendedor_id: vendedorId,
      p_saiu_em: saiuEm,
      p_devolver_ate: devolverAte || null,
      p_observacoes: observacoes || null,
    })
    setEnviando(false)
    if (error) return toast.error(traduzirErro(error))
    toast.success(`Condicional registrado: ${fmtQtd(carrinho.pecas)} peça${carrinho.pecas === 1 ? '' : 's'} com ${pessoa?.nome ?? novo?.nome}.`)
    salvo()
    carregarProdutos() // o estoque mudou: a lista guardada busca a diferença
  }

  return (
    <Painel titulo="Novo condicional" fechar={fechar} rodape={
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-texto-3">{carrinho.pecas ? `${fmtQtd(carrinho.pecas)} peça${carrinho.pecas === 1 ? '' : 's'}` : 'Nenhuma peça'}</p>
          <p className="text-xl font-bold tabular-nums">{dinheiro(carrinho.total)}</p>
        </div>
        <button type="button" onClick={registrar} disabled={enviando || jaTemAberto}
          className="flex items-center gap-2 rounded-xl bg-acento px-5 py-3 font-semibold text-sobre-acento transition hover:brightness-110 disabled:opacity-50">
          <Check size={18} /> {enviando ? 'Registrando…' : 'Registrar saída'}
        </button>
      </div>
    }>
      {/* 1. Cliente */}
      <div>
        <Passo numero="1" titulo="Cliente" />
        <div className="mt-3">
          {pessoa ? (
            <div className="space-y-2">
              <CartaoCliente cliente={pessoa} trocar={() => setPessoa(null)} />
              {jaTemAberto && (
                <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
                  <p className="text-warn">{pessoa.nome} já está com um condicional em aberto. Só dá para levar peças de novo depois do acerto.</p>
                  <button type="button" onClick={() => verAberto(pessoa.id)} className="mt-2 font-semibold text-texto underline hover:text-acento">
                    Ver e acertar o condicional dele
                  </button>
                </div>
              )}
            </div>
          ) : novo ? (
            <div className="space-y-3 rounded-2xl border border-acento/40 bg-acento/5 p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold"><UserPlus size={16} className="text-acento" /> Cliente novo</p>
                <button type="button" onClick={() => setNovo(null)} className="text-xs text-texto-3 hover:text-texto">Cancelar</button>
              </div>
              <FormCliente valor={novo} mudar={setNovo} />
            </div>
          ) : (
            <BuscaCliente clientes={clientes.lista} escolher={setPessoa}
              cadastrar={(nome) => setNovo({ ...CLIENTE_VAZIO, nome })} />
          )}
        </div>
      </div>

      {/* 2. Quem atendeu */}
      {ativos.length > 0 && (
        <div>
          <Passo numero="2" titulo="Quem atendeu" extra={<span className="text-xs text-texto-3">opcional</span>} />
          <div className="mt-3">
            <SeletorDeVendedor vendedores={ativos} todos={vendedores} valor={vendedorId} aoMudar={setVendedorId} />
          </div>
        </div>
      )}

      {/* 3. Datas */}
      <div>
        <Passo numero={ativos.length ? '3' : '2'} titulo="Datas" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-texto-2">
            Pegou em
            <input type="date" value={saiuEm} max={diaLocal()} onChange={(e) => setSaiuEm(e.target.value)}
              className={`${classeEntrada} mt-1.5`} />
          </label>
          <label className="block text-sm font-medium text-texto-2">
            Devolver até
            <input type="date" value={devolverAte} min={saiuEm} onChange={(e) => setDevolverAte(e.target.value)}
              className={`${classeEntrada} mt-1.5`} />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[1, 3, 7].map((n) => (
            <button key={n} type="button" onClick={() => setDevolverAte(somarDias(saiuEm, n))}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                devolverAte === somarDias(saiuEm, n) ? 'border-acento bg-acento/12 text-texto' : 'border-borda-forte text-texto-2 hover:bg-elevado'
              }`}>
              {n} dia{n === 1 ? '' : 's'}
            </button>
          ))}
          <button type="button" onClick={() => setDevolverAte('')}
            className={`rounded-full border px-2.5 py-1 text-xs transition ${!devolverAte ? 'border-acento bg-acento/12 text-texto' : 'border-borda-forte text-texto-2 hover:bg-elevado'}`}>
            sem prazo
          </button>
        </div>
      </div>

      {/* 4. Peças */}
      <div className="space-y-3">
        <Passo numero={ativos.length ? '4' : '3'} titulo="Peças que ele vai levar" extra={carrinho.itens.length > 0 && (
          <button type="button" onClick={carrinho.limpar} className="text-xs text-texto-3 hover:text-texto">Limpar</button>
        )} />
        <CampoDeBipe produtos={produtos} aoEscolher={carrinho.adicionar} />
        <ListaDePecas carrinho={carrinho} vazio="Bipe as peças que o cliente vai levar" />
      </div>

      <label className="block text-sm font-medium text-texto-2">
        Observações <span className="font-normal text-texto-3">(opcional)</span>
        <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={1000} rows={2}
          placeholder="Ex.: vai decidir entre a calça preta e a azul" className={`${classeEntrada} mt-1.5 resize-none`} />
      </label>
    </Painel>
  )
}

// ── Acerto ────────────────────────────────────────────────────────────────

function Acerto({ cond: c, vendedores, fechar, salvo }) {
  const aberto = c.situacao === 'aberto'
  const itens = c.itens ?? []
  const [comprou, setComprou] = useState(() => Object.fromEntries(itens.map((i) => [i.id, Number(i.comprado) || 0])))
  // Preço de cada peça levada (texto do campo); muda = desconto na venda.
  const [precos, setPrecos] = useState(() => Object.fromEntries(itens.map((i) => [i.id, paraCampo(i.preco_unitario)])))
  const extras = useCarrinho() // peças a mais escolhidas no acerto
  const [adicionando, setAdicionando] = useState(false)
  const { produtos } = useProdutos(c.cliente_id) // guardada no navegador
  const [enviando, setEnviando] = useState(false)
  const hoje = diaLocal()
  const p = aberto ? prazo(c, hoje) : null


  const precoDe = (i) => lerNumero(precos[i.id]) ?? Number(i.preco_unitario)
  const totalLevadas = itens.reduce((s, i) => s + (comprou[i.id] ?? 0) * (precoDe(i) || 0), 0)
  const total = totalLevadas + extras.total
  const pecasCompra = Object.values(comprou).reduce((s, n) => s + n, 0) + extras.pecas
  const pecasVolta = itens.reduce((s, i) => s + Number(i.quantidade) - (comprou[i.id] ?? 0), 0)
  const mudar = (id, n, max) => setComprou((x) => ({ ...x, [id]: Math.max(0, Math.min(max, n)) }))
  const todos = (comprouTudo) => setComprou(Object.fromEntries(itens.map((i) => [i.id, comprouTudo ? Number(i.quantidade) : 0])))

  async function acertar() {
    const precoRuim = itens.find((i) => (comprou[i.id] ?? 0) > 0 && Number.isNaN(lerNumero(precos[i.id])))
    if (precoRuim) return toast.error(`Confira o preço de ${precoRuim.produto_nome}.`)
    if (extras.semPreco) return toast.error(`Informe o preço de ${extras.semPreco.produto.nome}.`)

    setEnviando(true)
    const { error } = await supabase.rpc('fechar_condicional', {
      p_condicional_id: c.id,
      p_compras: itens.filter((i) => (comprou[i.id] ?? 0) > 0)
        .map((i) => ({ item_id: i.id, quantidade: comprou[i.id], preco_unitario: precoDe(i) })),
      p_extras: extras.paraEnviar(),
    })
    setEnviando(false)
    if (error) return toast.error(traduzirErro(error))
    toast.success(pecasCompra
      ? `Acertado: venda de ${dinheiro(total)}; ${fmtQtd(pecasVolta)} peça${pecasVolta === 1 ? '' : 's'} de volta ao estoque.`
      : 'Acertado: todas as peças voltaram ao estoque.')
    salvo()
  }

  return (
    <Painel titulo={aberto ? 'Acertar condicional' : 'Condicional acertado'} fechar={fechar} rodape={
      aberto ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-texto-2">Comprou <strong className="text-texto tabular-nums">{fmtQtd(pecasCompra)}</strong> · volta ao estoque <strong className="text-texto tabular-nums">{fmtQtd(pecasVolta)}</strong></span>
            <span className="text-lg font-bold tabular-nums">{dinheiro(total)}</span>
          </div>
          <button type="button" onClick={acertar} disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-acento py-3 font-semibold text-sobre-acento transition hover:brightness-110 disabled:opacity-50">
            <Check size={18} /> {enviando ? 'Acertando…' : pecasCompra ? `Finalizar: vender ${dinheiro(total)}` : 'Finalizar: devolveu tudo'}
          </button>
        </div>
      ) : (
        <button type="button" onClick={fechar} className="w-full rounded-xl border border-borda-forte py-3 font-medium hover:bg-elevado">Fechar</button>
      )
    }>
      {c.cliente && <CartaoCliente cliente={c.cliente} />}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info rotulo="Pegou em" valor={`${dataCurta(c.saiu_em)} · há ${diasEntre(c.saiu_em, hoje)} dia${diasEntre(c.saiu_em, hoje) === 1 ? '' : 's'}`} />
        <Info rotulo="Devolver até" valor={c.devolver_ate ? dataCurta(c.devolver_ate) : 'sem prazo'}
          destaque={p?.tipo === 'atrasado' ? 'text-danger' : p?.tipo === 'hoje' ? 'text-warn' : undefined} />
        {c.vendedor_nome && (
          <Info rotulo="Atendeu" valor={
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: corDoVendedor(vendedores, c.vendedor_id) }} /> {c.vendedor_nome}
            </span>
          } />
        )}
        {!aberto && c.fechado_em && <Info rotulo="Acertado em" valor={new Date(c.fechado_em).toLocaleDateString('pt-BR')} />}
      </div>
      {c.observacoes && <p className="rounded-xl bg-elevado/60 px-3 py-2 text-sm text-texto-2">{c.observacoes}</p>}

      {/* Peças que ele levou */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">{aberto ? 'O que ele comprou?' : 'Peças que levou'}</p>
          {aberto && (
            <div className="flex gap-1.5 text-xs">
              <button type="button" onClick={() => todos(true)} className="rounded-full border border-borda-forte px-2.5 py-1 hover:bg-elevado">Comprou tudo</button>
              <button type="button" onClick={() => todos(false)} className="rounded-full border border-borda-forte px-2.5 py-1 hover:bg-elevado">Devolveu tudo</button>
            </div>
          )}
        </div>
        <ul className="divide-y divide-borda rounded-xl border border-borda">
          {itens.map((i) => {
            const qtd = Number(i.quantidade)
            const n = comprou[i.id] ?? 0
            const mudouPreco = aberto && n > 0 && precoDe(i) !== Number(i.preco_unitario)
            return (
              <li key={i.id} className="p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate text-sm font-medium">{i.produto_nome}</p>
                    <p className="text-xs text-texto-3">
                      levou {fmtQtd(qtd)} · {dinheiro(i.preco_unitario)} cada
                      {!aberto && ` · comprou ${fmtQtd(i.comprado)}, devolveu ${fmtQtd(i.devolvido)}`}
                    </p>
                  </div>
                  {aberto && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-texto-3">comprou</span>
                      <div className="flex items-center rounded-lg border border-borda-forte">
                        <button type="button" onClick={() => mudar(i.id, n - 1, qtd)} disabled={n <= 0} aria-label={`Menos um ${i.produto_nome}`}
                          className="grid h-8 w-8 place-items-center text-texto-2 hover:text-texto disabled:opacity-30"><Minus size={14} /></button>
                        <span className={`w-7 text-center text-sm font-semibold tabular-nums ${n ? 'text-acento' : ''}`}>{n}</span>
                        <button type="button" onClick={() => mudar(i.id, n + 1, qtd)} disabled={n >= qtd} aria-label={`Mais um ${i.produto_nome}`}
                          className="grid h-8 w-8 place-items-center text-texto-2 hover:text-texto disabled:opacity-30"><Plus size={14} /></button>
                      </div>
                      {/* Preço de venda (desconto): só faz sentido se comprou */}
                      <label className={`flex h-8 items-center rounded-lg border bg-fundo px-2 text-sm focus-within:border-acento ${n ? 'border-borda-forte' : 'border-borda opacity-40'}`}>
                        <span className="text-xs text-texto-3">R$</span>
                        <input inputMode="decimal" value={precos[i.id]} disabled={!n} aria-label={`Preço de ${i.produto_nome}`}
                          onChange={(e) => setPrecos((x) => ({ ...x, [i.id]: e.target.value }))}
                          className="w-16 bg-transparent pl-1 text-right tabular-nums outline-none" />
                      </label>
                    </div>
                  )}
                </div>
                {mudouPreco && (
                  <p className="mt-1 text-right text-xs text-warn">
                    {precoDe(i) < Number(i.preco_unitario) ? 'desconto de ' : 'acréscimo de '}
                    {dinheiro(Math.abs(Number(i.preco_unitario) - precoDe(i)) * n)}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
        {aberto && <p className="mt-2 text-xs text-texto-3">O que ele comprou vira venda (entra no dashboard e na ficha); o resto volta ao estoque.</p>}
      </div>

      {/* Peças a mais, escolhidas na hora do acerto */}
      {aberto && (
        adicionando || extras.itens.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Levou mais alguma peça?</p>
              {extras.itens.length === 0 && (
                <button type="button" onClick={() => setAdicionando(false)} className="text-xs text-texto-3 hover:text-texto">Cancelar</button>
              )}
            </div>
            <CampoDeBipe produtos={produtos} aoEscolher={extras.adicionar} />
            <ListaDePecas carrinho={extras} vazio="Bipe a peça que ele resolveu levar" />
            <p className="text-xs text-texto-3">Essas saem do estoque agora e entram na mesma venda.</p>
          </div>
        ) : (
          <button type="button" onClick={() => setAdicionando(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-borda-forte py-3 text-sm font-medium text-texto-2 transition hover:border-acento hover:text-acento">
            <Plus size={16} /> Adicionar outra peça
          </button>
        )
      )}
    </Painel>
  )
}

function Info({ rotulo, valor, destaque }) {
  return (
    <div className="rounded-xl border border-borda bg-fundo/40 px-3 py-2">
      <p className="text-xs text-texto-3">{rotulo}</p>
      <div className={`font-medium ${destaque ?? ''}`}>{valor}</div>
    </div>
  )
}
