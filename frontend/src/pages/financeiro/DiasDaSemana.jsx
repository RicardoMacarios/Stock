import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarDays, Sun, TrendingDown, Trophy } from 'lucide-react'
import { dinheiro, dinheiroCurto, quantidade as fmtQtd } from '@/lib/formato'

// Dias da semana: em que dia a loja vende mais. Para cada dia da semana, a
// MÉDIA do mês (soma ÷ quantos daquele dia já passaram) — média, não soma,
// porque o mês pode ter 5 sábados e 4 terças.
//
// Uma série (acento): o melhor dia em cor cheia, os outros mais claros. Linha
// tracejada = média da semana; tracinho cinza = o mesmo dia no mês anterior.
// Passar o mouse/dedo num dia mostra os números dele no quadro de cima.

const NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const PLURAL = ['domingos', 'segundas', 'terças', 'quartas', 'quintas', 'sextas', 'sábados']
const CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const ORDEM = [1, 2, 3, 4, 5, 6, 0] // segunda primeiro, como o comércio pensa a semana
const METRICAS = {
  valor: { rotulo: 'Valor', de: (s) => s.media, formato: dinheiro, curto: dinheiroCurto },
  pecas: { rotulo: 'Peças', de: (s) => (s.quantos ? s.pecas / s.quantos : 0), formato: (n) => `${fmtQtd(Math.round(n * 10) / 10)} peças`, curto: (n) => fmtQtd(Math.round(n * 10) / 10) },
}

const maiusculo = (t) => t.charAt(0).toUpperCase() + t.slice(1)

export default function DiasDaSemana({ semana, semanaAnterior, nomeAnterior, className = '' }) {
  const [metrica, setMetrica] = useState('valor')
  const [foco, setFoco] = useState(null)
  const m = METRICAS[metrica]
  const valor = (s) => m.de(s)

  const comDados = semana.filter((s) => s.quantos > 0)
  const maior = Math.max(0, ...semana.map(valor), ...(semanaAnterior ?? []).map(valor))
  const melhor = comDados.length ? comDados.reduce((a, b) => (valor(b) > valor(a) ? b : a)) : null
  const pior = comDados.length > 1 ? comDados.reduce((a, b) => (valor(b) < valor(a) ? b : a)) : null
  // Média da semana = média das médias dos dias que já tiveram ocorrência.
  const mediaSemana = comDados.length ? comDados.reduce((t, s) => t + valor(s), 0) / comDados.length : 0
  const totalValor = semana.reduce((t, s) => t + s.valor, 0)
  const fimDeSemana = totalValor ? ((semana[0].valor + semana[6].valor) / totalValor) * 100 : 0
  const temAnterior = semanaAnterior?.some((s) => s.quantos > 0)

  if (!melhor || maior <= 0) {
    return (
      <section className={`min-w-0 rounded-2xl border border-borda bg-card p-5 ${className}`}>
        <h2 className="font-semibold">Dias da semana</h2>
        <p className="py-10 text-center text-sm text-texto-3">Nenhuma venda no mês ainda.</p>
      </section>
    )
  }

  const f = foco !== null ? semana[foco] : null
  const fAnt = f && temAnterior ? semanaAnterior[f.dia] : null
  const pct = (v) => `${(v / maior) * 100}%`

  return (
    <section className={`min-w-0 rounded-2xl border border-borda bg-card p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Dias da semana</h2>
          <p className="mt-0.5 text-xs text-texto-3">
            {metrica === 'valor' ? 'Quanto a loja vende, em média, em cada dia da semana' : 'Quantas peças saem, em média, em cada dia da semana'}
          </p>
        </div>
        <div role="tablist" aria-label="O que medir" className="flex rounded-xl border border-borda bg-fundo/60 p-1">
          {Object.entries(METRICAS).map(([chave, { rotulo }]) => (
            <button key={chave} role="tab" aria-selected={metrica === chave} onClick={() => setMetrica(chave)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                metrica === chave ? 'bg-acento text-sobre-acento shadow' : 'text-texto-2 hover:text-texto'}`}>
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* ── Resumo ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <div className="surgir relative overflow-hidden rounded-xl border border-acento/40 bg-gradient-to-br from-acento/20 via-card to-card p-4">
            <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-acento/25 blur-2xl" />
            <p className="relative flex items-center gap-1.5 text-xs font-medium text-texto-2">
              <Trophy size={14} className="text-acento" aria-hidden /> Melhor dia
            </p>
            <p className="relative mt-1 text-2xl font-bold tracking-tight">{maiusculo(NOMES[melhor.dia])}</p>
            <p className="relative text-sm tabular-nums text-texto-2">
              média de <strong className="text-texto">{m.formato(valor(melhor))}</strong>
            </p>
            {mediaSemana > 0 && (
              <p className="relative mt-2 inline-flex items-center gap-1 rounded-full bg-ok/12 px-2 py-0.5 text-xs font-semibold text-ok">
                <ArrowUpRight size={13} aria-hidden /> {Math.round(((valor(melhor) - mediaSemana) / mediaSemana) * 100)}% acima da média
              </p>
            )}
          </div>

          {pior && pior.dia !== melhor.dia && (
            <div className="rounded-xl border border-borda bg-fundo/40 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-texto-2">
                <TrendingDown size={14} className="text-danger" aria-hidden /> Dia mais fraco
              </p>
              <p className="mt-1 text-lg font-bold">{maiusculo(NOMES[pior.dia])}</p>
              <p className="text-sm tabular-nums text-texto-3">média de {m.formato(valor(pior))}</p>
            </div>
          )}

          <div className="rounded-xl border border-borda bg-fundo/40 p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-texto-2">
              <Sun size={14} className="text-acento" aria-hidden /> Sábado e domingo
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums">{Math.round(fimDeSemana)}%</p>
            <p className="text-sm text-texto-3">do valor vendido no mês</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevado" aria-hidden>
              <div className="h-full rounded-full bg-acento transition-[width] duration-700" style={{ width: `${fimDeSemana}%` }} />
            </div>
          </div>
        </div>

        {/* ── Gráfico ── */}
        <div className="min-w-0">
          {/* Quadro do dia em foco (altura fixa: a tela não pula) */}
          <div className="flex min-h-14 items-center rounded-xl border border-borda bg-fundo/40 px-4 py-2.5 text-sm" aria-live="polite">
            {f ? (
              <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-1">
                <p>
                  <strong>{maiusculo(NOMES[f.dia])}</strong>
                  <span className="text-texto-3"> · {f.quantos} {f.quantos === 1 ? NOMES[f.dia] : PLURAL[f.dia]} no mês</span>
                </p>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
                  <span><span className="text-texto-3">média </span><strong>{m.formato(valor(f))}</strong></span>
                  <span><span className="text-texto-3">total </span>{dinheiro(f.valor)}</span>
                  <span><span className="text-texto-3">peças </span>{fmtQtd(f.pecas)}</span>
                  {fAnt?.quantos > 0 && valor(fAnt) > 0 && <Variacao atual={valor(f)} antes={valor(fAnt)} nome={nomeAnterior} />}
                </p>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-texto-3">
                <CalendarDays size={16} className="text-acento" aria-hidden />
                Passe o mouse num dia para ver os números dele.
              </p>
            )}
          </div>

          <div className="relative mt-4 grid grid-cols-7 gap-2 sm:gap-4" onPointerLeave={() => setFoco(null)}>
            {/* Média da semana: atravessa todas as colunas */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 h-44">
              <div className="absolute inset-x-0 border-t-[1.5px] border-dashed border-texto-2/70" style={{ bottom: pct(mediaSemana) }}>
                <span className="absolute -top-5 right-0 rounded bg-card px-1 text-[0.68rem] font-semibold text-texto-2">
                  média {m.curto(mediaSemana)}
                </span>
              </div>
            </div>

            {ORDEM.map((i) => {
              const s = semana[i]
              const v = valor(s)
              const ant = temAnterior ? semanaAnterior[i] : null
              const ehMelhor = s.dia === melhor.dia
              const emFoco = foco === s.dia
              const apagado = foco !== null && !emFoco
              return (
                <button key={s.dia} type="button"
                  onPointerEnter={() => setFoco(s.dia)} onFocus={() => setFoco(s.dia)} onBlur={() => setFoco(null)}
                  aria-label={`${NOMES[s.dia]}: média de ${m.formato(v)}`}
                  className={`group flex min-w-0 flex-col items-center rounded-xl outline-none transition-opacity duration-150 focus-visible:ring-2 focus-visible:ring-acento ${apagado ? 'opacity-55' : ''}`}>
                  <span className={`h-6 truncate text-[0.7rem] font-semibold tabular-nums sm:text-xs ${ehMelhor || emFoco ? 'text-texto' : 'text-texto-3'}`}>
                    {s.quantos ? m.curto(v) : '—'}
                  </span>
                  <span className={`relative flex h-44 w-full items-end justify-center rounded-lg transition-colors ${emFoco ? 'bg-elevado/70' : ''}`}>
                    <span className={`barra-sobe relative block w-[70%] max-w-14 rounded-t-[5px] transition-[filter] ${
                      ehMelhor
                        ? 'bg-gradient-to-t from-acento/75 to-acento shadow-[0_0_22px_-4px_var(--color-acento)]'
                        : 'bg-gradient-to-t from-acento/20 to-acento/50 group-hover:to-acento/70'}`}
                      style={{ height: s.quantos ? `max(4px, ${pct(v)})` : '2px', animationDelay: `${ORDEM.indexOf(i) * 50}ms` }} />
                    {/* Mesmo dia no mês anterior */}
                    {ant?.quantos > 0 && (
                      <span aria-hidden className="absolute left-1/2 w-[86%] max-w-[4.25rem] -translate-x-1/2 rounded-full bg-texto-2"
                        style={{ bottom: pct(valor(ant)), height: 3, boxShadow: '0 0 0 2px var(--color-card)' }} />
                    )}
                  </span>
                  <span className={`mt-2 text-xs ${ehMelhor ? 'font-bold text-acento' : emFoco ? 'font-semibold text-texto' : 'text-texto-2'}`}>{CURTOS[s.dia]}</span>
                  <span className="text-[0.65rem] text-texto-3">{s.quantos}×</span>
                </button>
              )
            })}
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-2">
            <li className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-acento" /> Melhor dia</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-acento/40" /> Outros dias</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className="w-4 border-t-[1.5px] border-dashed border-texto-2" /> Média da semana</li>
            {temAnterior && (
              <li className="flex items-center gap-1.5"><span aria-hidden className="h-[3px] w-4 rounded-full bg-texto-2" /> Mesmo dia em {nomeAnterior}</li>
            )}
            <li className="text-texto-3">“2×” = quantos daquele dia o mês já teve</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

function Variacao({ atual, antes, nome }) {
  const p = ((atual - antes) / antes) * 100
  const sobe = p >= 0
  const Seta = sobe ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${sobe ? 'text-ok' : 'text-danger'}`}>
      <Seta size={14} aria-hidden /> {sobe ? '+' : '−'}{Math.abs(Math.round(p))}% vs. {nome}
    </span>
  )
}
