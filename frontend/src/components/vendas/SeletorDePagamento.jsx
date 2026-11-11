import { FORMAS_PAGAMENTO } from '@/lib/pagamento'

// Pix · Crédito · Débito · Dinheiro. Clicar de novo na escolhida desmarca.
export default function SeletorDePagamento({ valor, aoMudar }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {FORMAS_PAGAMENTO.map(({ valor: v, rotulo, Icone }) => {
        const ativo = valor === v
        return (
          <button key={v} type="button" onClick={() => aoMudar(ativo ? null : v)} aria-pressed={ativo}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 px-2 py-2.5 text-sm transition ${
              ativo ? 'border-acento bg-acento/10 font-semibold text-texto' : 'border-borda text-texto-2 hover:border-borda-forte hover:bg-elevado'
            }`}>
            <Icone size={16} className={ativo ? 'text-acento' : undefined} aria-hidden />
            {rotulo}
          </button>
        )
      })}
    </div>
  )
}
