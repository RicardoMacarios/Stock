import { useState } from 'react'
import toast from 'react-hot-toast'
import { Check, Pencil, Plus, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { traduzirErro } from '@/lib/erros'
import { corDoVendedor, useVendedores } from '@/pages/vendas/dados'

// Vendedores da loja (só nome; não precisam de login). Com pelo menos um
// ativo, escolher o vendedor vira obrigatório na venda. Desativar tira da
// lista da venda sem apagar o histórico; a cor no gráfico não muda.
export default function VendedoresSecao({ clienteId }) {
  const { vendedores, recarregar } = useVendedores(clienteId)
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const ativos = vendedores.filter((v) => v.ativo).length

  async function adicionar(e) {
    e.preventDefault()
    if (!nome.trim()) return
    setSalvando(true)
    const { error } = await supabase.from('vendedores').insert({ cliente_id: clienteId, nome: nome.trim() })
    setSalvando(false)
    if (error) return toast.error(traduzirErro(error))
    toast.success(`${nome.trim()} entrou na equipe.`)
    setNome('')
    recarregar()
  }

  return (
    <section className="rounded-2xl border border-borda bg-card p-5">
      <div className="flex items-center gap-2">
        <Users size={18} className="text-acento" />
        <h2 className="font-semibold">Vendedores</h2>
        <span className="ml-auto rounded-full bg-elevado px-2 py-0.5 text-xs text-texto-2">{ativos} ativo{ativos === 1 ? '' : 's'}</span>
      </div>
      <p className="mt-1 text-sm text-texto-3">Aparecem para escolher na hora da venda. Cada um tem uma cor no gráfico.</p>

      <form onSubmit={adicionar} className="mt-4 flex gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} placeholder="Nome do vendedor"
          aria-label="Nome do vendedor"
          className="h-11 w-full min-w-0 rounded-xl border border-borda-forte bg-fundo px-3 text-base outline-none transition placeholder:text-texto-3 focus:border-acento focus:ring-2 focus:ring-acento/25 lg:text-sm" />
        <button disabled={salvando || !nome.trim()}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-acento px-4 text-sm font-semibold text-sobre-acento transition hover:brightness-110 disabled:opacity-40">
          <Plus size={16} /> Adicionar
        </button>
      </form>

      {vendedores.length > 0 && (
        <ul className="mt-4 space-y-2">
          {vendedores.map((v) => (
            <LinhaVendedor key={v.id} vendedor={v} cor={corDoVendedor(vendedores, v.id)} mudou={recarregar} />
          ))}
        </ul>
      )}
    </section>
  )
}

function LinhaVendedor({ vendedor: v, cor, mudou }) {
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(v.nome)

  async function salvarNome(e) {
    e.preventDefault()
    if (!nome.trim() || nome.trim() === v.nome) return setEditando(false)
    const { error } = await supabase.from('vendedores').update({ nome: nome.trim() }).eq('id', v.id)
    if (error) return toast.error(traduzirErro(error))
    setEditando(false)
    mudou()
  }

  async function alternar() {
    const { error } = await supabase.from('vendedores').update({ ativo: !v.ativo }).eq('id', v.id)
    if (error) return toast.error(traduzirErro(error))
    mudou()
  }

  return (
    <li className={`flex items-center gap-3 rounded-xl border border-borda p-2.5 ${v.ativo ? 'bg-fundo/40' : 'opacity-60'}`}>
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-fundo" style={{ background: cor }}>
        {v.nome.trim().charAt(0).toUpperCase()}
      </span>

      {editando ? (
        <form onSubmit={salvarNome} className="flex min-w-0 flex-1 items-center gap-1">
          <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} aria-label="Novo nome"
            onKeyDown={(e) => e.key === 'Escape' && (setNome(v.nome), setEditando(false))}
            className="h-9 min-w-0 flex-1 rounded-lg border border-acento bg-fundo px-2 text-sm outline-none" />
          <button aria-label="Salvar nome" className="rounded-lg p-2 text-ok hover:bg-elevado"><Check size={16} /></button>
          <button type="button" aria-label="Cancelar" onClick={() => { setNome(v.nome); setEditando(false) }}
            className="rounded-lg p-2 text-texto-3 hover:bg-elevado"><X size={16} /></button>
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{v.nome}</p>
            <p className="text-xs text-texto-3">{v.ativo ? 'Aparece na venda' : 'Desativado'}</p>
          </div>
          <button type="button" onClick={() => setEditando(true)} aria-label={`Renomear ${v.nome}`} title="Renomear"
            className="rounded-lg p-2 text-texto-3 hover:bg-elevado hover:text-texto">
            <Pencil size={14} />
          </button>
          {/* Interruptor ativo/desativado */}
          <button type="button" role="switch" aria-checked={v.ativo} onClick={alternar}
            aria-label={v.ativo ? `Desativar ${v.nome}` : `Ativar ${v.nome}`} title={v.ativo ? 'Desativar' : 'Ativar'}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${v.ativo ? 'bg-acento' : 'bg-borda-forte'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${v.ativo ? 'left-[1.375rem]' : 'left-0.5'}`} />
          </button>
        </>
      )}
    </li>
  )
}
