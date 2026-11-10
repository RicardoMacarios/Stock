import { Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { dinheiro, lerNumero, quantidade as fmtQtd } from '@/lib/formato'

// As peças de um carrinho (useCarrinho): − qtd +, preço editável, subtotal e
// tirar. Vazio: explica como bipar.
export default function ListaDePecas({ carrinho, vazio = 'Bipe as peças' }) {
  if (carrinho.itens.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-borda-forte px-4 py-8 text-center">
        <ShoppingBag size={28} className="mx-auto text-texto-3" aria-hidden />
        <p className="mt-2 text-sm text-texto-2">{vazio}</p>
        <p className="text-xs text-texto-3">Com o leitor, a câmera ou buscando pelo nome. Bipar a mesma peça de novo soma +1.</p>
      </div>
    )
  }
  return (
    <ul className="divide-y divide-borda rounded-xl border border-borda">
      {carrinho.itens.map((i) => (
        <Item key={i.produto.id} item={i}
          menos={() => carrinho.mudarQtd(i.produto.id, -1)} mais={() => carrinho.mudarQtd(i.produto.id, 1)}
          preco={(v) => carrinho.mudarPreco(i.produto.id, v)} remover={() => carrinho.remover(i.produto.id)} />
      ))}
    </ul>
  )
}

function Item({ item, menos, mais, preco, remover }) {
  const { produto: p, qtd } = item
  const subtotal = (lerNumero(item.preco) || 0) * qtd
  return (
    <li className="surgir flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-sm font-medium">{p.nome}</p>
        <p className="text-xs text-texto-3">
          {p.codigo && <span className="font-mono">{p.codigo} · </span>}{fmtQtd(p.quantidade)} em estoque
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-borda-forte">
          <button type="button" onClick={menos} aria-label={`Menos um ${p.nome}`} className="grid h-8 w-8 place-items-center text-texto-2 hover:text-texto">
            <Minus size={14} />
          </button>
          <span className="w-7 text-center text-sm font-semibold tabular-nums">{qtd}</span>
          <button type="button" onClick={mais} aria-label={`Mais um ${p.nome}`} className="grid h-8 w-8 place-items-center text-texto-2 hover:text-texto">
            <Plus size={14} />
          </button>
        </div>
        <label className="flex h-8 items-center rounded-lg border border-borda-forte bg-fundo px-2 text-sm focus-within:border-acento">
          <span className="text-xs text-texto-3">R$</span>
          <input inputMode="decimal" value={item.preco} onChange={(e) => preco(e.target.value)} aria-label={`Preço de ${p.nome}`}
            className="w-16 bg-transparent pl-1 text-right tabular-nums outline-none" />
        </label>
        <p className="w-24 text-right text-sm font-semibold tabular-nums">{dinheiro(subtotal)}</p>
        <button type="button" onClick={remover} aria-label={`Tirar ${p.nome}`} className="rounded-lg p-1.5 text-texto-3 hover:bg-elevado hover:text-danger">
          <X size={16} />
        </button>
      </div>
    </li>
  )
}
