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

const SEM_MOLDE = '!./_modelo/**'

const configs = import.meta.glob(['./*/config.js', SEM_MOLDE], { eager: true, import: 'default' })
const paginasCliente = import.meta.glob(['./*/paginas/*.jsx', SEM_MOLDE])
const componentesCliente = import.meta.glob(['./*/componentes/*.jsx', SEM_MOLDE])
const estilosCliente = import.meta.glob(['./*/estilo.css', SEM_MOLDE], { query: '?inline', import: 'default' })

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

function resolver(tipo, nome, slug) {
  const chave = `${tipo}:${slug}:${nome}`
  if (cacheLazy.has(chave)) return cacheLazy.get(chave)

  const doCliente = indice[tipo].cliente[slug]?.[nome]
  const daBase = indice[tipo].base[nome]
  const carregar = doCliente ?? daBase

  if (!carregar) {
    throw new Error(`${tipo} "${nome}" não existe na base nem em src/clientes/${slug}/.`)
  }

  const componente = lazy(carregar)
  cacheLazy.set(chave, componente)
  return componente
}

export const resolverPagina = (nome, slug) => resolver('pagina', nome, slug)
export const resolverComponente = (nome, slug) => resolver('componente', nome, slug)

// Para conferência (ex.: tela de admin, debug): o que este cliente tem de diferente.
export function resumoDoCliente(slug) {
  return {
    config: configPorSlug[slug] ?? null,
    paginas: Object.keys(indice.pagina.cliente[slug] ?? {}),
    componentes: Object.keys(indice.componente.cliente[slug] ?? {}),
    estilo: Boolean(estilosCliente[`./${slug}/estilo.css`]),
  }
}
