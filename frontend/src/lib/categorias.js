// Categoria do produto (Camiseta, Bermuda, Calça…). Fica em produtos.categoria,
// gravada em MAIÚSCULAS (como veio da importação), para "camiseta" e
// "Camiseta" não virarem duas. Na tela aparece só com a 1ª letra maiúscula.

export const normalizarCategoria = (texto) => String(texto ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR')

export function nomeCategoria(valor) {
  const t = String(valor ?? '').toLocaleLowerCase('pt-BR')
  return t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1)
}

// Categorias que existem na lista, da mais usada para a menos.
export function categoriasDe(produtos) {
  const conta = new Map()
  for (const p of produtos ?? []) {
    if (p.categoria) conta.set(p.categoria, (conta.get(p.categoria) ?? 0) + 1)
  }
  return [...conta.entries()]
    .map(([valor, quantos]) => ({ valor, rotulo: nomeCategoria(valor), quantos }))
    .sort((a, b) => b.quantos - a.quantos || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
}
