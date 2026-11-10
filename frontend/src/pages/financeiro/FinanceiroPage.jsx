import { useState } from 'react'
import {
  ArrowDownRight, ArrowUpRight, Banknote, ChevronLeft, ChevronRight, Crown, Receipt, RefreshCw, Shirt,
  TrendingUp, TriangleAlert,
} from 'lucide-react'
import { supabaseConfigurado } from '@/lib/supabase'
import { useCliente } from '@/context/useCliente'
import { dinheiro, inicioDeHoje, quantidade as fmtQtd } from '@/lib/formato'
import { totaisDasVendas, useVendedores } from '@/pages/vendas/dados'
import GraficoDoMes from './GraficoDoMes'
import DiasDaSemana from './DiasDaSemana'
import {
  diasDecorridos, inicioDoMes, maisVendidos, mediaPorDiaDaSemana, mesmoPeriodo, rankingDeVendedores, somarMeses, useVendasDoMes, variacao, vendasPorDia,
} from './dados'

// Financeiro (/:slug/financeiro): o mês inteiro de uma vez — quanto vendeu,
// quanto lucrou, quem mais vendeu e como foi cada dia. O dashboard fica com o
// dia; aqui é o mês. `children` deixa um cliente acrescentar algo sem copiar:
//   src/clientes/<slug>/paginas/FinanceiroPage.jsx → <Base>…</Base>

export default function FinanceiroPage({ children }) {
  const { cliente } = useCliente()
  const atual = inicioDoMes()
  const [mes, setMes] = useState(atual)
  const mesEfetivo = Math.min(mes, atual) // virou o mês com a tela aberta
  const { vendas, anterior, erro, carregando, recarregar } = useVendasDoMes(cliente?.id, mesEfetivo)
  const { vendedores } = useVendedores(cliente?.id)

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Cabecalho mes={mesEfetivo} atual={atual} setMes={setMes} />

      {!supabaseConfigurado && (
        <p className="rounded-xl border border-borda bg-card px-4 py-3 text-sm text-texto-2">
          Dados de exemplo: o banco não está configurado (frontend/.env).
        </p>
      )}

      {erro ? <Erro recarregar={recarregar} />
        : carregando ? <Esqueleto />
          : <Conteudo vendas={vendas} anterior={anterior} vendedores={vendedores} mes={mesEfetivo} ehAtual={mesEfetivo === atual} />}

      {children}
    </div>
  )
}

function Cabecalho({ mes, atual, setMes }) {
  const nome = new Date(mes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const botao = 'grid h-10 w-10 place-items-center text-texto-2 transition hover:bg-elevado hover:text-texto disabled:opacity-30 disabled:hover:bg-transparent'
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm text-texto-3">Financeiro</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight first-letter:uppercase md:text-3xl">{nome}</h1>
      </div>
      <div className="flex items-center overflow-hidden rounded-xl border border-borda-forte bg-card">
        <button type="button" onClick={() => setMes(somarMeses(mes, -1))} aria-label="Mês anterior" className={botao}>
          <ChevronLeft size={18} />
        </button>
        <button type="button" onClick={() => setMes(atual)} disabled={mes === atual}
          className="h-10 min-w-28 border-x border-borda px-3 text-sm font-semibold transition hover:bg-elevado disabled:cursor-default disabled:hover:bg-transparent">
          {mes === atual ? 'Este mês' : 'Voltar a este mês'}
        </button>
        <button type="button" onClick={() => setMes(somarMeses(mes, 1))} disabled={mes >= atual} aria-label="Próximo mês" className={botao}>
          <ChevronRight size={18} />
        </button>
      </div>
    </header>
  )
}

function Conteudo({ vendas, anterior, vendedores, mes, ehAtual }) {
  const t = totaisDasVendas(vendas)
  // Mês em andamento compara com o mesmo pedaço do mês anterior.
  const a = totaisDasVendas(ehAtual ? mesmoPeriodo(anterior, mes) : anterior)
  const margem = t.valor > 0 && t.semCusto < t.linhas ? Math.round((t.lucro / t.valor) * 100) : null
  const ranking = rankingDeVendedores(vendas, vendedores)
  const hoje = inicioDeHoje().getTime()
  const dias = vendasPorDia(vendas, mes)
  const mesAnterior = somarMeses(mes, -1)
  const diasAnterior = vendasPorDia(anterior, mesAnterior)
  const nomeAnterior = new Date(somarMeses(mes, -1)).toLocaleDateString('pt-BR', { month: 'long' })
  const comparado = ehAtual ? `vs. mesmo período de ${nomeAnterior}` : `vs. ${nomeAnterior}`

  return (
    <>
      {/* Faixa principal: faturamento e lucro grandes, com a comparação */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Destaque rotulo="Vendido no mês" icone={Banknote} valor={dinheiro(t.valor)}
          delta={variacao(t.valor, a.valor)} comparado={comparado}
          rodape={`${fmtQtd(t.vendas)} venda${t.vendas === 1 ? '' : 's'} · ${fmtQtd(t.pecas)} peça${t.pecas === 1 ? '' : 's'}`} />
        <Destaque rotulo="Lucro do mês" icone={TrendingUp} valor={dinheiro(t.lucro)} forte
          delta={variacao(t.lucro, a.lucro)} comparado={comparado}
          rodape={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {margem !== null ? <span>margem de <strong className="text-texto">{margem}%</strong></span> : <span>valor vendido menos o custo</span>}
              {t.semCusto > 0 && (
                <span className="flex items-center gap-1 text-warn">
                  <TriangleAlert size={12} aria-hidden /> {t.semCusto} venda{t.semCusto === 1 ? '' : 's'} sem custo cadastrado
                </span>
              )}
            </span>
          } />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Numero rotulo="Peças vendidas" valor={fmtQtd(t.pecas)} icone={Shirt} delta={variacao(t.pecas, a.pecas)} />
        <Numero rotulo="Vendas" valor={fmtQtd(t.vendas)} icone={Receipt} delta={variacao(t.vendas, a.vendas)} />
        <Numero rotulo="Ticket médio" valor={dinheiro(t.vendas ? t.valor / t.vendas : 0)} icone={Banknote}
          delta={variacao(t.vendas ? t.valor / t.vendas : 0, a.vendas ? a.valor / a.vendas : 0)} />
        <Numero rotulo="Peças por venda" valor={(t.vendas ? t.pecas / t.vendas : 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
          icone={Shirt} delta={variacao(t.vendas ? t.pecas / t.vendas : 0, a.vendas ? a.pecas / a.vendas : 0)} />
      </div>

      <GraficoDoMes dias={dias} diasAnterior={diasAnterior} vendas={vendas} vendedores={vendedores}
        mes={mes} hoje={hoje} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <VendedorDoMes ranking={ranking} totalPecas={t.pecas} className="lg:col-span-3" />
        <MaisVendidos itens={maisVendidos(vendas)} className="lg:col-span-2" />
      </div>

      <DiasDaSemana semana={mediaPorDiaDaSemana(dias, mes, diasDecorridos(mes, hoje))}
        semanaAnterior={mediaPorDiaDaSemana(diasAnterior, mesAnterior, diasAnterior.length)} nomeAnterior={nomeAnterior} />
    </>
  )
}

// ── Cartões ───────────────────────────────────────────────────────────────

function Destaque({ rotulo, icone: Icone, valor, delta, comparado, rodape, forte = false }) {
  return (
    <div className={`surgir relative overflow-hidden rounded-2xl border p-6 ${
      forte ? 'border-acento/40 bg-gradient-to-br from-acento/20 via-card to-card' : 'border-borda bg-card'}`}>
      <div aria-hidden className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl ${forte ? 'bg-acento/25' : 'bg-acento/8'}`} />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`grid h-11 w-11 place-items-center rounded-xl ${forte ? 'bg-acento text-sobre-acento' : 'bg-acento/12 text-acento'}`}>
            <Icone size={22} aria-hidden />
          </span>
          <p className="font-medium text-texto-2">{rotulo}</p>
        </div>
        <Variacao delta={delta} />
      </div>
      <p className="relative mt-5 text-4xl font-bold tracking-tight tabular-nums lg:text-5xl">{valor}</p>
      <div className="relative mt-2 text-sm text-texto-3">{rodape}</div>
      {delta !== null && <p className="relative mt-3 text-xs text-texto-3">{comparado}</p>}
    </div>
  )
}

function Numero({ rotulo, valor, icone: Icone, delta }) {
  return (
    <div className="rounded-2xl border border-borda bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm text-texto-2">
          <Icone size={16} className="text-acento" aria-hidden /> {rotulo}
        </span>
      </div>
      <p className="mt-3 text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{valor}</p>
      <div className="mt-1.5"><Variacao delta={delta} pequeno /></div>
    </div>
  )
}

// Seta + % com cor e texto (nunca só cor).
function Variacao({ delta, pequeno = false }) {
  if (delta === null || !Number.isFinite(delta)) {
    return pequeno ? <span className="text-xs text-texto-3">sem mês anterior para comparar</span> : null
  }
  const sobe = delta >= 0
  const Seta = sobe ? ArrowUpRight : ArrowDownRight
  const texto = `${sobe ? '+' : '−'}${Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: delta > -10 && delta < 10 ? 1 : 0 })}%`
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full font-semibold tabular-nums ${
      pequeno ? 'text-xs' : 'px-2.5 py-1 text-sm'} ${sobe ? `text-ok ${pequeno ? '' : 'bg-ok/12'}` : `text-danger ${pequeno ? '' : 'bg-danger/12'}`}`}
      title={sobe ? 'Subiu em relação ao mês anterior' : 'Caiu em relação ao mês anterior'}>
      <Seta size={pequeno ? 14 : 16} aria-hidden /> {texto}
    </span>
  )
}

// Vendedor que mais vendeu peças no mês, em destaque, e o ranking da equipe.
function VendedorDoMes({ ranking, totalPecas, className = '' }) {
  const [lider, ...resto] = ranking
  const maior = Math.max(1, ...ranking.map((r) => r.pecas))

  return (
    <section className={`min-w-0 rounded-2xl border border-borda bg-card p-5 ${className}`}>
      <h2 className="font-semibold">Vendedor do mês</h2>
      <p className="mt-0.5 text-xs text-texto-3">Quem mais vendeu peças</p>

      {!lider ? (
        <p className="py-10 text-center text-sm text-texto-3">Nenhuma venda no mês ainda.</p>
      ) : (
        <>
          <div className="surgir relative mt-4 overflow-hidden rounded-2xl border p-5"
            style={{ borderColor: `${lider.cor}66`, background: `linear-gradient(135deg, ${lider.cor}2e, transparent 70%)` }}>
            <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full blur-2xl" style={{ background: `${lider.cor}40` }} />
            <div className="relative flex flex-wrap items-center gap-4">
              <div className="relative">
                <span aria-hidden className="grid h-16 w-16 place-items-center rounded-full text-2xl font-bold text-fundo shadow-lg"
                  style={{ background: lider.cor, boxShadow: `0 0 0 4px var(--color-card), 0 0 24px ${lider.cor}80` }}>
                  {lider.nome.trim().charAt(0).toUpperCase()}
                </span>
                <span className="absolute -right-1 -top-2 grid h-7 w-7 place-items-center rounded-full bg-warn text-fundo shadow" title="1º lugar">
                  <Crown size={15} aria-hidden />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-bold">{lider.nome}</p>
                <p className="text-sm text-texto-2">
                  {totalPecas ? `${Math.round((lider.pecas / totalPecas) * 100)}% das peças vendidas no mês` : ''}
                </p>
              </div>
              <div className="grid w-full grid-cols-3 gap-2 border-t border-borda/60 pt-3 2xl:w-auto 2xl:gap-5 2xl:border-0 2xl:pt-0">
                <Mini rotulo="Peças" valor={fmtQtd(lider.pecas)} grande />
                <Mini rotulo="Vendido" valor={dinheiro(lider.valor)} />
                <Mini rotulo="Lucro" valor={dinheiro(lider.lucro)} />
              </div>
            </div>
          </div>

          {resto.length > 0 && (
            <ol className="mt-4 space-y-3">
              {resto.map((r, i) => (
                <li key={r.id} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-center text-xs font-semibold text-texto-3 tabular-nums">{i + 2}º</span>
                  <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-fundo" style={{ background: r.cor }}>
                    {r.nome.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{r.nome}</span>
                      <span className="shrink-0 tabular-nums">
                        <strong>{fmtQtd(r.pecas)}</strong> <span className="text-xs text-texto-3">peças · {dinheiro(r.valor)}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevado" aria-hidden>
                      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(r.pecas / maior) * 100}%`, background: r.cor }} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  )
}

function Mini({ rotulo, valor, grande = false }) {
  return (
    <div className="min-w-0 text-center 2xl:text-right">
      <p className="text-[0.68rem] uppercase tracking-wider text-texto-3">{rotulo}</p>
      <p className={`truncate font-bold tabular-nums ${grande ? 'text-2xl' : 'text-sm sm:text-base'}`}>{valor}</p>
    </div>
  )
}

function MaisVendidos({ itens, className = '' }) {
  const maior = Math.max(1, ...itens.map((i) => i.pecas))
  return (
    <section className={`min-w-0 rounded-2xl border border-borda bg-card p-5 ${className}`}>
      <h2 className="font-semibold">Peças mais vendidas</h2>
      <p className="mt-0.5 text-xs text-texto-3">As 5 que mais saíram no mês</p>
      {itens.length === 0 ? (
        <p className="py-10 text-center text-sm text-texto-3">Nenhuma venda no mês ainda.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {itens.map((i, n) => (
            <li key={i.nome}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="w-5 shrink-0 text-xs text-texto-3 tabular-nums">{n + 1}º</span>
                  <span className="truncate font-medium">{i.nome}</span>
                </span>
                <span className="shrink-0 tabular-nums"><strong>{fmtQtd(i.pecas)}</strong> <span className="text-xs text-texto-3">peças</span></span>
              </div>
              <div className="ml-7 mt-1 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-elevado" aria-hidden>
                  <div className="h-full rounded-full bg-acento transition-[width] duration-700" style={{ width: `${(i.pecas / maior) * 100}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right text-xs text-texto-3 tabular-nums">{dinheiro(i.valor)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Erro({ recarregar }) {
  return (
    <div className="rounded-2xl border border-danger/40 bg-danger/10 px-6 py-10 text-center">
      <p className="text-sm text-texto">Não foi possível carregar as vendas do mês.</p>
      <button onClick={recarregar}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-borda-forte px-4 py-2 text-sm font-medium transition hover:bg-elevado">
        <RefreshCw size={14} /> Tentar de novo
      </button>
    </div>
  )
}

function Esqueleto() {
  const bloco = 'animate-pulse rounded-2xl border border-borda bg-card'
  return (
    <div className="space-y-4" aria-label="Carregando" aria-busy>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{[0, 1].map((i) => <div key={i} className={`${bloco} h-48`} />)}</div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className={`${bloco} h-28`} />)}</div>
      <div className={`${bloco} h-80`} />
    </div>
  )
}
