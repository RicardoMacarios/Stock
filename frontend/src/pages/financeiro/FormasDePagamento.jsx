import { CircleHelp } from 'lucide-react'
import { dinheiro, quantidade as fmtQtd } from '@/lib/formato'
import { FORMAS_PAGAMENTO } from '@/lib/pagamento'

// Formas de pagamento do mês: quanto entrou e quanto lucrou em Pix, crédito,
// débito e dinheiro. As formas somam o "Entrou no caixa" e o "Lucro do mês"
// dos cartões de cima. `formas` vem de porFormaDePagamento (dados.js).

// Cor fixa por forma (não a do cliente): a mesma forma tem sempre a mesma cor.
const CORES = { pix: '#14b8a6', credito: '#8b5cf6', debito: '#3b82f6', dinheiro: '#22c55e', sem: '#71717a' }
const SEM_FORMA = { valor: 'sem', rotulo: 'Não informado', Icone: CircleHelp }

export default function FormasDePagamento({ formas, className = '' }) {
  const vazio = { valor: 0, lucro: 0, vendas: 0 }
  // As 4 formas sempre aparecem (zeradas também); "Não informado" só se houver.
  const temSem = formas.sem && (Math.abs(formas.sem.valor) >= 0.01 || Math.abs(formas.sem.lucro) >= 0.01)
  const itens = [...FORMAS_PAGAMENTO, ...(temSem ? [SEM_FORMA] : [])]
    .map(({ valor: chave, ...f }) => ({ ...f, chave, cor: CORES[chave], ...(formas[chave] ?? vazio) }))
  const totalValor = itens.reduce((t, i) => t + Math.max(0, i.valor), 0)
  const totalLucro = itens.reduce((t, i) => t + i.lucro, 0)
  const pct = (v) => (totalValor > 0 ? Math.round((Math.max(0, v) / totalValor) * 100) : 0)

  return (
    <section className={`min-w-0 rounded-2xl border border-borda bg-card p-5 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="font-semibold">Formas de pagamento</h2>
          <p className="mt-0.5 text-xs text-texto-3">Como entrou o dinheiro do mês</p>
        </div>
        <p className="text-sm text-texto-2 tabular-nums">
          Entrou <strong className="text-texto">{dinheiro(totalValor)}</strong> · lucro <strong className="text-texto">{dinheiro(totalLucro)}</strong>
        </p>
      </div>

      {/* Barra única com a fatia de cada forma no que entrou */}
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-elevado" aria-hidden>
        {itens.map((i) => (
          <div key={i.chave} className="h-full transition-[width] duration-700" style={{ width: `${pct(i.valor)}%`, background: i.cor }} />
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {itens.map(({ chave, rotulo, Icone, cor, valor, lucro, vendas }) => (
          <li key={chave} className="min-w-0 rounded-xl border border-borda p-3 sm:p-4" style={{ background: `linear-gradient(135deg, ${cor}14, transparent 70%)` }}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                {/* Ícone só a partir de sm: no celular ele empurrava "Crédito"/"Dinheiro" para "Cré…". */}
                <span className="hidden h-7 w-7 shrink-0 place-items-center rounded-lg sm:grid" style={{ background: `${cor}26`, color: cor }}>
                  <Icone size={15} aria-hidden />
                </span>
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full sm:hidden" style={{ background: cor }} />
                <span className="truncate">{rotulo}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums" style={{ color: cor }}>{pct(valor)}%</span>
            </div>
            {/* Sem truncate: no celular o quadro é estreito e cortava o lucro e as vendas. */}
            <p className="mt-3 text-lg font-bold leading-tight tracking-tight tabular-nums break-words sm:text-xl">{dinheiro(valor)}</p>
            <p className="mt-1 text-xs text-texto-3 tabular-nums">
              lucro <strong className="text-texto-2">{dinheiro(lucro)}</strong>
            </p>
            <p className="text-xs text-texto-3 tabular-nums">
              {vendas > 0 ? `${fmtQtd(vendas)} venda${vendas === 1 ? '' : 's'}` : 'nenhuma venda'}
            </p>
          </li>
        ))}
      </ul>

      {itens.some((i) => i.chave === 'sem') && (
        <p className="mt-3 text-xs text-texto-3">“Não informado”: vendas registradas antes de o sistema pedir a forma de pagamento.</p>
      )}
    </section>
  )
}
