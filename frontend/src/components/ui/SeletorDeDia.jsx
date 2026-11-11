import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { proximoDia } from '@/pages/vendas/dados'

// Usado no Dashboard e no painel de vendas do dia (tela de Vendas).
// ‹ Hoje › com calendário no meio. Não deixa ir para o futuro.
export default function SeletorDeDia({ dia, hoje, setDia }) {
  const ehHoje = dia === hoje
  const rotulo = ehHoje ? 'Hoje' : dia === proximoDia(hoje, -1) ? 'Ontem'
    : new Date(dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const paraCampo = (ms) => {
    const d = new Date(ms)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const botao = 'grid h-10 w-10 place-items-center text-texto-2 transition hover:bg-elevado hover:text-texto disabled:opacity-30 disabled:hover:bg-transparent'

  return (
    <div className="flex items-center overflow-hidden rounded-xl border border-borda-forte bg-card">
      <button type="button" onClick={() => setDia(proximoDia(dia, -1))} aria-label="Dia anterior" className={botao}>
        <ChevronLeft size={18} />
      </button>
      <label className="relative flex h-10 min-w-24 cursor-pointer items-center justify-center gap-2 border-x border-borda px-3 text-sm font-semibold hover:bg-elevado">
        <CalendarDays size={16} className="text-acento" aria-hidden />
        {rotulo}
        {/* Calendário nativo por cima, invisível: abre ao clicar no rótulo. */}
        <input type="date" aria-label="Escolher dia" max={paraCampo(hoje)} value={paraCampo(dia)}
          onChange={(e) => {
            if (!e.target.value) return
            const [a, m, d] = e.target.value.split('-').map(Number)
            setDia(Math.min(new Date(a, m - 1, d).getTime(), hoje))
          }}
          onClick={(e) => e.currentTarget.showPicker?.()}
          className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <button type="button" onClick={() => setDia(proximoDia(dia))} disabled={ehHoje} aria-label="Próximo dia" className={botao}>
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
