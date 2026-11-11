// Desconto em % sobre a compra inteira. Não existe coluna de desconto: ele é
// rateado no preço de cada peça (como o acerto do condicional já faz), e
// assim Financeiro, Dashboard e ficha do cliente somam o valor final sem
// mudar nada.
//
// Tudo em centavos inteiros para o total gravado bater exato com o da tela.

// "10" / "7,5" → 10 / 7.5. Fora de 0–100 ou inválido → null.
export function lerPercentual(texto) {
  const n = Number(String(texto ?? '').trim().replace('%', '').replace(',', '.'))
  if (!String(texto ?? '').trim() || !Number.isFinite(n) || n < 0 || n > 100) return null
  return n
}

const centavos = (v) => Math.round(Number(v) * 100)

// Total com desconto, arredondado ao centavo.
export function totalComDesconto(bruto, pct) {
  if (!pct) return bruto
  return Math.round(centavos(bruto) * (100 - pct) / 100) / 100
}

// itens: [{ produto_id, quantidade, preco_unitario }] (quantidade inteira).
// Devolve as linhas com o preço já com desconto, somando exatamente
// totalComDesconto. Cada unidade é arredondada para baixo e os centavos que
// sobram vão +1 em algumas unidades; se a sobra pega só parte de uma linha,
// a linha se divide em duas (mesmo produto, preços 1 centavo diferentes).
export function aplicarDesconto(itens, pct) {
  if (!pct) return itens
  const fator = (100 - pct) / 100
  const linhas = itens.map((i) => ({ ...i, unit: Math.floor(centavos(i.preco_unitario) * fator + 1e-9) }))
  const bruto = itens.reduce((s, i) => s + centavos(i.preco_unitario) * i.quantidade, 0)
  const alvo = Math.round(bruto * fator)
  let resto = alvo - linhas.reduce((s, l) => s + l.unit * l.quantidade, 0)

  const saida = []
  for (const { unit, ...l } of linhas) {
    const mais = Math.min(resto, l.quantidade)
    resto -= mais
    if (mais > 0) saida.push({ ...l, quantidade: mais, preco_unitario: (unit + 1) / 100 })
    if (l.quantidade - mais > 0) saida.push({ ...l, quantidade: l.quantidade - mais, preco_unitario: unit / 100 })
  }
  return saida
}
