import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { todasAsLinhas } from '@/lib/consulta'
import { guardar, lerGuardado } from '@/lib/guardado'

// Produtos da loja, guardados no navegador. Ao abrir: mostra na hora o que
// está guardado e busca no banco só o que mudou desde a última vez
// (produtos.atualizado_em) e quem foi apagado (produtos_removidos). Sem nada
// guardado, carrega tudo uma vez. As telas (Produtos, Vendas, Condicional,
// Dashboard) dividem a mesma lista: trocar de aba não busca de novo.
//
// Depois de mudar algo (salvar, vender, dar entrada), chame `recarregar()`:
// busca só a diferença.

// Mudou as colunas? Troque a versão: o que estiver guardado é descartado.
const VERSAO = 1
const COLUNAS = 'id, nome, codigo, codigo_legado, quantidade, estoque_minimo, preco_custo, preco_venda, criado_em, atualizado_em'
// Volta um pouco no tempo ao buscar a diferença: uma alteração gravada em
// paralelo com a última busca não fica de fora (repetir é inofensivo).
const FOLGA_MS = 2 * 60 * 1000

const chaveDe = (clienteId) => `produtos:${clienteId}`

// Em memória, por loja: { produtos, marca, marcaRemovidos, ouvintes, buscando }
const lojas = new Map()

function estadoDa(clienteId) {
  let e = lojas.get(clienteId)
  if (!e) {
    e = { produtos: null, marca: null, marcaRemovidos: null, ouvintes: new Set(), buscando: null, erro: false, leuGuardado: false }
    lojas.set(clienteId, e)
  }
  return e
}

const avisar = (e) => e.ouvintes.forEach((f) => f())
const maior = (a, b) => (!a ? b : !b ? a : (a > b ? a : b))
const voltar = (iso) => new Date(new Date(iso).getTime() - FOLGA_MS).toISOString()
const ordenar = (lista) => lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

async function carregarTudo(clienteId) {
  const [p, r] = await Promise.all([
    todasAsLinhas(() => supabase.from('produtos').select(COLUNAS).eq('cliente_id', clienteId).order('nome').order('id')),
    supabase.from('produtos_removidos').select('removido_em').eq('cliente_id', clienteId)
      .order('removido_em', { ascending: false }).limit(1),
  ])
  if (p.error) throw p.error
  return {
    produtos: p.data,
    marca: p.data.reduce((m, x) => maior(m, x.atualizado_em), null),
    marcaRemovidos: r.data?.[0]?.removido_em ?? null,
  }
}

async function buscarDiferenca(clienteId, e) {
  // A consulta é montada do zero a cada página (o construtor do Supabase
  // acumula filtros se for reaproveitado).
  const mudados = () => {
    const q = supabase.from('produtos').select(COLUNAS).eq('cliente_id', clienteId)
    return (e.marca ? q.gte('atualizado_em', voltar(e.marca)) : q).order('atualizado_em').order('id')
  }
  const removidos = () => {
    const q = supabase.from('produtos_removidos').select('id, removido_em').eq('cliente_id', clienteId)
    return (e.marcaRemovidos ? q.gte('removido_em', voltar(e.marcaRemovidos)) : q).order('removido_em').order('id')
  }

  const [p, r] = await Promise.all([todasAsLinhas(mudados), todasAsLinhas(removidos)])
  if (p.error) throw p.error
  if (r.error) throw r.error

  const porId = new Map(e.produtos.map((x) => [x.id, x]))
  for (const x of p.data) porId.set(x.id, x)
  for (const x of r.data) porId.delete(x.id)
  return {
    produtos: ordenar([...porId.values()]),
    marca: p.data.reduce((m, x) => maior(m, x.atualizado_em), e.marca),
    marcaRemovidos: r.data.reduce((m, x) => maior(m, x.removido_em), e.marcaRemovidos),
  }
}

// Uma busca por vez por loja; quem pedir junto espera a mesma.
function sincronizar(clienteId) {
  const e = estadoDa(clienteId)
  if (e.buscando) return e.buscando
  e.buscando = (async () => {
    if (!e.leuGuardado) {
      e.leuGuardado = true
      const g = await lerGuardado(chaveDe(clienteId))
      if (g?.versao === VERSAO && Array.isArray(g.produtos) && !e.produtos) {
        Object.assign(e, { produtos: g.produtos, marca: g.marca, marcaRemovidos: g.marcaRemovidos })
        avisar(e) // já aparece na tela; a diferença vem logo depois
      }
    }
    try {
      const novo = e.produtos ? await buscarDiferenca(clienteId, e) : await carregarTudo(clienteId)
      Object.assign(e, novo, { erro: false })
      guardar(chaveDe(clienteId), { versao: VERSAO, ...novo })
    } catch {
      e.erro = true // fica com o que tinha (guardado ou da última busca)
    }
    avisar(e)
  })().finally(() => { e.buscando = null })
  return e.buscando
}

export function useProdutos(clienteId) {
  const [, setTique] = useState(0)

  useEffect(() => {
    if (!supabaseConfigurado || !clienteId) return
    const e = estadoDa(clienteId)
    const ouvir = () => setTique((t) => t + 1)
    e.ouvintes.add(ouvir)
    sincronizar(clienteId)
    return () => { e.ouvintes.delete(ouvir) }
  }, [clienteId])

  const recarregar = useCallback(() => (clienteId ? sincronizar(clienteId) : Promise.resolve()), [clienteId])

  const e = clienteId ? lojas.get(clienteId) : null
  return {
    produtos: e?.produtos ?? null, // null = ainda carregando pela primeira vez
    carregando: !e?.produtos,
    erro: Boolean(e?.erro) && !e?.produtos,
    recarregar,
  }
}

// Ao sair da conta: esquece o que está em memória (o guardado é apagado
// junto, em AuthContext).
export function esquecerProdutos() {
  lojas.clear()
}
