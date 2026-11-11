import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { inicioDeHoje } from '@/lib/formato'

// Leitura de vendas e vendedores, usada pela tela de Vendas e pelo dashboard.
// .js de propósito: o registro de clientes só indexa .jsx como página.

// Vendas de um dia (da meia-noite à meia-noite, no horário do navegador).
// `dia` = meia-noite do dia em ms. `atualizarACada` (ms) relê sozinho: o
// dashboard aberto no balcão acompanha as vendas de hoje.
export function useVendasDoDia(clienteId, dia, { atualizarACada } = {}) {
  const [estado, setEstado] = useState({ chave: null, vendas: [], erro: false })
  const [versao, setVersao] = useState(0)
  const base = `${clienteId}:${dia}`
  const chave = `${base}:${versao}`

  useEffect(() => {
    if (!supabaseConfigurado || !clienteId) return
    let cancelado = false
    supabase.from('vendas')
      .select('id, pedido_id, produto_id, produto_nome, vendedor_id, vendedor_nome, quantidade, preco_unitario, custo_unitario, vendido_em, forma_pagamento')
      .eq('cliente_id', clienteId)
      .gte('vendido_em', new Date(dia).toISOString())
      .lt('vendido_em', new Date(proximoDia(dia)).toISOString())
      .order('vendido_em', { ascending: true })
      .then(({ data, error }) => {
        if (!cancelado) setEstado({ chave, vendas: data ?? [], erro: Boolean(error) })
      })
    return () => { cancelado = true }
  }, [clienteId, dia, chave])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  useEffect(() => {
    if (!atualizarACada) return
    const t = setInterval(recarregar, atualizarACada)
    const aoVoltar = () => document.visibilityState === 'visible' && recarregar()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar) }
  }, [atualizarACada, recarregar])

  if (!supabaseConfigurado) {
    const vendas = dia === inicioDeHoje().getTime() ? VENDAS_EXEMPLO : []
    return { vendas, erro: false, carregando: false, recarregar }
  }
  // Trocou de dia: "carregando". Releitura do mesmo dia mantém os dados na tela.
  const jaCarregou = estado.chave !== null && estado.chave.startsWith(`${base}:`)
  return { vendas: jaCarregou ? estado.vendas : [], erro: jaCarregou && estado.erro, carregando: !jaCarregou, recarregar }
}

export const useVendasDeHoje = (clienteId, opcoes) => useVendasDoDia(clienteId, inicioDeHoje().getTime(), opcoes)

// Meia-noite do dia seguinte (respeita horário de verão: soma no calendário, não 24 h).
export function proximoDia(dia, quantos = 1) {
  const d = new Date(dia)
  d.setDate(d.getDate() + quantos)
  return d.getTime()
}

// Todos os vendedores (ativos e não), em ordem de cadastro. A ordem fixa é a
// da cor no gráfico: a cor segue o vendedor, nunca a posição no ranking.
export function useVendedores(clienteId) {
  const [estado, setEstado] = useState({ chave: null, vendedores: [] })
  const [versao, setVersao] = useState(0)
  const chave = `${clienteId}:${versao}`

  useEffect(() => {
    if (!supabaseConfigurado || !clienteId) return
    let cancelado = false
    supabase.from('vendedores').select('id, nome, ativo, criado_em')
      .eq('cliente_id', clienteId).order('criado_em')
      .then(({ data }) => { if (!cancelado) setEstado({ chave, vendedores: data ?? [] }) })
    return () => { cancelado = true }
  }, [clienteId, chave])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  if (!supabaseConfigurado) return { vendedores: VENDEDORES_EXEMPLO, carregando: false, recarregar }
  return { vendedores: estado.vendedores, carregando: estado.chave !== chave, recarregar }
}

// ── Exemplo (modo sem banco, frontend/.env vazio) ─────────────────────────
// Dá para ver o dashboard pronto e mostrar o sistema sem login.

const VENDEDORES_EXEMPLO = [
  { id: 'v1', nome: 'Juninho', ativo: true },
  { id: 'v2', nome: 'Gabriel', ativo: true },
  { id: 'v3', nome: 'Giovani', ativo: true },
]

const VENDAS_EXEMPLO = (() => {
  const hoje = new Date()
  const as = (h, m) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), h, m).toISOString()
  return [
    [9, 12, 'v1', 'Camiseta básica preta M', 2, 59.9, 25],
    [9, 48, 'v2', 'Calça jeans skinny 40', 1, 189.9, 85],
    [10, 30, 'v3', 'Moletom canguru cinza G', 1, 149.9, 62],
    [11, 5, 'v1', 'Vestido midi floral P', 1, 219.9, 90],
    [11, 40, 'v2', 'Camiseta básica branca G', 3, 59.9, 25],
    [13, 15, 'v1', 'Jaqueta jeans M', 1, 279.9, 120],
    [14, 2, 'v3', 'Bermuda sarja 42', 2, 119.9, 48],
    [14, 50, 'v2', 'Boné aba curva', 1, 79.9, null],
    [15, 35, 'v1', 'Calça alfaiataria 38', 1, 199.9, 82],
    [16, 10, 'v3', 'Camisa linho bege M', 1, 169.9, 70],
  ]
    .map(([h, m, vendedor, produto, qtd, preco, custo], i) => ({
      id: `exemplo-${i}`, pedido_id: `exemplo-${i}`, produto_id: null, produto_nome: produto,
      vendedor_id: vendedor, vendedor_nome: VENDEDORES_EXEMPLO.find((v) => v.id === vendedor).nome,
      quantidade: qtd, preco_unitario: preco, custo_unitario: custo, vendido_em: as(h, m),
    }))
    .filter((v) => new Date(v.vendido_em) <= hoje)
})()

// Totais de uma lista de vendas. Lucro só conta vendas com custo conhecido;
// `semCusto` diz quantas ficaram de fora, para a tela avisar.
export function totaisDasVendas(vendas) {
  let pecas = 0
  let valor = 0
  let lucro = 0
  let semCusto = 0
  for (const v of vendas) {
    const qtd = Number(v.quantidade)
    const receita = qtd * Number(v.preco_unitario)
    pecas += qtd
    valor += receita
    if (v.custo_unitario == null) semCusto += 1
    else lucro += receita - qtd * Number(v.custo_unitario)
  }
  // "Vendas" = compras (pedidos); uma compra pode ter várias peças/linhas.
  const pedidos = new Set(vendas.map((v) => v.pedido_id ?? v.id)).size
  return { pecas, valor, lucro, semCusto, vendas: pedidos, linhas: vendas.length }
}

// Linhas da mesma compra juntas, da mais recente para a mais antiga.
export function agruparPedidos(vendas) {
  const porPedido = new Map()
  for (const v of vendas) {
    const chave = v.pedido_id ?? v.id
    const p = porPedido.get(chave) ?? {
      id: chave, vendido_em: v.vendido_em, vendedor_id: v.vendedor_id, vendedor_nome: v.vendedor_nome,
      forma_pagamento: v.forma_pagamento ?? null, itens: [], total: 0, pecas: 0,
    }
    p.itens.push(v)
    p.total += Number(v.quantidade) * Number(v.preco_unitario)
    p.pecas += Number(v.quantidade)
    porPedido.set(chave, p)
  }
  return [...porPedido.values()].sort((a, b) => new Date(b.vendido_em) - new Date(a.vendido_em))
}

// Paleta categórica (modo escuro), validada contra o fundo dos cartões
// (#24272A) com o validador da skill de gráficos: todas as checagens passam.
// Ordem fixa; o 9º vendedor em diante repete a partir do cinza neutro.
export const CORES_VENDEDORES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
export const COR_SEM_VENDEDOR = '#8D949B'

export function corDoVendedor(vendedores, vendedorId) {
  const i = vendedores.findIndex((v) => v.id === vendedorId)
  return i >= 0 && i < CORES_VENDEDORES.length ? CORES_VENDEDORES[i] : COR_SEM_VENDEDOR
}
