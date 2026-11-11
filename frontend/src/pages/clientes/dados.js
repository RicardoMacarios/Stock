import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'

// Clientes da loja com o resumo da ficha (gasto, peças, compras, última
// compra, condicionais em aberto). Usado em Clientes, Condicional e Vendas.
// .js de propósito: o registro de clientes só indexa .jsx como página.
export function useClientesDaLoja(clienteId) {
  const [estado, setEstado] = useState({ chave: null, lista: [] })
  const [versao, setVersao] = useState(0)
  const chave = `${clienteId}:${versao}`

  useEffect(() => {
    if (!supabaseConfigurado || !clienteId) return
    let cancelado = false
    supabase.rpc('clientes_loja_com_resumo', { p_cliente_id: clienteId })
      .then(({ data }) => { if (!cancelado) setEstado({ chave, lista: data ?? [] }) })
    return () => { cancelado = true }
  }, [clienteId, chave])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  const carregou = estado.chave?.startsWith(`${clienteId}:`)
  return { lista: carregou ? estado.lista : [], carregando: !carregou, recarregar }
}

export const iniciais = (nome = '?') => nome.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase()

// Link do WhatsApp para o telefone do cliente (Brasil: põe 55 se faltar).
export function linkWhatsApp(telefone, texto = '') {
  const digitos = String(telefone ?? '').replace(/\D/g, '')
  if (digitos.length < 10) return null
  const numero = digitos.length <= 11 ? `55${digitos}` : digitos
  return `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

// Busca por nome ou por dígitos do telefone.
export function filtrarClientes(lista, busca) {
  const q = busca.trim().toLowerCase()
  if (!q) return lista
  const digitos = q.replace(/\D/g, '')
  return lista.filter((c) => c.nome.toLowerCase().includes(q) ||
    (digitos.length >= 3 && c.telefone?.replace(/\D/g, '').includes(digitos)))
}

// Salva (cria ou atualiza) e devolve o cliente com o resumo zerado se novo.
export async function salvarCliente(clienteId, campos, id) {
  const valores = {
    nome: campos.nome.trim(),
    telefone: campos.telefone?.trim() || null,
    rua: campos.rua?.trim() || null,
    numero: campos.numero?.trim() || null,
    bairro: campos.bairro?.trim() || null,
    observacoes: campos.observacoes?.trim() || null,
  }
  const consulta = id
    ? supabase.from('clientes_loja').update(valores).eq('id', id)
    : supabase.from('clientes_loja').insert({ ...valores, cliente_id: clienteId })
  const { data, error } = await consulta.select('id, nome, telefone, rua, numero, bairro, endereco, observacoes, criado_em').single()
  if (error) return { error }
  return { data: { gasto: 0, pecas: 0, compras: 0, ultima_compra: null, condicionais_abertos: 0, em_aberto: 0, ...data } }
}

export const CLIENTE_VAZIO = { nome: '', telefone: '', rua: '', numero: '', bairro: '', observacoes: '' }
