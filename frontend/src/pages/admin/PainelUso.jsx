import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Archive, CalendarClock, ExternalLink, Gauge, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Quanto do plano Free do Supabase já foi gasto. Os números vêm da RPC
// admin_uso_plataforma; o histórico, de admin_uso_historico (um ponto por dia,
// gravado pelo pg_cron). Os limites são os do plano Free — se o projeto mudar
// de plano, é aqui que se troca.
const MB = 1024 * 1024
const GB = 1024 * MB

const LIMITES = {
  banco: 500 * MB,
  arquivos: 1 * GB,
  ativos: 50000,
}

// Tráfego e fatura só o painel do Supabase mostra (ver a migration).
const ref = (() => {
  try { return new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0] } catch { return '' }
})()
const LINK_USO = `https://supabase.com/dashboard/project/${ref}/usage`

// Nome de tela das tabelas; a que não estiver aqui aparece com o nome do banco.
const NOME_TABELA = {
  clientes: 'Empresas',
  cliente_membros: 'Membros das empresas',
  produtos: 'Produtos',
  produtos_removidos: 'Produtos removidos',
  plataforma_admins: 'Admins da plataforma',
  convites: 'Convites',
  vendedores: 'Vendedores',
  vendas: 'Vendas',
  clientes_loja: 'Clientes das lojas',
  condicionais: 'Condicionais',
  condicional_itens: 'Peças em condicional',
  contas_receber: 'Contas a receber',
  recebimentos: 'Recebimentos',
  uso_historico: 'Histórico de uso',
}

function formatarBytes(n) {
  if (n == null) return '—'
  if (n >= 1000 * MB) return `${(n / GB).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GB`
  if (n >= MB) return `${(n / MB).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
  return `${Math.round(n / 1024).toLocaleString('pt-BR')} KB`
}

function formatarNumero(n) {
  return n == null ? '—' : Number(n).toLocaleString('pt-BR')
}

function formatarHora(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function formatarDia(dia) {
  const [, m, d] = String(dia).split('-')
  return d && m ? `${d}/${m}` : '—'
}

// Virada do ciclo de cobrança. O dia do ciclo mora no banco
// (ciclo_cobranca_atual); aqui só se conta quantos dias faltam, no fuso de Brasília.
function renovacao(fim) {
  const [a, m, d] = String(fim).split('-').map(Number)
  if (!a || !m || !d) return null
  const [ha, hm, hd] = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).split('-').map(Number)
  const dias = Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86400000)
  return { data: formatarDia(fim), dias }
}

function textoRenovacao(ciclo) {
  if (!ciclo) return 'Zera na virada do ciclo'
  if (ciclo.dias <= 0) return `Zera hoje, ${ciclo.data}`
  return `Zera em ${ciclo.data}, ${ciclo.dias === 1 ? 'amanhã' : `daqui a ${ciclo.dias} dias`}`
}

// Verde até 70%, amarelo até 90%, vermelho depois. No Free, passar do limite
// não cobra: o Supabase restringe o projeto.
function corDaFaixa(pct) {
  if (pct >= 90) return { barra: 'bg-danger', texto: 'text-danger' }
  if (pct >= 70) return { barra: 'bg-warn', texto: 'text-warn' }
  return { barra: 'bg-ok', texto: 'text-ok' }
}

// Linha do histórico diário embaixo de cada medidor. Cada medida tem a sua
// escala (bytes e usuários não dividem eixo). A leitura acima da linha mostra
// o dia sob o ponteiro, ou o último dia quando ninguém está apontando.
function Tendencia({ pontos, campo, formatar, rotulo }) {
  const [ativo, setAtivo] = useState(null)
  const serie = pontos.map((p) => ({ dia: p.dia, v: Number(p[campo]) }))

  if (serie.length < 2) {
    return (
      <p className="text-xs text-texto-3">
        {serie.length
          ? `Histórico começou em ${formatarDia(serie[0].dia)}; a linha aparece com a próxima medição.`
          : 'Sem histórico ainda.'}
      </p>
    )
  }

  const valores = serie.map((s) => s.v)
  let min = Math.min(...valores)
  let max = Math.max(...valores)
  if (max === min) { const folga = max * 0.05 || 1; min -= folga; max += folga }
  const respiro = (max - min) * 0.12
  min -= respiro; max += respiro

  const x = (i) => (i / (serie.length - 1)) * 100
  const y = (v) => (1 - (v - min) / (max - min)) * 100
  const linha = serie.map((s, i) => `${i ? 'L' : 'M'}${x(i)},${y(s.v)}`).join('')
  const i = ativo ?? serie.length - 1
  const ponto = serie[i]

  function apontar(e) {
    const caixa = e.currentTarget.getBoundingClientRect()
    const frac = (e.clientX - caixa.left) / caixa.width
    setAtivo(Math.max(0, Math.min(serie.length - 1, Math.round(frac * (serie.length - 1)))))
  }

  function teclar(e) {
    if (e.key === 'ArrowLeft') setAtivo(Math.max(0, i - 1))
    else if (e.key === 'ArrowRight') setAtivo(Math.min(serie.length - 1, i + 1))
    else return
    e.preventDefault()
  }

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-texto-3">
          {ativo == null ? `${formatarDia(serie[0].dia)} a ${formatarDia(ponto.dia)}` : formatarDia(ponto.dia)}
        </span>
        <span className="font-semibold tabular-nums text-texto">{formatar(ponto.v)}</span>
      </div>

      <div className="relative h-12 cursor-crosshair rounded outline-none focus-visible:ring-1 focus-visible:ring-borda-forte"
        tabIndex={0} role="img"
        aria-label={`${rotulo}: de ${formatar(serie[0].v)} em ${formatarDia(serie[0].dia)} para ${formatar(serie.at(-1).v)} em ${formatarDia(serie.at(-1).dia)}`}
        onPointerMove={apontar} onPointerLeave={() => setAtivo(null)}
        onKeyDown={teclar} onBlur={() => setAtivo(null)}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <line x1="0" y1="100" x2="100" y2="100" className="stroke-borda" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={`${linha}L100,100L0,100Z`} className="fill-acento" fillOpacity="0.1" />
          <path d={linha} fill="none" className="stroke-acento" strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {ativo != null && (
          <span className="pointer-events-none absolute bottom-0 top-0 w-px bg-borda-forte" style={{ left: `${x(i)}%` }} />
        )}
        <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-acento ring-2 ring-card"
          style={{ left: `${x(i)}%`, top: `${y(ponto.v)}%` }} />
      </div>

      <table className="sr-only">
        <caption>{rotulo} por dia</caption>
        <tbody>
          {serie.map((s) => <tr key={s.dia}><th>{formatarDia(s.dia)}</th><td>{formatar(s.v)}</td></tr>)}
        </tbody>
      </table>
    </div>
  )
}

// Maiores tabelas em barras: uma série só, então uma cor só; o valor fica
// escrito na ponta, em tinta de texto.
function BarrasTabelas({ tabelas }) {
  const maior = Math.max(...tabelas.map((t) => Number(t.bytes) || 0), 1)
  return (
    <ul className="mt-2 space-y-0.5">
      {tabelas.map((t) => {
        const pct = (Number(t.bytes) / maior) * 100
        return (
          <li key={t.nome} title={t.nome}
            className="group -mx-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg px-1.5 py-1 text-xs transition-colors hover:bg-elevado sm:grid-cols-[minmax(0,11rem)_1fr_auto]">
            <span className="truncate text-texto-2 group-hover:text-texto">{NOME_TABELA[t.nome] ?? t.nome}</span>
            {/* No celular a barra desce para a linha de baixo, na largura toda */}
            <div className="order-last col-span-2 h-2 sm:order-none sm:col-span-1">
              <div className="h-full rounded-r bg-acento transition-[filter] group-hover:brightness-110"
                style={{ width: `${Math.max(pct, 1)}%` }} />
            </div>
            <span className="whitespace-nowrap text-right tabular-nums text-texto-3 group-hover:text-texto-2">
              {formatarNumero(t.linhas)} {Number(t.linhas) === 1 ? 'linha' : 'linhas'} · {formatarBytes(t.bytes)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function Medidor({ titulo, usado, limite, formatar, detalhe, renova, ciclico = false, children }) {
  const pct = limite ? Math.min(100, (usado / limite) * 100) : 0
  const falta = Math.max(0, (limite ?? 0) - (usado ?? 0))
  const cor = corDaFaixa(pct)
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{titulo}</p>
        <p className={`text-xs font-semibold tabular-nums ${cor.texto}`}>
          {pct.toLocaleString('pt-BR', { maximumFractionDigits: pct < 1 ? 2 : 0 })}%
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-elevado"
        role="meter" aria-label={titulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className={`h-full ${cor.barra}`} style={{ width: `${Math.max(pct, 0.5)}%` }} />
      </div>
      <dl className="grid grid-cols-2 gap-3 pt-0.5">
        <div>
          <dt className="text-xs text-texto-3">Gasto</dt>
          <dd className="text-sm font-semibold tabular-nums">{formatar(usado)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-texto-3">Falta</dt>
          <dd className="text-sm font-semibold tabular-nums">{formatar(falta)}</dd>
        </div>
      </dl>
      <p className="text-xs text-texto-3">
        Limite de {formatar(limite)}
        {detalhe && <span> · {detalhe}</span>}
      </p>
      {renova && (
        <p className="flex items-center gap-1.5 text-xs text-texto-2">
          {ciclico
            ? <CalendarClock size={11} className="shrink-0 text-texto-3" aria-hidden="true" />
            : <Archive size={11} className="shrink-0 text-texto-3" aria-hidden="true" />}
          {renova}
        </p>
      )}
      {children && <div className="pt-2">{children}</div>}
    </div>
  )
}

export default function PainelUso() {
  const [uso, setUso] = useState(null)
  const [historico, setHistorico] = useState([])
  const [carregando, setCarregando] = useState(true)

  // O "carregando" já nasce verdadeiro; quem liga de novo é o botão de recarregar.
  // O histórico é acessório: se falhar, os medidores aparecem sem a linha.
  const carregar = useCallback(() => {
    Promise.all([
      supabase.rpc('admin_uso_plataforma'),
      supabase.rpc('admin_uso_historico', { p_dias: 90 }),
    ]).then(([agora, hist]) => {
      if (agora.error) toast.error('Não foi possível carregar o uso do Supabase.')
      else setUso(agora.data)
      if (!hist.error) setHistorico(hist.data ?? [])
      setCarregando(false)
    })
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const ciclo = uso ? renovacao(uso.ciclo_fim) : null

  return (
    <section className="space-y-4 rounded-xl border border-borda bg-card p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Gauge size={18} className="text-acento" /> Uso do Supabase
          <span className="rounded-full bg-elevado px-2 py-0.5 text-xs font-normal text-texto-2">Plano Free</span>
        </h2>
        <button onClick={() => { setCarregando(true); carregar() }} disabled={carregando} aria-label="Recarregar uso"
          className="rounded-lg p-2 text-texto-3 transition hover:bg-elevado hover:text-texto disabled:opacity-50">
          <RefreshCw size={15} className={carregando ? 'animate-spin' : ''} />
        </button>
      </div>

      {carregando && !uso ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-4 w-1/2 rounded bg-elevado" />
              <div className="h-2 w-full rounded bg-elevado" />
              <div className="h-3 w-2/3 rounded bg-elevado" />
            </div>
          ))}
        </div>
      ) : !uso ? (
        <p className="py-2 text-sm text-texto-3">Sem dados de uso no momento.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-8">
            <Medidor titulo="Banco de dados" usado={uso.banco_bytes} limite={LIMITES.banco}
              formatar={formatarBytes} detalhe="conta os bancos internos, como o Supabase"
              renova="Não renova: é o que está guardado">
              <Tendencia pontos={historico} campo="banco_bytes" formatar={formatarBytes} rotulo="Banco de dados" />
            </Medidor>
            <Medidor titulo="Arquivos (logos)" usado={uso.arquivos_bytes} limite={LIMITES.arquivos}
              formatar={formatarBytes} detalhe={`${formatarNumero(uso.arquivos_qtd)} arquivos`}
              renova="Não renova: é o que está guardado">
              <Tendencia pontos={historico} campo="arquivos_bytes" formatar={formatarBytes} rotulo="Arquivos" />
            </Medidor>
            <Medidor titulo="Usuários ativos no ciclo" usado={uso.usuarios_ativos} limite={LIMITES.ativos}
              formatar={formatarNumero} detalhe={`${formatarNumero(uso.usuarios_total)} contas no total`}
              ciclico renova={textoRenovacao(ciclo)}>
              <Tendencia pontos={historico} campo="usuarios_ativos" formatar={formatarNumero} rotulo="Usuários ativos" />
            </Medidor>
          </div>

          {uso.tabelas?.length > 0 && (
            <details open>
              <summary className="cursor-pointer text-sm font-medium text-texto-2 hover:text-texto">
                Maiores tabelas, por espaço
              </summary>
              <BarrasTabelas tabelas={uso.tabelas} />
            </details>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-xs text-texto-3">
              Medido em {formatarHora(uso.medido_em)} · {formatarNumero(uso.clientes)} {Number(uso.clientes) === 1 ? 'empresa' : 'empresas'}.
              Tráfego: 5 GB por ciclo, também zera {ciclo ? `em ${ciclo.data}` : 'na virada'}; o gasto só aparece no painel do Supabase.
            </p>
            <a href={LINK_USO} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-borda-forte px-3 py-1.5 text-xs text-texto-2 transition hover:bg-elevado hover:text-texto">
              Ver no Supabase <ExternalLink size={13} />
            </a>
          </div>
        </>
      )}
    </section>
  )
}
