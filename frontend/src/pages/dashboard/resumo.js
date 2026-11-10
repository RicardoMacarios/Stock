// Contas do dashboard, separadas da tela para dar para testar e reaproveitar
// (ex.: uma futura tela de Produtos usa a mesma `situacao`).
//
// .js de propósito: o registro de clientes só indexa .jsx como página.

// Situação de um produto pelo estoque:
//   zerado → 0 unidades (ou menos)
//   baixo  → no mínimo ou abaixo dele (só se o mínimo estiver definido)
//   ok     → o resto
export function situacao(produto) {
  const qtd = Number(produto.quantidade) || 0
  if (qtd <= 0) return 'zerado'
  if (produto.estoque_minimo != null && qtd <= Number(produto.estoque_minimo)) return 'baixo'
  return 'ok'
}

// Quanto do mínimo ainda resta (0 = nada, 1 = exatamente no mínimo).
export function proporcaoDoMinimo(produto) {
  const minimo = Number(produto.estoque_minimo)
  if (!minimo) return 0
  return Math.max(0, Math.min(1, (Number(produto.quantidade) || 0) / minimo))
}

export function resumirEstoque(produtos) {
  const lista = produtos.map((p) => ({ ...p, situacao: situacao(p) }))
  const contagem = { ok: 0, baixo: 0, zerado: 0 }
  let unidades = 0
  for (const p of lista) {
    contagem[p.situacao] += 1
    unidades += Math.max(0, Number(p.quantidade) || 0)
  }

  // Mais urgente primeiro: zerados, depois os baixos com menos do mínimo.
  const repor = lista
    .filter((p) => p.situacao !== 'ok')
    .sort((a, b) =>
      (a.situacao === b.situacao ? 0 : a.situacao === 'zerado' ? -1 : 1) ||
      proporcaoDoMinimo(a) - proporcaoDoMinimo(b) ||
      a.nome.localeCompare(b.nome, 'pt-BR'))

  const recentes = [...lista]
    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
    .slice(0, 5)

  return { total: lista.length, unidades, contagem, repor, recentes }
}

const formatador = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
export const formatarNumero = (n) => formatador.format(Number(n) || 0)

export const porcentagem = (parte, total) => (total ? Math.round((parte / total) * 100) : 0)

// "hoje", "ontem", "há 3 dias" ou "12 de out." — por dia de calendário.
export function quandoFoi(data, agora = new Date()) {
  const dia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dias = Math.round((dia(agora) - dia(new Date(data))) / 86_400_000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 7) return `há ${dias} dias`
  return new Date(data).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
}

// Só para o modo sem banco (frontend/.env vazio): dá para ver a tela pronta.
export function produtosDeExemplo(agora = new Date()) {
  const diasAtras = (n) => new Date(agora.getTime() - n * 86_400_000).toISOString()
  return [
    ['Arroz tipo 1 5kg', 2, 10, 1],
    ['Feijão carioca 1kg', 0, 12, 0],
    ['Óleo de soja 900ml', 4, 6, 3],
    ['Café torrado 500g', 38, 10, 0],
    ['Açúcar refinado 1kg', 25, 8, 2],
    ['Leite integral 1L', 0, 24, 5],
    ['Macarrão espaguete 500g', 60, 15, 9],
    ['Farinha de trigo 1kg', 14, 10, 12],
    ['Sal refinado 1kg', 22, 5, 20],
    ['Molho de tomate 340g', 9, 12, 6],
    ['Detergente 500ml', 48, null, 15],
    ['Papel higiênico 12un', 17, 6, 30],
  ].map(([nome, quantidade, estoque_minimo, dias], i) => ({
    id: `exemplo-${i}`, nome, quantidade, estoque_minimo, criado_em: diasAtras(dias),
  }))
}
