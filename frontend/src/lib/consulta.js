// O Supabase devolve no máximo 1000 linhas por consulta. Para listas que
// podem passar disso (produtos de uma loja grande), busca em páginas até vir
// uma página incompleta. `montar` cria a consulta do zero a cada página e
// precisa ter uma ordem estável (ex.: .order('nome').order('id')).
export async function todasAsLinhas(montar, tamanho = 1000) {
  const linhas = []
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await montar().range(de, de + tamanho - 1)
    if (error) return { data: linhas.length ? linhas : null, error }
    linhas.push(...(data ?? []))
    if (!data || data.length < tamanho) return { data: linhas, error: null }
  }
}
