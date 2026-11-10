import { useState } from 'react'
import toast from 'react-hot-toast'
import { Check, Copy, Loader2, MessageCircle, RefreshCw, Ticket } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { traduzirErro } from '@/lib/erros'
import { classeCampo } from '@/lib/classes'
import { restante } from './useConvites'

// Emissão dos convites que liberam o cadastro de um cliente (como no BarberVez).
// Sem um deles não nasce cliente: a RPC criar_cliente_com_convite é a única
// porta e exige um código não usado e dentro do prazo.

const PRAZOS = [
  { minutos: 5, rotulo: '5 min' },
  { minutos: 30, rotulo: '30 min' },
  { minutos: 240, rotulo: '4 horas' },
]

const linkDoConvite = (codigo) => `${location.origin}/cadastro?codigo=${codigo}`

const linkWhatsApp = (codigo) =>
  `https://wa.me/?text=${encodeURIComponent(
    `Seu convite para o Stock: ${linkDoConvite(codigo)}\n\nAbra o link e cadastre sua empresa. O código ${codigo} vale uma vez só.`,
  )}`

function formatarQuando(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Os dados (lista + relógio) vêm de useConvites(), na página.
export default function PainelConvites({ convites, carregar, agora, aoGerar }) {
  const [nota, setNota] = useState('')
  const [minutos, setMinutos] = useState(5)
  const [gerando, setGerando] = useState(false)
  const [copiado, setCopiado] = useState(null)

  async function copiar(codigo) {
    try {
      await navigator.clipboard.writeText(linkDoConvite(codigo))
      setCopiado(codigo)
      setTimeout(() => setCopiado((c) => (c === codigo ? null : c)), 2000)
    } catch {
      toast(`Código: ${codigo}`)
    }
  }

  async function gerar(e) {
    e.preventDefault()
    setGerando(true)
    const { data, error } = await supabase.rpc('gerar_convite', { p_nota: nota || null, p_minutos: minutos })
    setGerando(false)
    if (error) return toast.error(traduzirErro(error))
    setNota('')
    await copiar(data.codigo)
    toast.success('Convite gerado e link copiado.')
    carregar()
    aoGerar?.()
  }

  return (
    <section className="rounded-xl border border-borda bg-card p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Ticket size={18} className="text-acento" /> Convites
        </h2>
        <button onClick={carregar} aria-label="Recarregar convites"
          className="rounded-lg p-2 text-texto-3 transition hover:bg-elevado hover:text-texto">
          <RefreshCw size={15} />
        </button>
      </div>
      <p className="mt-1 text-sm text-texto-3">
        Sem convite não se cria empresa. Cada código serve uma vez só e vence no prazo escolhido.
        O link sai copiado, pronto para mandar no WhatsApp.
      </p>

      {/* Emissão */}
      <form onSubmit={gerar} className="mt-5 space-y-4 rounded-xl border border-borda bg-fundo/50 p-4">
        <label className="block text-sm font-medium text-texto-2">
          Para quem <span className="font-normal text-texto-3">(opcional)</span>
          <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={120}
            placeholder="Ex.: Mercado do Zé — José" className={`${classeCampo} mt-1.5 rounded-lg`} />
        </label>
        <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-texto-2">Vale por</legend>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-borda-forte bg-fundo p-1">
            {PRAZOS.map((p) => (
              <button key={p.minutos} type="button" onClick={() => setMinutos(p.minutos)} aria-pressed={minutos === p.minutos}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition ${
                  minutos === p.minutos ? 'bg-acento font-semibold text-sobre-acento' : 'text-texto-2 hover:bg-elevado'
                }`}>
                {p.rotulo}
              </button>
            ))}
          </div>
        </fieldset>
        <button disabled={gerando}
          className="flex h-[2.625rem] items-center justify-center gap-2 rounded-lg bg-acento px-4 font-semibold text-sobre-acento transition hover:brightness-110 disabled:opacity-60">
          {gerando ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />}
          {gerando ? 'Gerando…' : 'Gerar convite'}
        </button>
        </div>
      </form>

      {/* Emitidos */}
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-texto-3">Emitidos</h3>
      <div className="mt-1">
        {convites === null ? (
          <p className="py-3 text-sm text-texto-3">Carregando…</p>
        ) : convites.length === 0 ? (
          <p className="py-6 text-center text-sm text-texto-3">Nenhum convite emitido ainda.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {convites.map((c) => (
              <LinhaConvite key={c.codigo} convite={c} agora={agora} copiado={copiado === c.codigo} copiar={copiar} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function LinhaConvite({ convite: c, agora, copiado, copiar }) {
  const falta = c.usado_em ? null : restante(c.expira_em, agora)
  const usavel = Boolean(falta)

  let situacao
  if (c.usado_em) situacao = <span className="text-texto-3">Usado por {c.usado_por_email ?? '—'}</span>
  else if (falta) situacao = <span className="text-ok tabular-nums">Expira em {falta}</span>
  else situacao = <span className="text-texto-3">Expirado</span>

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
      <div className="min-w-0">
        <p className={`font-mono text-base font-semibold tracking-wider ${usavel ? 'text-texto' : 'text-texto-3 line-through decoration-1'}`}>
          {c.codigo}
        </p>
        <p className="truncate text-xs">
          {situacao}
          {c.nota && <span className="text-texto-3"> · {c.nota}</span>}
        </p>
        {c.cliente_slug && (
          <p className="truncate text-xs text-texto-3">
            Virou <a href={`/${c.cliente_slug}`} className="text-texto-2 underline hover:text-texto">{c.cliente_nome}</a>
            {' · '}{formatarQuando(c.usado_em)}
          </p>
        )}
      </div>
      {usavel && (
        <div className="flex gap-2">
          <button onClick={() => copiar(c.codigo)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-borda-forte px-3 py-1.5 text-xs font-medium transition hover:bg-elevado">
            {copiado ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
            {copiado ? 'Copiado' : 'Copiar link'}
          </button>
          <a href={linkWhatsApp(c.codigo)} target="_blank" rel="noopener noreferrer" aria-label={`Enviar o convite ${c.codigo} no WhatsApp`}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-borda-forte px-3 py-1.5 text-xs font-medium transition hover:border-acento hover:text-acento">
            <MessageCircle size={13} className="text-acento" /> WhatsApp
          </a>
        </div>
      )}
    </li>
  )
}
