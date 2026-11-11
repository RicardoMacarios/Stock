// Registro dos clientes — onde a base e a personalização de cada slug se encontram.
//
// Tudo é descoberto pela estrutura de pastas (import.meta.glob), em tempo de
// build. Criar a pasta src/clientes/<slug>/ já basta; não há lista para manter.
//
//   src/clientes/<slug>/config.js          sobrescreve chaves de config/padrao.js
//   src/clientes/<slug>/paginas/X.jsx      substitui a página base X.jsx (pages/**)
//   src/clientes/<slug>/componentes/X.jsx  substitui o componente base X.jsx (components/**)
//   src/clientes/<slug>/estilo.css         CSS extra, ligado só enquanto o cliente está na tela
//
// Cliente sem pasta = 100% base. A pasta só existe quando ele quer algo diferente.

import { lazy } from 'react'
import padrao from '@/config/padrao'

// O _modelo é só o molde de pasta nova, não um cliente. O Vite exige texto
// literal nos padrões do glob (nada de constante), por isso a repetição.
const configs = import.meta.glob(['./*/config.js', '!./_modelo/**'], { eager: true, import: 'default' })
const paginasCliente = import.meta.glob(['./*/paginas/*.jsx', '!./_modelo/**'])
const componentesCliente = import.meta.glob(['./*/componentes/*.jsx', '!./_modelo/**'])
const estilosCliente = import.meta.glob(['./*/estilo.css', '!./_modelo/**'], { query: '?inline', import: 'default' })

const paginasBase = import.meta.glob('../pages/**/*.jsx')
// ErrorBoundary fica fora: envolve o app inteiro, antes de existir cliente.
const componentesBase = import.meta.glob(['../components/**/*.jsx', '!../components/ErrorBoundary.jsx'])

// ── Índices ───────────────────────────────────────────────────────────────

const nomeDoArquivo = (caminho) => caminho.split('/').pop().replace(/\.jsx$/, '')
const slugDoCaminho = (caminho) => caminho.split('/')[1]

// Base indexada pelo nome do arquivo. O nome é a chave da substituição, então
// dois arquivos base com o mesmo nome seria ambíguo: falha cedo.
function indexarBase(modulos, tipo) {
  const indice = {}
  for (const [caminho, carregar] of Object.entries(modulos)) {
    const nome = nomeDoArquivo(caminho)
    if (indice[nome]) {
      throw new Error(`${tipo} base duplicada: "${nome}" existe em mais de uma pasta. Renomeie uma delas.`)
    }
    indice[nome] = carregar
  }
  return indice
}

// { slug: { Nome: loader } }
function indexarPorCliente(modulos) {
  const indice = {}
  for (const [caminho, carregar] of Object.entries(modulos)) {
    const slug = slugDoCaminho(caminho)
    ;(indice[slug] ??= {})[nomeDoArquivo(caminho)] = carregar
  }
  return indice
}

const indice = {
  pagina: { base: indexarBase(paginasBase, 'Página'), cliente: indexarPorCliente(paginasCliente) },
  componente: { base: indexarBase(componentesBase, 'Componente'), cliente: indexarPorCliente(componentesCliente) },
}

const configPorSlug = Object.fromEntries(
  Object.entries(configs).map(([caminho, cfg]) => [slugDoCaminho(caminho), cfg]),
)

// ── Config ────────────────────────────────────────────────────────────────

const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// Objetos se fundem chave a chave; qualquer outro valor (inclusive array) é
// substituído inteiro. Assim `modulos: { produtos: false }` desliga só produtos.
export function mesclar(base, extra) {
  if (!ehObjeto(extra)) return extra === undefined ? base : extra
  const saida = { ...base }
  for (const [chave, valor] of Object.entries(extra)) {
    saida[chave] = ehObjeto(valor) && ehObjeto(base?.[chave]) ? mesclar(base[chave], valor) : valor
  }
  return saida
}

export function temPersonalizacao(slug) {
  return Boolean(configPorSlug[slug] || indice.pagina.cliente[slug] || indice.componente.cliente[slug])
}

export function configDoCliente(slug, sobreposicao) {
  return mesclar(mesclar(padrao, configPorSlug[slug] ?? {}), sobreposicao ?? {})
}

export function carregarEstiloDoCliente(slug) {
  const carregar = estilosCliente[`./${slug}/estilo.css`]
  return carregar ? carregar() : Promise.resolve(null)
}

// ── Páginas e componentes ─────────────────────────────────────────────────

// React.lazy precisa ser criado uma vez por (tipo, slug, nome); recriar a cada
// render remontaria a página e perderia o estado.
const cacheLazy = new Map()
// Módulos já baixados (pré-carga). Página já baixada é usada direto, sem
// lazy: abre sem passar pelo "Carregando…".
const modulos = new Map()

function carregadorDe(tipo, nome, slug) {
  const carregar = indice[tipo].cliente[slug]?.[nome] ?? indice[tipo].base[nome]
  if (!carregar) {
    throw new Error(`${tipo} "${nome}" não existe na base nem em src/clientes/${slug}/.`)
  }
  return carregar
}

function resolver(tipo, nome, slug) {
  const chave = `${tipo}:${slug}:${nome}`
  if (cacheLazy.has(chave)) return cacheLazy.get(chave)

  const pronto = modulos.get(chave)
  const componente = pronto ? pronto.default : lazy(carregadorDe(tipo, nome, slug))
  cacheLazy.set(chave, componente)
  return componente
}

export const resolverPagina = (nome, slug) => resolver('pagina', nome, slug)
export const resolverComponente = (nome, slug) => resolver('componente', nome, slug)

// Baixa em segundo plano as páginas do menu: quando clicar, já estão aqui.
// Falha (sem internet etc.) não importa: a página baixa no clique, como antes.
export function preCarregarPaginas(nomes, slug) {
  for (const nome of nomes) {
    const chave = `pagina:${slug}:${nome}`
    if (modulos.has(chave)) continue
    try {
      carregadorDe('pagina', nome, slug)().then((m) => { if (m?.default) modulos.set(chave, m) }, () => {})
    } catch {
      // nome desconhecido: a rota mostra o erro quando abrir
    }
  }
}

// Para conferência (ex.: tela de admin, debug): o que este cliente tem de diferente.
export function resumoDoCliente(slug) {
  return {
    config: configPorSlug[slug] ?? null,
    paginas: Object.keys(indice.pagina.cliente[slug] ?? {}),
    componentes: Object.keys(indice.componente.cliente[slug] ?? {}),
    estilo: Boolean(estilosCliente[`./${slug}/estilo.css`]),
  }
}
