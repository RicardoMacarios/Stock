import { useEffect, useState } from 'react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { COR_SEM_VENDEDOR, corDoVendedor, receitaDe, totaisDasVendas } from '@/pages/vendas/dados'

// Dados e contas da tela Financeiro (um mês por vez).
// .js de propósito: o registro de clientes só indexa .jsx como página.

const COLUNAS = 'id, pedido_id, produto_nome, vendedor_id, vendedor_nome, quantidade, preco_unitario, custo_unitario, vendido_em, forma_pagamento'
const POR_PAGINA = 1000 // limite padrão de linhas por consulta do Supabase

// Meia-noite do dia 1º do mês de `data`, no horário do navegador.
export function inicioDoMes(data = new Date()) {
  const d = new Date(data)
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
}

export function somarMeses(mes, quantos) {
  const d = new Date(mes)
  return new Date(d.getFullYear(), d.getMonth() + quantos, 1).getTime()
}

export const diasNoMes = (mes) => new Date(new Date(mes).getFullYear(), new Date(mes).getMonth() + 1, 0).getDate()

// Vendas de [de, ate). Lê em páginas: um mês movimentado passa de 1000 linhas.
async function lerVendas(clienteId, de, ate) {
  const todas = []
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await supabase.from('vendas').select(COLUNAS)
      .eq('cliente_id', clienteId)
      .gte('vendido_em', new Date(de).toISOString())
      .lt('vendido_em', new Date(ate).toISOString())
      .order('vendido_em', { ascending: true })
      .range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1)
    if (error) throw error
    todas.push(...data)
    if (data.length < POR_PAGINA) return todas
  }
}

// ── Valor em aberto ───────────────────────────────────────────────────────
// O Financeiro conta o que ENTROU NO CAIXA. Venda de R$ 90 com R$ 50 em
// aberto: no dia da venda entra uma linha de ajuste de −50; no dia em que o
// cliente paga, +50. O lucro segue a mesma proporção (lucro_aberto).
// Linhas de ajuste: { ajuste: true, valor, lucro, quantidade: 0, vendido_em, vendedor, forma_pagamento }.
// O ajuste de −50 sai da forma da própria venda (preenchida em lerMovimento);
// o recebimento entra na forma em que o cliente pagou.

async function lerAjustes(clienteId, de, ate) {
  const desde = new Date(de).toISOString()
  const antes = new Date(ate).toISOString()
  const [contas, recebidos] = await Promise.all([
    supabase.from('contas_receber').select('id, pedido_id, valor_aberto, lucro_aberto, vendedor_id, vendedor_nome, criado_em')
      .eq('cliente_id', clienteId).gte('criado_em', desde).lt('criado_em', antes),
    supabase.from('recebimentos')
      .select('id, valor, forma_pagamento, recebido_em, conta:contas_receber(valor_aberto, lucro_aberto, vendedor_id, vendedor_nome)')
      .eq('cliente_id', clienteId).gte('recebido_em', desde).lt('recebido_em', antes),
  ])
  if (contas.error) throw contas.error
  if (recebidos.error) throw recebidos.error
  const proporcao = (c) => (c?.lucro_aberto == null ? 0 : Number(c.lucro_aberto) / Number(c.valor_aberto))
  return [
    ...contas.data.map((c) => ({
      id: `aberto-${c.id}`, ajuste: true, quantidade: 0, valor: -Number(c.valor_aberto), lucro: -Number(c.lucro_aberto ?? 0),
      vendido_em: c.criado_em, vendedor_id: c.vendedor_id, vendedor_nome: c.vendedor_nome, pedido_id: c.pedido_id,
    })),
    ...recebidos.data.map((r) => ({
      id: `recebido-${r.id}`, ajuste: true, quantidade: 0, valor: Number(r.valor), lucro: Number(r.valor) * proporcao(r.conta),
      vendido_em: r.recebido_em, vendedor_id: r.conta?.vendedor_id ?? null, vendedor_nome: r.conta?.vendedor_nome ?? null,
      forma_pagamento: r.forma_pagamento,
    })),
  ]
}

// Vendas + ajustes de [de, ate), em ordem de horário.
async function lerMovimento(clienteId, de, ate) {
  const [vendas, ajustes] = await Promise.all([lerVendas(clienteId, de, ate), lerAjustes(clienteId, de, ate)])
  const formaDoPedido = new Map(vendas.map((v) => [v.pedido_id, v.forma_pagamento]))
  for (const a of ajustes) {
    if (a.pedido_id) a.forma_pagamento = formaDoPedido.get(a.pedido_id) ?? null
  }
  return [...vendas, ...ajustes].sort((a, b) => new Date(a.vendido_em) - new Date(b.vendido_em))
}

// Quanto os clientes devem hoje (todas as compras com valor em aberto).
export function useAReceber(clienteId) {
  const [estado, setEstado] = useState({ clienteId: null, valor: 0 })
  useEffect(() => {
    if (!supabaseConfigurado || !clienteId) return
    let cancelado = false
    supabase.from('contas_receber').select('valor_aberto, valor_recebido').eq('cliente_id', clienteId).is('quitado_em', null)
      .then(({ data }) => {
        if (cancelado) return
        setEstado({ clienteId, valor: (data ?? []).reduce((s, c) => s + Number(c.valor_aberto) - Number(c.valor_recebido), 0) })
      })
    return () => { cancelado = true }
  }, [clienteId])
  return estado.clienteId === clienteId ? estado.valor : 0
}

// Vendas do mês e do mês anterior (para comparar).
export function useVendasDoMes(clienteId, mes) {
  const [estado, setEstado] = useState({ chave: null, mes: [], anterior: [], erro: false })
  const [versao, setVersao] = useState(0)
  const chave = `${clienteId}:${mes}:${versao}`

  useEffect(() => {
    if (!supabaseConfigurado || !clienteId) return
    let cancelado = false
    Promise.all([
      lerMovimento(clienteId, mes, somarMeses(mes, 1)),
      lerMovimento(clienteId, somarMeses(mes, -1), mes),
    ])
      .then(([doMes, anterior]) => { if (!cancelado) setEstado({ chave, mes: doMes, anterior, erro: false }) })
      .catch(() => { if (!cancelado) setEstado({ chave, mes: [], anterior: [], erro: true }) })
    return () => { cancelado = true }
  }, [clienteId, mes, chave])

  const recarregar = () => setVersao((v) => v + 1)

  if (!supabaseConfigurado) {
    return { vendas: vendasDeExemplo(mes), anterior: vendasDeExemplo(somarMeses(mes, -1)), erro: false, carregando: false, recarregar }
  }
  const pronto = estado.chave === chave
  return { vendas: estado.mes, anterior: estado.anterior, erro: pronto && estado.erro, carregando: !pronto, recarregar }
}

// ── Contas ────────────────────────────────────────────────────────────────

// Uma entrada por dia do mês (dias sem venda ficam zerados).
export function vendasPorDia(vendas, mes) {
  const dias = Array.from({ length: diasNoMes(mes) }, (_, i) => ({ dia: i + 1, valor: 0, lucro: 0, pecas: 0, pedidos: new Set() }))
  for (const v of vendas) {
    const d = dias[new Date(v.vendido_em).getDate() - 1]
    if (v.ajuste) { d.valor += v.valor; d.lucro += v.lucro; continue }
    const qtd = Number(v.quantidade)
    const receita = qtd * Number(v.preco_unitario)
    d.valor += receita
    d.pecas += qtd
    if (v.custo_unitario != null) d.lucro += receita - qtd * Number(v.custo_unitario)
    d.pedidos.add(v.pedido_id ?? v.id)
  }
  return dias.map(({ pedidos, ...d }) => ({ ...d, vendas: pedidos.size }))
}

// Quantos dias do mês já passaram (o de hoje conta). Mês fechado = todos.
export function diasDecorridos(mes, hoje) {
  const fim = somarMeses(mes, 1)
  if (hoje >= fim) return diasNoMes(mes)
  if (hoje < mes) return 0
  return new Date(hoje).getDate()
}

// Média vendida em cada dia da semana (só dias que já passaram), de domingo a
// sábado. `dias` vem de vendasPorDia.
export function mediaPorDiaDaSemana(dias, mes, decorridos) {
  const semana = Array.from({ length: 7 }, (_, i) => ({ dia: i, valor: 0, pecas: 0, quantos: 0 }))
  const d0 = new Date(mes)
  for (const d of dias.slice(0, decorridos)) {
    const s = semana[new Date(d0.getFullYear(), d0.getMonth(), d.dia).getDay()]
    s.valor += d.valor
    s.pecas += d.pecas
    s.quantos += 1
  }
  return semana.map((s) => ({ ...s, media: s.quantos ? s.valor / s.quantos : 0 }))
}

// Totais de cada vendedor no mês, de quem vendeu mais peças para menos
// (empate: quem vendeu mais valor). Cor = a mesma do dashboard.
export function rankingDeVendedores(vendas, vendedores) {
  const porId = new Map()
  for (const v of vendas) {
    const id = v.vendedor_id ?? 'sem'
    const atual = porId.get(id) ?? {
      id,
      nome: v.vendedor_nome ?? (v.vendedor_id ? 'Vendedor removido' : 'Sem vendedor'),
      cor: v.vendedor_id ? corDoVendedor(vendedores, v.vendedor_id) : COR_SEM_VENDEDOR,
      lista: [],
    }
    atual.lista.push(v)
    porId.set(id, atual)
  }
  return [...porId.values()]
    .map(({ lista, ...r }) => ({ ...r, ...totaisDasVendas(lista) }))
    .sort((a, b) => b.pecas - a.pecas || b.valor - a.valor)
}

// Para o gráfico "Por vendedor": quem vendeu no mês, na ordem de cadastro (a
// ordem da cor, igual ao dashboard; "Sem vendedor" por último) e, para cada
// dia, quanto cada um vendeu: dias[i].por[id] = { valor, pecas }.
export function vendasPorDiaEVendedor(vendas, mes, vendedores) {
  const vendeu = new Set(vendas.map((v) => v.vendedor_id ?? 'sem'))
  const series = vendedores.filter((v) => vendeu.has(v.id))
    .map((v) => ({ id: v.id, nome: v.nome, cor: corDoVendedor(vendedores, v.id) }))
  for (const v of vendas) {
    if (v.vendedor_id && !series.some((s) => s.id === v.vendedor_id)) {
      series.push({ id: v.vendedor_id, nome: v.vendedor_nome ?? 'Vendedor removido', cor: COR_SEM_VENDEDOR })
    }
  }
  if (vendeu.has('sem')) series.push({ id: 'sem', nome: 'Sem vendedor', cor: COR_SEM_VENDEDOR })

  const dias = Array.from({ length: diasNoMes(mes) }, (_, i) => ({ dia: i + 1, total: 0, por: {} }))
  for (const v of vendas) {
    const d = dias[new Date(v.vendido_em).getDate() - 1]
    const id = v.vendedor_id ?? 'sem'
    const qtd = Number(v.quantidade)
    const receita = receitaDe(v)
    const p = (d.por[id] ??= { valor: 0, pecas: 0 })
    p.valor += receita
    p.pecas += qtd
    d.total += receita
  }
  return { series, dias }
}

// Peças mais vendidas do mês (por nome do produto).
export function maisVendidos(vendas, limite = 5) {
  const porNome = new Map()
  for (const v of vendas) {
    if (v.ajuste) continue
    const x = porNome.get(v.produto_nome) ?? { nome: v.produto_nome, pecas: 0, valor: 0 }
    x.pecas += Number(v.quantidade)
    x.valor += Number(v.quantidade) * Number(v.preco_unitario)
    porNome.set(v.produto_nome, x)
  }
  return [...porNome.values()].sort((a, b) => b.pecas - a.pecas || b.valor - a.valor).slice(0, limite)
}

// Quanto entrou e quanto lucrou em cada forma de pagamento. Mesma regra do
// "Entrou no caixa": a soma das formas dá o total do mês. `sem` = vendas sem
// forma registrada (anteriores ao campo existir).
export function porFormaDePagamento(vendas) {
  const formas = {}
  for (const v of vendas) {
    const f = (formas[v.forma_pagamento ?? 'sem'] ??= { valor: 0, lucro: 0, pedidos: new Set() })
    if (v.ajuste) { f.valor += v.valor; f.lucro += v.lucro; continue }
    const qtd = Number(v.quantidade)
    const receita = qtd * Number(v.preco_unitario)
    f.valor += receita
    if (v.custo_unitario != null) f.lucro += receita - qtd * Number(v.custo_unitario)
    f.pedidos.add(v.pedido_id ?? v.id)
  }
  return Object.fromEntries(Object.entries(formas).map(([k, { pedidos, ...f }]) => [k, { ...f, vendas: pedidos.size }]))
}

// Variação em % (null quando não há base para comparar).
export const variacao = (atual, antes) => (antes > 0 ? ((atual - antes) / antes) * 100 : null)

// Só as vendas do mês anterior até o mesmo dia/hora de agora: comparar o mês
// em andamento com o mês anterior INTEIRO deixaria tudo "em queda" até o fim.
export function mesmoPeriodo(anterior, mes, agora = Date.now()) {
  if (agora >= somarMeses(mes, 1) || agora < mes) return anterior
  const decorrido = agora - mes
  const limite = somarMeses(mes, -1) + decorrido
  return anterior.filter((v) => new Date(v.vendido_em).getTime() < limite)
}

// ── Exemplo (modo sem banco, frontend/.env vazio) ─────────────────────────

const FORMAS = ['pix', 'pix', 'pix', 'credito', 'credito', 'debito', 'dinheiro']
const VENDEDORES = [['v1', 'Juninho'], ['v2', 'Gabriel'], ['v3', 'Giovani']]
const PECAS = [
  ['Camiseta básica M', 59.9, 25], ['Calça jeans skinny 40', 189.9, 85], ['Moletom canguru G', 149.9, 62],
  ['Vestido midi floral P', 219.9, 90], ['Jaqueta jeans M', 279.9, 120], ['Bermuda sarja 42', 119.9, 48],
  ['Camisa linho bege M', 169.9, 70], ['Boné aba curva', 79.9, null],
]

function vendasDeExemplo(mes) {
  const agora = Date.now()
  if (mes > agora) return []
  // Sorteio fixo por mês: a tela não muda a cada render.
  let semente = new Date(mes).getMonth() + 7
  const sortear = () => ((semente = (semente * 9301 + 49297) % 233280) / 233280)
  const lista = []
  for (let dia = 1; dia <= diasNoMes(mes); dia++) {
    const quantas = Math.floor(sortear() * 7) + (new Date(somarDias(mes, dia - 1)).getDay() === 6 ? 4 : 1)
    for (let i = 0; i < quantas; i++) {
      const [vid, vnome] = VENDEDORES[Math.floor(sortear() * 3.4) % 3]
      const [nome, preco, custo] = PECAS[Math.floor(sortear() * PECAS.length)]
      const quando = somarDias(mes, dia - 1) + (9 + sortear() * 9) * 3_600_000
      if (quando > agora) continue
      lista.push({
        forma_pagamento: FORMAS[Math.floor(sortear() * FORMAS.length)],
        id: `ex-${mes}-${dia}-${i}`, pedido_id: `ex-${mes}-${dia}-${i}`, produto_nome: nome,
        vendedor_id: vid, vendedor_nome: vnome, quantidade: sortear() > 0.8 ? 2 : 1,
        preco_unitario: preco, custo_unitario: custo, vendido_em: new Date(quando).toISOString(),
      })
    }
  }
  return lista
}

function somarDias(mes, n) {
  const d = new Date(mes)
  d.setDate(d.getDate() + n)
  return d.getTime()
}
