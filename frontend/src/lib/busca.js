// Busca de produtos por nome ou por qualquer pedaço do código.
// "1534" acha o produto de código antigo 1534 e também quem tem 1534 no meio
// do código de barras (1250000015347). Acento e maiúscula não importam.

const normalizar = (texto) => String(texto ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Código exato (etiqueta bipada ou código antigo digitado inteiro).
export function acharPorCodigo(produtos, texto) {
  const q = normalizar(texto)
  if (!q || !produtos) return undefined
  return produtos.find((p) => normalizar(p.codigo) === q) ??
    produtos.find((p) => p.codigo_legado != null && String(p.codigo_legado) === q)
}

// Peso do resultado: código exato primeiro, depois código antigo que começa
// com o termo, depois o resto. -1 = não combina.
function relevancia(p, q) {
  const codigo = normalizar(p.codigo)
  const legado = p.codigo_legado != null ? String(p.codigo_legado) : ''
  if (codigo === q || legado === q) return 3
  if (legado.startsWith(q)) return 2
  if (codigo.includes(q) || legado.includes(q) || normalizar(p.nome).includes(q)) return 1
  return -1
}

// Filtra e ordena por relevância; empate mantém a ordem recebida.
export function buscarProdutos(produtos, texto) {
  const q = normalizar(texto)
  if (!q) return produtos ?? []
  return (produtos ?? [])
    .map((p, i) => ({ p, i, peso: relevancia(p, q) }))
    .filter((x) => x.peso >= 0)
    .sort((a, b) => b.peso - a.peso || a.i - b.i)
    .map((x) => x.p)
}
