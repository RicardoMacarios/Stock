import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { HandCoins, Minus, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { traduzirErro } from '@/lib/erros'
import { dinheiro, horaCurta, lerNumero, paraCampo, quantidade as fmtQtd } from '@/lib/formato'
import Painel from '@/components/ui/Painel'
import Passo from '@/components/vendas/Passo'
import SeletorDeVendedor from '@/components/vendas/SeletorDeVendedor'
import SeletorDePagamento from '@/components/vendas/SeletorDePagamento'

// Editar uma venda já registrada (qualquer dia): vendedor, forma de
// pagamento e, por peça, quantidade e preço — ou tirar a peça. O banco
// (editar_pedido) acerta o estoque pela diferença. Venda com valor em aberto
// não deixa mexer nas peças (a conta do cliente depende delas).
//
// `pedido` vem de agruparPedidos; `vendedores` = todos (ativos e não).
export default function EditarVenda({ pedido, vendedores, fechar, salvou }) {
  const [vendedor, setVendedor] = useState(pedido.vendedor_id)
  const [forma, setForma] = useState(pedido.forma_pagamento)
  const [itens, setItens] = useState(() => pedido.itens.map((i) => ({
    id: i.id, nome: i.produto_nome, qtdOriginal: Number(i.quantidade), precoOriginal: Number(i.preco_unitario),
    qtd: Number(i.quantidade), preco: paraCampo(i.preco_unitario),
  })))
  const [temAberto, setTemAberto] = useState(null) // null = conferindo
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let cancelado = false
    supabase.from('contas_receber').select('id').eq('pedido_id', pedido.id).limit(1)
      .then(({ data }) => { if (!cancelado) setTemAberto((data ?? []).length > 0) })
    return () => { cancelado = true }
  }, [pedido.id])

  // Ativos + o da venda (se foi desativado depois, continua aparecendo).
  const opcoes = vendedores.filter((v) => v.ativo || v.id === pedido.vendedor_id)
  const precoDe = (i) => lerNumero(i.preco)
  const precoValido = (i) => i.qtd === 0 || (precoDe(i) !== null && !Number.isNaN(precoDe(i)) && precoDe(i) >= 0)
  const mudou = (i) => i.qtd !== i.qtdOriginal || (i.qtd > 0 && precoDe(i) !== i.precoOriginal)
  const total = itens.reduce((t, i) => t + (precoValido(i) ? i.qtd * (precoDe(i) ?? 0) : 0), 0)
  const sobrou = itens.some((i) => i.qtd > 0)
  const pecasTravadas = temAberto !== false
  const alterar = (id, campos) => setItens((lista) => lista.map((i) => (i.id === id ? { ...i, ...campos } : i)))

  const nada = vendedor === pedido.vendedor_id && forma === pedido.forma_pagamento && !itens.some(mudou)
  const erroItens = !itens.every(precoValido) ? 'Confira os preços.' : !sobrou ? 'Para tirar todas as peças, use "Desfazer" na venda.' : null

  async function salvar() {
    setSalvando(true)
    const { error } = await supabase.rpc('editar_pedido', {
      p_pedido_id: pedido.id,
      p_vendedor_id: vendedor,
      p_forma_pagamento: forma,
      p_itens: itens.filter(mudou).map((i) => ({ venda_id: i.id, quantidade: i.qtd, preco_unitario: i.qtd ? precoDe(i) : i.precoOriginal })),
    })
    setSalvando(false)
    if (error) return toast.error(traduzirErro(error))
    toast.success('Venda atualizada.')
    salvou()
  }

  const dia = new Date(pedido.vendido_em).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <Painel titulo="Editar venda" fechar={fechar}
      rodape={
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-texto-3">Total{total !== pedido.total && <> · antes {dinheiro(pedido.total)}</>}</span>
            <strong className="text-lg tabular-nums">{dinheiro(total)}</strong>
          </div>
          {erroItens && <p className="text-xs text-danger">{erroItens}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={fechar} className="flex-1 rounded-xl border border-borda-forte px-4 py-2.5 text-sm font-medium hover:bg-elevado">
              Cancelar
            </button>
            <button type="button" onClick={salvar} disabled={nada || salvando || Boolean(erroItens)}
              className="flex-1 rounded-xl bg-acento px-4 py-2.5 text-sm font-semibold text-sobre-acento transition hover:opacity-90 disabled:opacity-40">
              {salvando ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      }>
      <p className="-mt-2 text-sm text-texto-3 first-letter:uppercase">{dia} · {horaCurta(pedido.vendido_em)}</p>

      {opcoes.length > 0 && (
        <section className="space-y-3">
          <Passo numero="1" titulo="Quem vendeu?" />
          <SeletorDeVendedor vendedores={opcoes} todos={vendedores} valor={vendedor} aoMudar={setVendedor} />
        </section>
      )}

      <section className="space-y-3">
        <Passo numero={opcoes.length > 0 ? '2' : '1'} titulo="Pagamento" />
        <SeletorDePagamento valor={forma} aoMudar={setForma} />
      </section>

      <section className="space-y-3">
        <Passo numero={opcoes.length > 0 ? '3' : '2'} titulo="Peças" />
        {temAberto && (
          <p className="flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-texto-2">
            <HandCoins size={14} className="mt-0.5 shrink-0 text-warn" aria-hidden />
            Esta venda tem valor em aberto no nome do cliente: as peças não podem ser alteradas. Para mudar, desfaça a venda e lance de novo.
          </p>
        )}
        <ul className="space-y-2">
          {itens.map((i) => {
            const tirada = i.qtd === 0
            return (
              <li key={i.id} className={`rounded-xl border border-borda p-3 ${tirada ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className={`min-w-0 text-sm font-medium ${tirada ? 'line-through' : ''}`}>{i.nome}</p>
                  {!pecasTravadas && (tirada ? (
                    <button type="button" onClick={() => alterar(i.id, { qtd: i.qtdOriginal })}
                      className="inline-flex shrink-0 items-center gap-1 text-xs text-texto-2 hover:text-texto">
                      <RotateCcw size={12} /> Manter
                    </button>
                  ) : (
                    <button type="button" onClick={() => alterar(i.id, { qtd: 0 })} aria-label={`Tirar ${i.nome} da venda`}
                      className="shrink-0 rounded-md p-1 text-texto-3 hover:bg-danger/12 hover:text-danger">
                      <Trash2 size={14} />
                    </button>
                  ))}
                </div>
                {tirada ? (
                  <p className="mt-1 text-xs text-texto-3">Sai da venda e volta {fmtQtd(i.qtdOriginal)} ao estoque.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <div className="flex items-center overflow-hidden rounded-lg border border-borda-forte">
                      <button type="button" disabled={pecasTravadas || i.qtd <= 1} onClick={() => alterar(i.id, { qtd: i.qtd - 1 })}
                        aria-label="Uma a menos" className="grid h-8 w-8 place-items-center text-texto-2 hover:bg-elevado disabled:opacity-30">
                        <Minus size={14} />
                      </button>
                      <span className="w-9 text-center text-sm font-semibold tabular-nums">{fmtQtd(i.qtd)}</span>
                      <button type="button" disabled={pecasTravadas} onClick={() => alterar(i.id, { qtd: i.qtd + 1 })}
                        aria-label="Uma a mais" className="grid h-8 w-8 place-items-center text-texto-2 hover:bg-elevado disabled:opacity-30">
                        <Plus size={14} />
                      </button>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-texto-3">
                      × R$
                      <input inputMode="decimal" value={i.preco} disabled={pecasTravadas} onChange={(e) => alterar(i.id, { preco: e.target.value })}
                        aria-label={`Preço de ${i.nome}`}
                        className={`w-24 rounded-lg border bg-fundo px-2 py-1.5 text-sm tabular-nums text-texto disabled:opacity-50 ${precoValido(i) ? 'border-borda-forte' : 'border-danger'}`} />
                    </label>
                    <span className="ml-auto text-sm font-semibold tabular-nums">{precoValido(i) ? dinheiro(i.qtd * precoDe(i)) : '—'}</span>
                  </div>
                )}
                {!tirada && i.qtd !== i.qtdOriginal && (
                  <p className="mt-1.5 text-xs text-texto-3">
                    {i.qtd > i.qtdOriginal ? `Baixa mais ${fmtQtd(i.qtd - i.qtdOriginal)} do estoque.` : `Volta ${fmtQtd(i.qtdOriginal - i.qtd)} ao estoque.`}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </Painel>
  )
}
