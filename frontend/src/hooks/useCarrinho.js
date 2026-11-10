import { useState } from 'react'
import toast from 'react-hot-toast'
import { lerNumero, paraCampo, quantidade as fmtQtd } from '@/lib/formato'

// Lista de peças com quantidade e preço (venda, condicional). Não deixa
// passar do estoque. Preço fica como texto (campo editável, "59,90").
export function useCarrinho() {
  const [itens, setItens] = useState([]) // [{ produto, qtd, preco }]

  // Põe na lista, ou soma +1 se a peça já está.
  function adicionar(p) {
    const ja = itens.find((i) => i.produto.id === p.id)?.qtd ?? 0
    if (ja + 1 > Number(p.quantidade)) {
      return toast.error(Number(p.quantidade) <= 0 ? `${p.nome} está sem estoque.` : `Só há ${fmtQtd(p.quantidade)} de ${p.nome}.`)
    }
    setItens((c) => (ja
      ? c.map((i) => (i.produto.id === p.id ? { ...i, qtd: i.qtd + 1 } : i))
      : [...c, { produto: p, qtd: 1, preco: paraCampo(p.preco_venda) }]))
  }

  const mudarQtd = (id, delta) => setItens((c) => c.flatMap((i) => {
    if (i.produto.id !== id) return [i]
    const qtd = i.qtd + delta
    if (qtd <= 0) return []
    if (qtd > Number(i.produto.quantidade)) { toast.error(`Só há ${fmtQtd(i.produto.quantidade)} de ${i.produto.nome}.`); return [i] }
    return [{ ...i, qtd }]
  }))

  const mudarPreco = (id, preco) => setItens((c) => c.map((i) => (i.produto.id === id ? { ...i, preco } : i)))
  const remover = (id) => setItens((c) => c.filter((i) => i.produto.id !== id))
  const limpar = () => setItens([])

  const total = itens.reduce((s, i) => s + (lerNumero(i.preco) || 0) * i.qtd, 0)
  const pecas = itens.reduce((s, i) => s + i.qtd, 0)
  // Primeira peça sem preço válido (para avisar antes de enviar).
  const semPreco = itens.find((i) => { const n = lerNumero(i.preco); return n === null || Number.isNaN(n) })
  // Formato que as RPCs (registrar_pedido, abrir_condicional) recebem.
  const paraEnviar = () => itens.map((i) => ({ produto_id: i.produto.id, quantidade: i.qtd, preco_unitario: lerNumero(i.preco) }))

  return { itens, adicionar, mudarQtd, mudarPreco, remover, limpar, total, pecas, semPreco, paraEnviar }
}
