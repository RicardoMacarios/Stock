import { useEffect, useMemo, useState } from 'react'
import { dinheiro, dinheiroCurto, horaCurta, quantidade as fmtQtd } from '@/lib/formato'
import { COR_SEM_VENDEDOR, corDoVendedor } from '@/pages/vendas/dados'

// Valor vendido ACUMULADO no dia, uma linha por vendedor. Cada venda é um
// degrau: a linha do vendedor sobe na hora em que ele vende.
//
// Regras do gráfico (skill de dataviz): cor segue o vendedor (ordem de
// cadastro, nunca o ranking); linhas de 2px; grade discreta; legenda para 2+
// séries e rótulo direto no fim da linha quando cabe (até 4); dica com cruz
// ao passar o mouse; o ranking ao lado é a mesma informação em lista.

const MARGEM = { topo: 16, base: 28, esquerda: 64 }
const SEM_VENDEDOR = '__sem__'

export default function PainelVendedores({ vendas, vendedores, agora, ehHoje = true }) {
  const series = useMemo(() => montarSeries(vendas, vendedores), [vendas, vendedores])
  const [caixa, largura] = useLargura()

  // grid-cols-1 = minmax(0, 1fr) e min-w-0: a coluna pode encolher abaixo da
  // largura do SVG; sem isso o gráfico "segura" a largura e tudo vaza no celular.
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section className="min-w-0 rounded-2xl border border-borda bg-card p-5 lg:col-span-2">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Vendas por vendedor</h2>
            <p className="mt-0.5 text-xs text-texto-3">Valor acumulado ao longo do dia</p>
          </div>
          {series.length > 1 && <Legenda series={series} />}
        </div>
        <div ref={caixa} className="relative w-full min-w-0 overflow-hidden">
          {largura > 0 && <Grafico series={series} largura={largura} agora={agora} aoVivo={ehHoje && vendas.length > 0} />}
          {vendas.length === 0 && (
            <p className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto w-fit rounded-full border border-borda bg-fundo/90 px-4 py-2 text-center text-sm text-texto-2">
              {ehHoje ? 'Nenhuma venda ainda hoje. As linhas sobem a cada venda.' : 'Nenhuma venda neste dia.'}
            </p>
          )}
        </div>
      </section>
      <Ranking series={series} ehHoje={ehHoje} />
    </div>
  )
}

// ── Dados ─────────────────────────────────────────────────────────────────

function montarSeries(vendas, vendedores) {
  const porId = new Map()
  const garantir = (id, nome) => {
    if (!porId.has(id)) {
      porId.set(id, {
        id, nome,
        cor: id === SEM_VENDEDOR ? COR_SEM_VENDEDOR : corDoVendedor(vendedores, id),
        degraus: [], // [{ t, total }]
        total: 0, pecas: 0,
      })
    }
    return porId.get(id)
  }
  // Ativos aparecem mesmo zerados: dá para ver quem ainda não vendeu.
  for (const v of vendedores) if (v.ativo) garantir(v.id, v.nome)

  for (const venda of vendas) {
    const id = venda.vendedor_id ?? SEM_VENDEDOR
    const s = garantir(id, venda.vendedor_nome ?? (id === SEM_VENDEDOR ? 'Sem vendedor' : 'Vendedor removido'))
    s.total += Number(venda.quantidade) * Number(venda.preco_unitario)
    s.pecas += Number(venda.quantidade)
    s.degraus.push({ t: new Date(venda.vendido_em).getTime(), total: s.total })
  }

  // Ordem fixa de cadastro (= ordem da cor); "sem vendedor" por último.
  const ordem = (s) => (s.id === SEM_VENDEDOR ? Infinity : vendedores.findIndex((v) => v.id === s.id))
  return [...porId.values()].sort((a, b) => ordem(a) - ordem(b))
}

// Total acumulado de uma série no instante t.
function valorEm(serie, t) {
  let total = 0
  for (const d of serie.degraus) {
    if (d.t > t) break
    total = d.total
  }
  return total
}

// Escala "redonda": ~4 divisões de 1, 2, 2,5 ou 5 × 10ⁿ (R$ 0 · 100 · 200 · 300).
function escala(maior) {
  if (maior <= 0) return { max: 100, passo: 25 }
  const bruto = maior / 4
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto)
  return { max: Math.ceil(maior / passo) * passo, passo }
}

// Degraus com os cantos arredondados: sobe na hora da venda (honesto para
// um acumulado), mas sem a quina seca.
function caminhoDegraus(pontos, x0, x1, y0, raio = 7) {
  let d = `M${x0},${y0}`
  let cx = x0
  let cy = y0
  pontos.forEach(({ x, y }, i) => {
    const proximo = i + 1 < pontos.length ? pontos[i + 1].x : x1
    const r = Math.max(0, Math.min(raio, x - cx, (cy - y) / 2, proximo - x))
    if (r < 1) {
      d += ` H${x} V${y}`
    } else {
      d += ` H${x - r} Q${x},${cy} ${x},${cy - r} V${y + r} Q${x},${y} ${x + r},${y}`
    }
    cx = r < 1 ? x : x + r
    cy = y
  })
  return `${d} H${x1}`
}

// ── Desenho ───────────────────────────────────────────────────────────────

function Grafico({ series, largura, agora, aoVivo }) {
  const [mira, setMira] = useState(null) // instante sob o mouse

  const compacto = largura < 640
  const ALTURA = compacto ? 230 : 300
  const rotulosDiretos = !compacto && series.length <= 4
  const direita = rotulosDiretos ? 156 : 16
  const w = largura - MARGEM.esquerda - direita
  const h = ALTURA - MARGEM.topo - MARGEM.base

  // Eixo X: da hora cheia antes da 1ª venda (no máx. 8h) até agora.
  // Sem venda ainda: 8h até agora, linhas no zero.
  const tempos = series.flatMap((s) => s.degraus.map((d) => d.t))
  const primeira = tempos.length ? Math.min(...tempos) : agora
  const inicioDia = new Date(agora); inicioDia.setHours(8, 0, 0, 0)
  const t0d = new Date(Math.min(primeira, inicioDia.getTime())); t0d.setMinutes(0, 0, 0)
  const t0 = t0d.getTime()
  const t1 = Math.max(agora, primeira + 60 * 60 * 1000)
  const { max: yMax, passo: passoY } = escala(Math.max(0, ...series.map((s) => s.total)))

  const x = (t) => MARGEM.esquerda + ((t - t0) / (t1 - t0)) * w
  const y = (v) => MARGEM.topo + h - (v / yMax) * h

  const ticksY = []
  for (let v = 0; v <= yMax + 1e-9; v += passoY) ticksY.push(v)
  const horas = (t1 - t0) / 3_600_000
  const passo = Math.max(1, Math.ceil(horas / (compacto ? 4 : 8)))
  const ticksX = []
  for (let t = t0; t <= t1; t += passo * 3_600_000) ticksX.push(t)

  const linha = (s) => caminhoDegraus(s.degraus.map((p) => ({ x: x(p.t), y: y(p.total) })), x(t0), x(t1), y(0))

  // Rótulos no fim da linha, afastados para não encostar um no outro.
  const rotulos = rotulosDiretos ? afastar(series.map((s) => ({ s, y: y(s.total) })), 18) : []

  function mover(e) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    const t = t0 + ((px - MARGEM.esquerda) / w) * (t1 - t0)
    setMira(Math.min(t1, Math.max(t0, t)))
  }

  const valoresNaMira = mira === null ? [] : series
    .map((s) => ({ s, v: valorEm(s, mira) }))
    .sort((a, b) => b.v - a.v)

  return (
    <>
      <svg width={largura} height={ALTURA} role="img" className="block touch-none select-none"
        aria-label={`Valor vendido hoje por vendedor: ${series.map((s) => `${s.nome} ${dinheiro(s.total)}`).join(', ')}`}
        onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setMira(null)}>
        {/* Grade e eixo Y */}
        {ticksY.map((v) => (
          <g key={v}>
            <line x1={MARGEM.esquerda} x2={MARGEM.esquerda + w} y1={y(v)} y2={y(v)}
              stroke="var(--color-borda)" strokeDasharray={v === 0 ? undefined : '2 4'} />
            <text x={MARGEM.esquerda - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--color-texto-3)">
              {dinheiroCurto(v)}
            </text>
          </g>
        ))}
        {/* Eixo X */}
        {ticksX.map((t) => (
          <text key={t} x={x(t)} y={ALTURA - 8} textAnchor="middle" fontSize="11" fill="var(--color-texto-3)">
            {new Date(t).getHours()}h
          </text>
        ))}

        {/* Linhas com brilho suave na cor do vendedor; se desenham ao abrir */}
        {series.map((s) => (
          <path key={s.id} d={linha(s)} fill="none" stroke={s.cor} strokeWidth="2.5"
            strokeLinejoin="round" strokeLinecap="round" pathLength="1" className="grafico-linha"
            style={{ filter: `drop-shadow(0 0 5px ${s.cor}80)` }} />
        ))}
        {/* Um ponto em cada venda (topo do degrau), com anel da cor do fundo */}
        {series.flatMap((s) => s.degraus.map((d) => (
          <circle key={`${s.id}-${d.t}`} cx={x(d.t)} cy={y(d.total)} r="3.5"
            fill={s.cor} stroke="var(--color-card)" strokeWidth="2" />
        )))}
        {/* Hoje: ponto "ao vivo" pulsando no fim de cada linha */}
        {aoVivo && series.map((s) => (
          <g key={`vivo-${s.id}`} pointerEvents="none">
            <circle cx={x(t1)} cy={y(s.total)} r="4" fill={s.cor} className="animate-ping"
              style={{ transformBox: 'fill-box', transformOrigin: 'center', opacity: 0.6 }} />
            <circle cx={x(t1)} cy={y(s.total)} r="4" fill={s.cor} stroke="var(--color-card)" strokeWidth="2" />
          </g>
        ))}

        {/* Rótulos diretos: nome e total; cor só na bolinha, texto na cor do texto */}
        {rotulos.map(({ s, y: ry }) => (
          <g key={s.id} transform={`translate(${MARGEM.esquerda + w + 12},${ry})`}>
            <text dy="0.32em" fontSize="12" fontWeight="600" fill="var(--color-texto)">
              {s.nome.length > 11 ? `${s.nome.slice(0, 10)}…` : s.nome}
              <tspan dx="6" fontWeight="400" fill="var(--color-texto-2)">{dinheiroCurto(s.total)}</tspan>
            </text>
          </g>
        ))}

        {/* Mira */}
        {mira !== null && (
          <g pointerEvents="none">
            <line x1={x(mira)} x2={x(mira)} y1={MARGEM.topo} y2={MARGEM.topo + h} stroke="var(--color-texto-3)" strokeDasharray="3 3" />
            {series.map((s) => (
              <circle key={s.id} cx={x(mira)} cy={y(valorEm(s, mira))} r="4.5" fill={s.cor} stroke="var(--color-card)" strokeWidth="2" />
            ))}
          </g>
        )}
      </svg>

      {mira !== null && (
        <div role="status" className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-lg border border-borda-forte bg-fundo/95 px-3 py-2 text-xs shadow-xl"
          style={x(mira) > largura / 2 ? { right: largura - x(mira) + 12 } : { left: x(mira) + 12 }}>
          <p className="mb-1.5 font-semibold text-texto-2">até {horaCurta(mira)}</p>
          {valoresNaMira.map(({ s, v }) => (
            <p key={s.id} className="flex items-center justify-between gap-4 py-0.5">
              <span className="flex items-center gap-1.5 text-texto-2">
                <span className="h-2 w-2 rounded-full" style={{ background: s.cor }} /> {s.nome}
              </span>
              <span className="font-semibold tabular-nums text-texto">{dinheiro(v)}</span>
            </p>
          ))}
        </div>
      )}
    </>
  )
}

// Empurra rótulos para baixo até ficarem `espaco` px um do outro.
function afastar(itens, espaco) {
  const ordenados = [...itens].sort((a, b) => a.y - b.y)
  for (let i = 1; i < ordenados.length; i++) {
    if (ordenados[i].y - ordenados[i - 1].y < espaco) ordenados[i].y = ordenados[i - 1].y + espaco
  }
  return ordenados
}

function Legenda({ series }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-2">
      {series.map((s) => (
        <li key={s.id} className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: s.cor }} aria-hidden /> {s.nome}
        </li>
      ))}
    </ul>
  )
}

// Ranking do dia: a mesma informação do gráfico em forma de tabela.
// Ranking do dia: a mesma informação do gráfico, em lista. A barra mede cada
// um contra o primeiro colocado; cor = a mesma da linha do vendedor.
function Ranking({ series, ehHoje }) {
  const total = series.reduce((soma, s) => soma + s.total, 0)
  const lider = Math.max(0, ...series.map((s) => s.total))
  const ordenadas = [...series].sort((a, b) => b.total - a.total)
  return (
    <section className="min-w-0 rounded-2xl border border-borda bg-card p-5">
      <h2 className="font-semibold">{ehHoje ? 'Ranking de hoje' : 'Ranking do dia'}</h2>
      <p className="mt-0.5 text-xs text-texto-3">{ehHoje ? 'Quem mais vendeu até agora' : 'Quem mais vendeu no dia'}</p>
      <ol className="mt-4 space-y-4">
        {ordenadas.map((s, i) => (
          <li key={s.id}>
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-fundo"
                style={{ background: s.cor }}>
                {s.nome.trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {i === 0 && total > 0 && <span title="1º lugar">🏆</span>}
                  {s.nome}
                </p>
                <p className="text-xs text-texto-3 tabular-nums">
                  {fmtQtd(s.pecas)} peça{Number(s.pecas) === 1 ? '' : 's'}
                  {total > 0 && ` · ${Math.round((s.total / total) * 100)}%`}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">{dinheiro(s.total)}</p>
            </div>
            <div className="ml-12 mt-2 h-1.5 overflow-hidden rounded-full bg-elevado" aria-hidden>
              <div className="h-full rounded-full transition-[width] duration-700"
                style={{ width: lider ? `${(s.total / lider) * 100}%` : 0, background: s.cor }} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

// Largura real do contêiner, para o SVG desenhar em pixels (texto nítido).
// Ref de callback: o contêiner só existe depois da 1ª venda do dia.
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
