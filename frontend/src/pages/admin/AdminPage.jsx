import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Copy, LogOut } from 'lucide-react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { useAuth } from '@/context/useAuth'
import { traduzirErro } from '@/lib/erros'
import { generateSlug } from '@/utils/slug'
import { classeCampo } from '@/lib/classes'

// /admin — você: gera códigos de convite e vê os clientes.
// Quem pode é decidido no banco (plataforma_admins + eh_admin()). Não tem
// login próprio: entra-se por /login, que manda o admin para cá.
export default function AdminPage() {
  const { session, loading, sair } = useAuth()
  const [ehAdmin, setEhAdmin] = useState(null)

  useEffect(() => {
    if (!session) return
    let cancelado = false
    supabase.rpc('eh_admin').then(({ data }) => { if (!cancelado) setEhAdmin(data === true) })
    return () => { cancelado = true }
  }, [session])

  if (!supabaseConfigurado) return <p className="p-8 text-texto-2">Banco não configurado (frontend/.env).</p>
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (ehAdmin === null) return null
  // Conta comum: o /login sabe levar para a empresa dela.
  if (!ehAdmin) return <Navigate to="/login" replace />
  return <Painel sair={sair} />
}

function Painel({ sair }) {
  const [convites, setConvites] = useState([])
  const [clientes, setClientes] = useState([])
  const [slug, setSlug] = useState('')
  const [dias, setDias] = useState(7)
  const [gerando, setGerando] = useState(false)

  const carregar = useCallback(async () => {
    const [cv, cl] = await Promise.all([
      supabase.from('convites').select('*').order('criado_em', { ascending: false }).limit(50),
      supabase.from('clientes').select('id, slug, nome, ativo, criado_em').order('criado_em', { ascending: false }),
    ])
    if (cv.error || cl.error) toast.error('Não foi possível carregar.')
    setConvites(cv.data ?? [])
    setClientes(cl.data ?? [])
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial vinda do banco
    carregar()
  }, [carregar])

  async function gerar(e) {
    e.preventDefault()
    setGerando(true)
    const { data, error } = await supabase.rpc('gerar_convite', {
      p_slug: slug ? generateSlug(slug) : null,
      p_dias: Number(dias),
    })
    setGerando(false)
    if (error) return toast.error(traduzirErro(error))
    await copiarLink(data.codigo)
    setSlug('')
    carregar()
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <button onClick={sair} className="flex items-center gap-2 text-sm text-texto-3 hover:text-texto">
          <LogOut size={16} /> Sair
        </button>
      </header>

      <section className="rounded-lg border border-borda bg-card p-4">
        <h2 className="font-semibold">Novo convite</h2>
        <form onSubmit={gerar} className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem_auto] items-end">
          <label className="text-xs text-texto-3">
            Endereço fixo (opcional)
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="vazio = sai do nome da empresa"
              className={`${classeCampo} mt-1 text-sm`} />
          </label>
          <label className="text-xs text-texto-3">
            Validade (dias)
            <input type="number" min={1} max={90} value={dias} onChange={(e) => setDias(e.target.value)}
              className={`${classeCampo} mt-1 text-sm`} />
          </label>
          <button disabled={gerando} className="rounded px-4 py-2 font-semibold bg-acento text-sobre-acento disabled:opacity-60">
            {gerando ? 'Gerando…' : 'Gerar código'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Convites</h2>
        <ul className="divide-y divide-borda rounded-lg border border-borda bg-card text-sm">
          {convites.length === 0 && <li className="p-3 text-texto-3">Nenhum convite ainda.</li>}
          {convites.map((c) => (
            <li key={c.codigo} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span className="font-mono">{c.codigo}</span>
              <span className="text-texto-3">{c.slug ? `/${c.slug}` : 'endereço pelo nome'}</span>
              <StatusConvite convite={c} clientes={clientes} />
              {!c.usado_em && new Date(c.expira_em) > new Date() && (
                <button onClick={() => copiarLink(c.codigo)} className="flex items-center gap-1 text-texto-2 hover:text-texto">
                  <Copy size={14} /> Copiar link
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Clientes</h2>
        <ul className="divide-y divide-borda rounded-lg border border-borda bg-card text-sm">
          {clientes.length === 0 && <li className="p-3 text-texto-3">Nenhum cliente ainda.</li>}
          {clientes.map((c) => (
            <li key={c.id} className="flex flex-wrap justify-between gap-2 p-3">
              <span>{c.nome}</span>
              <a href={`/${c.slug}`} className="font-mono text-texto-2 underline">/{c.slug}</a>
              <span className={c.ativo ? 'text-ok' : 'text-danger'}>{c.ativo ? 'ativo' : 'suspenso'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function StatusConvite({ convite, clientes }) {
  if (convite.usado_em) {
    const cliente = clientes.find((c) => c.id === convite.cliente_id)
    return <span className="text-ok">usado{cliente ? ` → /${cliente.slug}` : ''}</span>
  }
  if (new Date(convite.expira_em) <= new Date()) return <span className="text-danger">expirado</span>
  return <span className="text-warn">vale até {new Date(convite.expira_em).toLocaleDateString('pt-BR')}</span>
}

async function copiarLink(codigo) {
  const link = `${location.origin}/cadastro?codigo=${codigo}`
  try {
    await navigator.clipboard.writeText(link)
    toast.success(`Link copiado: ${codigo}`)
  } catch {
    toast(`Código: ${codigo}`)
  }
}
