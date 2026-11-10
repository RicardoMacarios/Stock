import { Check } from 'lucide-react'
import { corDoVendedor } from '@/pages/vendas/dados'

// Botões dos vendedores ativos, com a inicial na cor de cada um (a mesma do
// gráfico). `todos` = lista completa, para a cor não mudar quando alguém é
// desativado.
export default function SeletorDeVendedor({ vendedores, todos, valor, aoMudar }) {
  return (
    <div className={`grid gap-2 ${vendedores.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
      {vendedores.map((v) => {
        const ativo = valor === v.id
        const cor = corDoVendedor(todos, v.id)
        return (
          <button key={v.id} type="button" onClick={() => aoMudar(ativo ? null : v.id)} aria-pressed={ativo}
            className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-sm transition sm:flex-row sm:justify-center sm:gap-2.5 ${
              ativo ? 'font-semibold text-texto' : 'border-borda text-texto-2 hover:border-borda-forte hover:bg-elevado'
            }`}
            style={ativo ? { borderColor: cor, background: `${cor}1f` } : undefined}>
            <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-fundo" style={{ background: cor }}>
              {v.nome.trim().charAt(0).toUpperCase()}
            </span>
            <span className="max-w-full truncate">{v.nome}</span>
            {ativo && <Check size={14} className="absolute right-1.5 top-1.5" style={{ color: cor }} aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}
