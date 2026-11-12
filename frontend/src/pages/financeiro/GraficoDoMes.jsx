import { useEffect, useId, useState } from 'react'
import { CalendarCheck, Gauge, Sparkles, TrendingUp } from 'lucide-react'
import { dinheiro, dinheiroCurto, quantidade as fmtQtd } from '@/lib/formato'
import { diasDecorridos, vendasPorDiaEVendedor } from './dados'

// Gráfico do mês, em três modos (escolha lembrada neste navegador):
//
//   Por dia       — uma barra por dia. A barra inteira é o valor vendido
//                   (acento claro) e o bloco de baixo, sólido, é o lucro; 2px
//                   de fundo separam os dois. Tracejado = média por dia; nos
//                   dias que faltam, o contorno pontilhado é a previsão.
//   Por vendedor  — a barra do dia dividida entre os vendedores, na cor de
//                   cada um (a mesma do dashboard: ordem de cadastro).
//   Acumulado     — quanto o mês já somou, dia a dia, contra o mês anterior
//                   (linha cinza tracejada) e, no mês corrente, a projeção até
//                   o fim no ritmo atual (pontilhada).
//
// Regras (skill de dataviz): um eixo só; acento para "este mês", cinza neutro
// para comparação; texto sempre na cor de texto; dica ao passar o mouse/dedo.

const MODOS = [['dia', 'Por dia'], ['vendedor', 'Por vendedor'], ['acumulado', 'Acumulado']]
const CHAVE_MODO = 'stock:financeiro:modo'
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function lerModo() {
  try {
    const salvo = localStorage.getItem(CHAVE_MODO)
    return MODOS.some(([m]) => m === salvo) ? salvo : 'dia'
  } catch { return 'dia' }
}

export default function GraficoDoMes({ dias, diasAnterior, vendas, vendedores, mes, hoje }) {
  const [modo, setModoBruto] = useState(lerModo)
  const setModo = (m) => {
    setModoBruto(m)
    try { localStorage.setItem(CHAVE_MODO, m) } catch { /* sem armazenamento: só não lembra */ }
  }
  const [caixa, largura] = useLargura()

  const decorridos = diasDecorridos(mes, hoje)
  const emAndamento = decorridos > 0 && decorridos < dias.length
  const total = dias.reduce((s, d) => s + d.valor, 0)
  const totalAnterior = diasAnterior.reduce((s, d) => s + d.valor, 0)
  const media = decorridos ? total / decorridos : 0
  const projecao = emAndamento ? media * dias.length : null
  const melhor = dias.reduce((m, d) => (d.valor > (m?.valor ?? 0) ? d : m), null)
  const nomeMes = new Date(mes).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  const nomeAnterior = new Date(new Date(mes).getFullYear(), new Date(mes).getMonth() - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })

  const dados = { dias, diasAnterior, mes, hoje, decorridos, emAndamento, media, projecao, melhor, nomeMes, nomeAnterior }
  const porVendedor = modo === 'vendedor' ? vendasPorDiaEVendedor(vendas, mes, vendedores) : null
  const subtitulo = {
    dia: 'Valor vendido e lucro de cada dia',
    vendedor: 'Quanto cada vendedor vendeu em cada dia',
    acumulado: totalAnterior > 0 ? `Quanto o mês já somou, comparado com ${nomeAnterior}` : 'Quanto o mês já somou, dia a dia',
  }[modo]

  return (
    <section className="min-w-0 rounded-2xl border border-borda bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Vendas do mês</h2>
          <p className="mt-0.5 text-xs text-texto-3">{subtitulo}</p>
        </div>
        {/* No celular: 3 colunas iguais na largura toda (antes rolava de lado e "Acumulado" ficava escondida). */}
        <div role="tablist" aria-label="Modo do gráfico" className="grid w-full grid-cols-3 rounded-xl border border-borda bg-fundo/60 p-1 sm:flex sm:w-auto">
          {MODOS.map(([valor, rotulo]) => (
            <button key={valor} role="tab" aria-selected={modo === valor} onClick={() => setModo(valor)}
              className={`min-w-0 whitespace-nowrap rounded-lg px-1.5 py-1.5 text-[0.8rem] font-medium transition sm:px-3 sm:text-sm ${
                modo === valor ? 'bg-acento text-sobre-acento shadow' : 'text-texto-2 hover:text-texto'}`}>
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {/* Números que explicam o gráfico */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Chip icone={Gauge} rotulo="Média por dia" valor={dinheiro(media)} />
        <Chip icone={CalendarCheck} rotulo="Melhor dia"
          valor={melhor ? `${melhor.dia} de ${nomeMes}` : '—'} detalhe={melhor ? dinheiro(melhor.valor) : null} />
        <Chip icone={TrendingUp} rotulo={`Total de ${nomeAnterior}`} valor={dinheiro(totalAnterior)} />
        {projecao !== null
          ? <Chip icone={Sparkles} rotulo="Projeção do mês" valor={dinheiro(projecao)} detalhe="no ritmo atual" destaque />
          : <Chip icone={Sparkles} rotulo="Dias com venda" valor={`${dias.filter((d) => d.valor > 0).length} de ${dias.length}`} />}
      </div>

      {/* Legenda */}
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-2">
        {modo === 'dia' && (
          <>
            <li className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-acento/40" /> Valor vendido</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-acento" /> Lucro</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className="w-4 border-t-2 border-dashed border-texto-3" /> Média por dia</li>
            {emAndamento && media > 0 && (
              <li className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm border border-dashed border-acento/70" /> Previsão</li>
            )}
          </>
        )}
        {modo === 'vendedor' && porVendedor.series.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} /> {s.nome}
          </li>
        ))}
        {modo === 'acumulado' && (
          <>
            <li className="flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 rounded-full bg-acento" /> Este mês</li>
            {totalAnterior > 0 && (
              <li className="flex items-center gap-1.5 first-letter:uppercase"><span aria-hidden className="w-4 border-t-2 border-dashed border-texto-3" /> {nomeAnterior}</li>
            )}
            {projecao !== null && <li className="flex items-center gap-1.5"><span aria-hidden className="w-4 border-t-2 border-dotted border-acento" /> Projeção</li>}
          </>
        )}
      </ul>

      <div ref={caixa} className="relative mt-2 w-full min-w-0">
        {largura > 0 && modo === 'dia' && <Barras key={`d${mes}`} {...dados} largura={largura} />}
        {largura > 0 && modo === 'vendedor' && (
          <BarrasPorVendedor key={`v${mes}`} {...dados} series={porVendedor.series} pilhas={porVendedor.dias} largura={largura} />
        )}
        {largura > 0 && modo === 'acumulado' && <Acumulado key={`a${mes}`} {...dados} largura={largura} />}
      </div>
    </section>
  )
}

function Chip({ icone: Icone, rotulo, valor, detalhe, destaque = false }) {
  return (
    <div className={`min-w-0 rounded-xl border px-3 py-2.5 ${destaque ? 'border-acento/40 bg-acento/10' : 'border-borda bg-fundo/40'}`}>
      {/* Sem truncate: no celular o chip é estreito e cortava o valor ("R$ 136,09 no rit…"). */}
      <p className="flex items-start gap-1.5 text-xs leading-tight text-texto-3 first-letter:uppercase">
        <Icone size={13} aria-hidden className="mt-px shrink-0 text-acento" /> <span>{rotulo}</span>
      </p>
      <p className="mt-1 break-words font-semibold leading-tight tabular-nums">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs leading-tight text-texto-3 tabular-nums">{detalhe}</p>}
    </div>
  )
}

// ── Base dos gráficos de barra por dia ────────────────────────────────────
// Medidas, escala, eixo de dias (com a letra do dia da semana) e o dia sob
// o mouse — iguais em "Por dia" e "Por vendedor".

function useBarrasDoMes({ dias, mes, decorridos, largura, maior }) {
  const [foco, setFoco] = useState(null) // índice do dia sob o mouse
  const compacto = largura < 640
  const esquerda = 68
  const faixa = (largura - esquerda - 8) / dias.length
  const comSemana = faixa >= 20
  const M = { topo: 24, base: comSemana ? 42 : 28, esquerda, direita: 8 }
  const ALTURA = compacto ? 250 : 320
  const w = largura - M.esquerda - M.direita
  const h = ALTURA - M.topo - M.base
  const { max, passo } = escala(maior)
  const larguraBarra = Math.max(3, Math.min(26, faixa * 0.68))
  const d0 = new Date(mes)
  const diaDeHoje = decorridos > 0 && decorridos < dias.length ? decorridos : null

  const g = {
    M, ALTURA, w, h, max, passo, faixa, comSemana, compacto, larguraBarra, foco, diaDeHoje,
    raio: Math.min(4, larguraBarra / 2),
    x: (i) => M.esquerda + faixa * i + faixa / 2,
    y: (v) => M.topo + h - (v / max) * h,
    diaDaSemana: (n) => new Date(d0.getFullYear(), d0.getMonth(), n).getDay(),
    dataLonga: (n) => new Date(d0.getFullYear(), d0.getMonth(), n).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }),
    mover(e) {
      const r = e.currentTarget.getBoundingClientRect()
      const i = Math.floor((e.clientX - r.left - M.esquerda) / faixa)
      setFoco(i >= 0 && i < dias.length && i < decorridos ? i : null)
    },
    sair: () => setFoco(null),
  }
  return g
}

// Grade + valores do eixo Y + destaque do dia em foco.
function FundoDasBarras({ g }) {
  const { M, w, h, x, y, max, passo, faixa, foco } = g
  const ticks = []
  for (let v = 0; v <= max + 1e-9; v += passo) ticks.push(v)
  return (
    <g pointerEvents="none">
      {foco !== null && <rect x={x(foco) - faixa / 2} y={M.topo - 6} width={faixa} height={h + 6} rx="7" fill="var(--color-elevado)" opacity="0.8" />}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={M.esquerda} x2={M.esquerda + w} y1={y(v)} y2={y(v)}
            stroke="var(--color-borda)" strokeDasharray={v === 0 ? undefined : '2 4'} />
          <text x={M.esquerda - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--color-texto-3)">{dinheiroCurto(v)}</text>
        </g>
      ))}
    </g>
  )
}

// Números dos dias embaixo; hoje vem numa pílula na cor de acento.
function EixoDosDias({ g, dias, decorridos }) {
  const { ALTURA, x, faixa, comSemana, diaDaSemana, diaDeHoje, foco } = g
  const cada = faixa >= 26 ? 1 : faixa >= 13 ? 2 : 5
  const yNumero = ALTURA - (comSemana ? 24 : 10)
  return (
    <g pointerEvents="none">
      {dias.map((dia, i) => {
        const futuro = i >= decorridos
        const ehHoje = dia.dia === diaDeHoje
        const mostra = dia.dia === 1 || dia.dia % cada === 0 || ehHoje || foco === i
        return (
          <g key={dia.dia}>
            {ehHoje && <rect x={x(i) - 12} y={yNumero - 11} width="24" height="17" rx="8.5" fill="var(--color-acento)" />}
            {mostra && (
              <text x={x(i)} y={yNumero} dy="0.05em" textAnchor="middle" fontSize="11"
                fontWeight={ehHoje || foco === i ? 700 : 400}
                fill={ehHoje ? 'var(--color-sobre-acento)' : foco === i ? 'var(--color-texto)' : futuro ? 'var(--color-borda-forte)' : 'var(--color-texto-3)'}>
                {dia.dia}
              </text>
            )}
            {comSemana && (
              <text x={x(i)} y={ALTURA - 8} textAnchor="middle" fontSize="9.5" fill="var(--color-texto-3)" opacity={futuro ? 0.4 : 0.75}>
                {SEMANA[diaDaSemana(dia.dia)]}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

function LinhaDaMedia({ g, media }) {
  const { M, w, y } = g
  if (!(media > 0)) return null
  return (
    <g pointerEvents="none">
      <line x1={M.esquerda} x2={M.esquerda + w} y1={y(media)} y2={y(media)} stroke="var(--color-texto-2)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
      <text x={M.esquerda + w - 4} y={y(media) - 7} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--color-texto-2)"
        stroke="var(--color-card)" strokeWidth="4" paintOrder="stroke">
        média {dinheiroCurto(media)}
      </text>
    </g>
  )
}

const brilho = 'drop-shadow(0 0 10px color-mix(in srgb, var(--color-acento) 55%, transparent))'

// ── Por dia ───────────────────────────────────────────────────────────────

function Barras({ dias, mes, decorridos, emAndamento, media, melhor, nomeMes, largura }) {
  const id = useId()
  const g = useBarrasDoMes({ dias, mes, decorridos, largura, maior: Math.max(media, ...dias.map((d) => d.valor)) })
  const { ALTURA, x, y, larguraBarra, raio, compacto, foco, diaDeHoje } = g
  const d = foco !== null ? dias[foco] : null
  const previsao = emAndamento && media > 0

  return (
    <>
      <svg width={largura} height={ALTURA} role="img" className="block touch-none select-none"
        aria-label={`Vendas por dia de ${nomeMes}. Média de ${dinheiro(media)} por dia.`}
        onPointerMove={g.mover} onPointerDown={g.mover} onPointerLeave={g.sair}>
        <defs>
          <linearGradient id={`${id}-valor`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-acento)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--color-acento)" stopOpacity="0.22" />
          </linearGradient>
          <linearGradient id={`${id}-lucro`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-acento)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--color-acento)" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        <FundoDasBarras g={g} />

        {dias.map((dia, i) => {
          const futuro = i >= decorridos
          const topo = y(dia.valor)
          const lucro = Math.max(0, Math.min(dia.lucro, dia.valor))
          const topoLucro = y(lucro)
          const x0 = x(i) - larguraBarra / 2
          const atraso = { animationDelay: `${i * 16}ms` }
          // Só o lucro, ou só o valor, ou os dois com 2px de fundo entre eles.
          const soLucro = lucro > 0 && topoLucro - topo < 3
          return (
            <g key={dia.dia} opacity={foco !== null && foco !== i ? 0.35 : 1}
              style={{ transition: 'opacity 150ms', filter: foco === i ? brilho : undefined }}>
              {dia.valor > 0 && !soLucro && (
                <path d={barra(x0, topo, larguraBarra, (lucro > 0 ? topoLucro - 2 : y(0)) - topo, raio)}
                  fill={`url(#${id}-valor)`} className="barra-sobe" style={atraso} />
              )}
              {lucro > 0 && (
                <path d={barra(x0, soLucro ? topo : topoLucro, larguraBarra, y(0) - (soLucro ? topo : topoLucro), soLucro ? raio : 1.5)}
                  fill={`url(#${id}-lucro)`} className="barra-sobe" style={atraso} />
              )}
              {dia.valor === 0 && !futuro && (
                <rect x={x0} y={y(0) - 2} width={larguraBarra} height="2" rx="1" fill="var(--color-borda-forte)" />
              )}
              {/* Dias que faltam: contorno pontilhado na altura da média */}
              {futuro && previsao && (
                <path d={barra(x0 + 0.5, y(media), larguraBarra - 1, y(0) - y(media) - 0.5, raio)}
                  fill="var(--color-acento)" fillOpacity="0.05" stroke="var(--color-acento)" strokeOpacity="0.45" strokeDasharray="2 3" />
              )}
              {!compacto && dia.valor > 0 && (foco === i || (foco === null && melhor && dia.dia === melhor.dia)) && (
                <text x={x(i)} y={topo - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-texto)">
                  {dinheiroCurto(dia.valor)}
                </text>
              )}
            </g>
          )
        })}

        <EixoDosDias g={g} dias={dias} decorridos={decorridos} />
        <LinhaDaMedia g={g} media={media} />
      </svg>

      {d && (
        <Dica x={x(foco)} largura={largura} folga={g.faixa / 2 + 6} titulo={`${g.dataLonga(d.dia)}${d.dia === diaDeHoje ? ' · hoje' : ''}`}>
          <Linha rotulo="Vendido" valor={dinheiro(d.valor)} forte />
          <Linha rotulo="Lucro" valor={`${dinheiro(d.lucro)}${d.valor ? ` · ${Math.round((d.lucro / d.valor) * 100)}%` : ''}`} />
          <Linha rotulo="Peças" valor={fmtQtd(d.pecas)} />
          <Linha rotulo="Vendas" valor={fmtQtd(d.vendas)} />
          {media > 0 && <Comparacao valor={d.valor} base={media} texto="da média" />}
        </Dica>
      )}
    </>
  )
}

// ── Por vendedor ──────────────────────────────────────────────────────────
// Barras empilhadas: de baixo para cima, na ordem fixa dos vendedores, com
// 2px de fundo entre um bloco e outro; só o bloco de cima tem canto redondo.

function BarrasPorVendedor({ pilhas, series, mes, decorridos, media, nomeMes, largura }) {
  const g = useBarrasDoMes({ dias: pilhas, mes, decorridos, largura, maior: Math.max(media, ...pilhas.map((d) => d.total)) })
  const { ALTURA, x, y, larguraBarra, raio, compacto, foco, diaDeHoje } = g
  const d = foco !== null ? pilhas[foco] : null
  const doDia = d ? series.filter((s) => d.por[s.id]).map((s) => ({ ...s, ...d.por[s.id] })).sort((a, b) => b.valor - a.valor) : []

  return (
    <>
      <svg width={largura} height={ALTURA} role="img" className="block touch-none select-none"
        aria-label={`Vendas de ${nomeMes} por vendedor: ${series.map((s) => s.nome).join(', ')}`}
        onPointerMove={g.mover} onPointerDown={g.mover} onPointerLeave={g.sair}>
        <FundoDasBarras g={g} />

        {pilhas.map((dia, i) => {
          const x0 = x(i) - larguraBarra / 2
          const blocos = series.filter((s) => dia.por[s.id]?.valor > 0)
          let base = 0
          return (
            <g key={dia.dia} opacity={foco !== null && foco !== i ? 0.35 : 1}
              style={{ transition: 'opacity 150ms', filter: foco === i ? 'drop-shadow(0 0 8px rgba(255,255,255,0.18))' : undefined }}>
              {blocos.map((s, n) => {
                const valor = dia.por[s.id].valor
                const yBase = y(base) - (n > 0 ? 2 : 0) // 2px de fundo entre blocos
                base += valor
                const yTopo = y(base)
                const ultimo = n === blocos.length - 1
                return (
                  <path key={s.id} d={barra(x0, yTopo, larguraBarra, yBase - yTopo, ultimo ? raio : 1)}
                    fill={s.cor} className="barra-sobe" style={{ animationDelay: `${i * 16}ms` }} />
                )
              })}
              {dia.total === 0 && i < decorridos && (
                <rect x={x0} y={y(0) - 2} width={larguraBarra} height="2" rx="1" fill="var(--color-borda-forte)" />
              )}
              {!compacto && foco === i && dia.total > 0 && (
                <text x={x(i)} y={y(dia.total) - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-texto)">
                  {dinheiroCurto(dia.total)}
                </text>
              )}
            </g>
          )
        })}

        <EixoDosDias g={g} dias={pilhas} decorridos={decorridos} />
        <LinhaDaMedia g={g} media={media} />
      </svg>

      {d && (
        <Dica x={x(foco)} largura={largura} folga={g.faixa / 2 + 6} titulo={`${g.dataLonga(d.dia)}${d.dia === diaDeHoje ? ' · hoje' : ''}`}>
          {doDia.length === 0 && <p className="text-texto-3">Nenhuma venda neste dia.</p>}
          {doDia.map((s, n) => (
            <p key={s.id} className="flex items-center justify-between gap-6 py-0.5">
              <span className="flex min-w-0 items-center gap-1.5 text-texto-2">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.cor }} />
                <span className="truncate">{s.nome}</span>
                {n === 0 && doDia.length > 1 && <span title="Quem mais vendeu no dia">🏆</span>}
              </span>
              <span className="shrink-0 tabular-nums text-texto">
                <strong className="font-semibold">{dinheiro(s.valor)}</strong>
                <span className="text-texto-3"> · {fmtQtd(s.pecas)} pç</span>
              </span>
            </p>
          ))}
          {doDia.length > 1 && (
            <p className="mt-1.5 flex justify-between gap-6 border-t border-borda pt-1.5">
              <span className="text-texto-3">Total</span>
              <strong className="tabular-nums">{dinheiro(d.total)}</strong>
            </p>
          )}
        </Dica>
      )}
    </>
  )
}

// ── Acumulado ─────────────────────────────────────────────────────────────

function Acumulado({ dias, diasAnterior, decorridos, emAndamento, media, projecao, nomeMes, nomeAnterior, largura }) {
  const id = useId()
  const [foco, setFoco] = useState(null) // dia sob o mouse (1..N)
  const compacto = largura < 640
  const rotulos = !compacto
  const M = { topo: 20, base: 26, esquerda: 68, direita: rotulos ? 118 : 12 }
  const ALTURA = compacto ? 240 : 300
  const w = largura - M.esquerda - M.direita
  const h = ALTURA - M.topo - M.base

  // Mês anterior sem venda nenhuma: não desenha (seria só uma linha no zero).
  const temAnterior = diasAnterior.some((d) => d.valor > 0)
  const N = temAnterior ? Math.max(dias.length, diasAnterior.length) : dias.length
  const acumular = (lista, ate) => {
    const pts = [{ d: 0, v: 0 }]
    let soma = 0
    for (const dia of lista.slice(0, ate)) { soma += dia.valor; pts.push({ d: dia.dia, v: soma }) }
    return pts
  }
  const atual = acumular(dias, decorridos)
  const anterior = acumular(diasAnterior, diasAnterior.length)
  const fimAtual = atual.at(-1)
  const proj = projecao !== null ? [fimAtual, { d: dias.length, v: projecao }] : null
  const { max, passo } = escala(Math.max(fimAtual.v, anterior.at(-1).v, projecao ?? 0))

  const x = (d) => M.esquerda + (d / N) * w
  const y = (v) => M.topo + h - (v / max) * h
  const caminho = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.d)},${y(p.v)}`).join(' ')
  const ticksY = []
  for (let v = 0; v <= max + 1e-9; v += passo) ticksY.push(v)
  const ticksX = [1, 5, 10, 15, 20, 25, N].filter((d, i, a) => d <= N && a.indexOf(d) === i && !(d !== N && N - d < 3))

  const valorEm = (pts, d) => pts.find((p) => p.d === d)?.v ?? null
  function mover(e) {
    const r = e.currentTarget.getBoundingClientRect()
    const d = Math.round(((e.clientX - r.left - M.esquerda) / w) * N)
    setFoco(d >= 1 && d <= N ? d : null)
  }

  // Rótulos no fim de cada linha, sem encostar um no outro.
  const finais = afastar([
    { chave: 'atual', y: y(fimAtual.v), texto: dinheiroCurto(fimAtual.v), cor: 'var(--color-texto)', peso: 700 },
    ...(proj ? [{ chave: 'proj', y: y(projecao), texto: `${dinheiroCurto(projecao)} proj.`, cor: 'var(--color-texto-2)', peso: 600, x: x(dias.length) }] : []),
    ...(temAnterior ? [{ chave: 'ant', y: y(anterior.at(-1).v), texto: dinheiroCurto(anterior.at(-1).v), cor: 'var(--color-texto-3)', peso: 500, x: x(diasAnterior.length) }] : []),
  ], 16)

  const noFocoAtual = foco !== null ? valorEm(atual, foco) : null
  const noFocoAnt = foco !== null ? valorEm(anterior, foco) : null
  const noFocoProj = foco !== null && proj && foco > decorridos && foco <= dias.length ? fimAtual.v + media * (foco - decorridos) : null

  return (
    <>
      <svg width={largura} height={ALTURA} role="img" className="block touch-none select-none"
        aria-label={`Acumulado de ${nomeMes}: ${dinheiro(fimAtual.v)}; ${nomeAnterior}: ${dinheiro(anterior.at(-1).v)}`}
        onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setFoco(null)}>
        <defs>
          <linearGradient id={`${id}-area`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-acento)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-acento)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticksY.map((v) => (
          <g key={v}>
            <line x1={M.esquerda} x2={M.esquerda + w} y1={y(v)} y2={y(v)}
              stroke="var(--color-borda)" strokeDasharray={v === 0 ? undefined : '2 4'} />
            <text x={M.esquerda - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--color-texto-3)">{dinheiroCurto(v)}</text>
          </g>
        ))}
        {ticksX.map((d) => (
          <text key={d} x={x(d)} y={ALTURA - 8} textAnchor="middle" fontSize="11"
            fill={emAndamento && d === decorridos ? 'var(--color-acento)' : 'var(--color-texto-3)'}>{d}</text>
        ))}

        {/* Mês anterior (comparação, cinza) */}
        {temAnterior && <path d={caminho(anterior)} fill="none" stroke="var(--color-texto-3)" strokeWidth="2" strokeDasharray="6 5" strokeLinejoin="round" opacity="0.9" />}
        {/* Projeção */}
        {proj && <path d={caminho(proj)} fill="none" stroke="var(--color-acento)" strokeWidth="2" strokeDasharray="1.5 5" strokeLinecap="round" opacity="0.9" />}
        {/* Este mês: área + linha */}
        {atual.length > 1 && (
          <>
            <path d={`${caminho(atual)} L${x(fimAtual.d)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${id}-area)`} className="surgir" />
            <path d={caminho(atual)} fill="none" stroke="var(--color-acento)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
              pathLength="1" className="grafico-linha" style={{ filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--color-acento) 50%, transparent))' }} />
            <circle cx={x(fimAtual.d)} cy={y(fimAtual.v)} r="4.5" fill="var(--color-acento)" stroke="var(--color-card)" strokeWidth="2" />
          </>
        )}
        {proj && <circle cx={x(dias.length)} cy={y(projecao)} r="4" fill="var(--color-card)" stroke="var(--color-acento)" strokeWidth="2" />}

        {rotulos && finais.map((r) => (
          <text key={r.chave} x={M.esquerda + w + 10} y={r.y} dy="0.32em" fontSize="11.5" fontWeight={r.peso} fill={r.cor}>{r.texto}</text>
        ))}

        {foco !== null && (
          <g pointerEvents="none">
            <line x1={x(foco)} x2={x(foco)} y1={M.topo} y2={M.topo + h} stroke="var(--color-texto-3)" strokeDasharray="3 3" />
            {temAnterior && noFocoAnt !== null && <circle cx={x(foco)} cy={y(noFocoAnt)} r="4" fill="var(--color-texto-3)" stroke="var(--color-card)" strokeWidth="2" />}
            {noFocoProj !== null && <circle cx={x(foco)} cy={y(noFocoProj)} r="4" fill="var(--color-card)" stroke="var(--color-acento)" strokeWidth="2" />}
            {noFocoAtual !== null && <circle cx={x(foco)} cy={y(noFocoAtual)} r="5" fill="var(--color-acento)" stroke="var(--color-card)" strokeWidth="2" />}
          </g>
        )}
      </svg>

      {foco !== null && (
        <Dica x={x(foco)} largura={largura} folga={12} titulo={`até ${foco} de ${nomeMes}`}>
          {noFocoAtual !== null && <Linha rotulo="Este mês" valor={dinheiro(noFocoAtual)} forte cor="text-acento" />}
          {noFocoProj !== null && <Linha rotulo="Projeção" valor={dinheiro(noFocoProj)} />}
          {temAnterior && noFocoAnt !== null && <Linha rotulo={nomeAnterior} valor={dinheiro(noFocoAnt)} />}
          {temAnterior && noFocoAtual !== null && noFocoAnt ? <Comparacao valor={noFocoAtual} base={noFocoAnt} texto={`que ${nomeAnterior}`} /> : null}
        </Dica>
      )}
    </>
  )
}

// ── Peças ─────────────────────────────────────────────────────────────────

function Dica({ x, largura, folga, titulo, children }) {
  return (
    <div role="status"
      className="pointer-events-none absolute top-0 z-10 min-w-52 rounded-xl border border-borda-forte bg-fundo/95 px-3 py-2.5 text-xs shadow-2xl backdrop-blur"
      style={x > largura / 2 ? { right: largura - x + folga } : { left: x + folga }}>
      <p className="mb-1.5 font-semibold text-texto-2 first-letter:uppercase">{titulo}</p>
      {children}
    </div>
  )
}

function Linha({ rotulo, valor, forte, cor = 'text-texto' }) {
  return (
    <p className="flex items-center justify-between gap-6 py-0.5">
      <span className="text-texto-3 first-letter:uppercase">{rotulo}</span>
      <span className={`tabular-nums ${forte ? 'font-semibold' : ''} ${cor}`}>{valor}</span>
    </p>
  )
}

// "+12% acima da média" / "−8% abaixo de outubro" — seta e palavra, não só cor.
function Comparacao({ valor, base, texto }) {
  const pct = ((valor - base) / base) * 100
  const sobe = pct >= 0
  return (
    <p className={`mt-1.5 border-t border-borda pt-1.5 font-medium ${sobe ? 'text-ok' : 'text-danger'}`}>
      {sobe ? '▲' : '▼'} {Math.abs(pct).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% {sobe ? 'acima' : 'abaixo'} {texto}
    </p>
  )
}

// Retângulo com os cantos de cima arredondados (os de baixo ficam no chão).
function barra(x, y, w, h, r) {
  if (h <= 0.5) return ''
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}

// Escala "redonda": ~4 divisões de 1, 2, 2,5 ou 5 × 10ⁿ, com folga no topo.
function escala(maior) {
  if (maior <= 0) return { max: 100, passo: 25 }
  const bruto = maior / 4
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto)
  return { max: Math.ceil((maior * 1.08) / passo) * passo, passo }
}

// Empurra rótulos para baixo até ficarem `espaco` px um do outro.
function afastar(itens, espaco) {
  const ordenados = [...itens].sort((a, b) => a.y - b.y)
  for (let i = 1; i < ordenados.length; i++) {
    if (ordenados[i].y - ordenados[i - 1].y < espaco) ordenados[i].y = ordenados[i - 1].y + espaco
  }
  return ordenados
}

function useLargura() {
  const [el, setEl] = useState(null)
  const [largura, setLargura] = useState(0)
  useEffect(() => {
    if (!el) return
    const obs = new ResizeObserver(([e]) => setLargura(Math.floor(e.contentRect.width)))
    obs.observe(el)
    return () => obs.disconnect()
  }, [el])
  return [setEl, largura]
}
