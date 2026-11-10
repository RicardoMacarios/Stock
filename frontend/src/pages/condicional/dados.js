import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'

// Leitura de condicionais e clientes da loja. .js de propósito: o registro de
// clientes só indexa .jsx como página.

// Condicionais de uma situação ('aberto' | 'fechado'), com o cliente e as peças.
export function useCondicionais(clienteId, situacao) {
  const [estado, setEstado] = useState({ chave: null, lista: [] })
  const [versao, setVersao] = useState(0)
  const base = `${clienteId}:${situacao}`
  const chave = `${base}:${versao}`

  useEffect(() => {
    if (!supabaseConfigurado || !clienteId) return
    let cancelado = false
    let consulta = supabase.from('condicionais')
      .select('*, cliente:clientes_loja(id, nome, telefone, endereco, observacoes), itens:condicional_itens(*)')
      .eq('cliente_id', clienteId).eq('situacao', situacao)
    consulta = situacao === 'aberto'
      ? consulta.order('saiu_em', { ascending: true })
      : consulta.order('fechado_em', { ascending: false }).limit(50)
    consulta.then(({ data }) => { if (!cancelado) setEstado({ chave, lista: data ?? [] }) })
    return () => { cancelado = true }
  }, [clienteId, situacao, chave])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  const carregou = estado.chave?.startsWith(`${base}:`)
  return { lista: carregou ? estado.lista : [], carregando: !carregou, recarregar }
}

// ── Datas (sempre o dia do calendário local, "2026-11-10") ─────────────────

export function diaLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function somarDias(dia, n) {
  const [a, m, d] = dia.split('-').map(Number)
  return diaLocal(new Date(a, m - 1, d + n))
}

// Dias inteiros de `de` até `ate` (ate - de).
export function diasEntre(de, ate) {
  const [a1, m1, d1] = de.split('-').map(Number)
  const [a2, m2, d2] = ate.split('-').map(Number)
  return Math.round((new Date(a2, m2 - 1, d2) - new Date(a1, m1 - 1, d1)) / 86_400_000)
}

export const dataCurta = (dia) => {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// Situação do prazo: atrasado (vermelho), vence hoje (amarelo), no prazo.
export function prazo(cond, hoje = diaLocal()) {
  if (!cond.devolver_ate) return null
  const faltam = diasEntre(hoje, cond.devolver_ate)
  if (faltam < 0) return { tipo: 'atrasado', texto: `atrasado ${-faltam} dia${faltam === -1 ? '' : 's'}` }
  if (faltam === 0) return { tipo: 'hoje', texto: 'devolver hoje' }
  return { tipo: 'ok', texto: `devolver até ${dataCurta(cond.devolver_ate)}` }
}

export function totaisDoCondicional(cond) {
  let pecas = 0
  let valor = 0
  for (const i of cond.itens ?? []) {
    pecas += Number(i.quantidade)
    valor += Number(i.quantidade) * Number(i.preco_unitario)
  }
  return { pecas, valor }
}
