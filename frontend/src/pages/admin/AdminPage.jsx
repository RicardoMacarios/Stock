import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CircleCheck, CirclePause, ExternalLink, LogOut, Search, Store, Ticket } from 'lucide-react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { useAuth } from '@/context/useAuth'
import { classeCampo } from '@/lib/classes'
import { textoSobre } from '@/utils/cor'
import { Logotipo } from '@/components/ui/Marca'
import PainelConvites from './PainelConvites'
import PainelUso from './PainelUso'
import { useConvites } from './useConvites'

// /admin — você: gera convites e acompanha os clientes.
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
  return <Painel email={session.user.email} sair={sair} />
}

function Painel({ email, sair }) {
  const [clientes, setClientes] = useState(null)

  const carregarClientes = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_listar_clientes')
    if (error) toast.error('Não foi possível carregar os clientes.')
    setClientes(data ?? [])
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial vinda do banco
    carregarClientes()
  }, [carregarClientes])

  const convites = useConvites()

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-borda bg-fundo/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Logotipo tamanho={30} />
            <span className="rounded-full border border-acento/30 bg-acento/10 px-2 py-0.5 text-xs font-semibold text-acento">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-56 truncate text-sm text-texto-3 sm:block">{email}</span>
            <button onClick={sair}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-texto-3 transition hover:bg-elevado hover:text-texto">
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Painel do administrador</h1>
          <p className="mt-1 text-sm text-texto-2">Crie convites para empresas novas e acompanhe quem já usa o Stock.</p>
        </div>

        <Numeros clientes={clientes} convitesValidos={convites.validos} />

        <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-12 lg:items-start lg:gap-6">
          <div className="lg:col-span-5">
            <PainelConvites {...convites} aoGerar={carregarClientes} />
          </div>
          <div className="lg:col-span-7">
            <PainelClientes clientes={clientes} />
          </div>
        </div>

        <div className="mt-4 lg:mt-6">
          <PainelUso />
        </div>
      </main>
    </div>
  )
}

function Numeros({ clientes, convitesValidos }) {
  const total = clientes?.length ?? null
  const ativos = clientes?.filter((c) => c.ativo).length ?? null
  const itens = [
    { rotulo: 'Clientes', valor: total, icone: Store, cor: 'text-acento bg-acento/10' },
    { rotulo: 'Ativos', valor: ativos, icone: CircleCheck, cor: 'text-ok bg-ok/10' },
    { rotulo: 'Suspensos', valor: total === null ? null : total - ativos, icone: CirclePause, cor: 'text-danger bg-danger/10' },
    { rotulo: 'Convites válidos', valor: convitesValidos, icone: Ticket, cor: 'text-warn bg-warn/10' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
      {itens.map(({ rotulo, valor, icone: Icone, cor }) => (
        <div key={rotulo} className="flex items-center gap-4 rounded-xl border border-borda bg-card p-4 md:p-5">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${cor}`}>
            <Icone size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs text-texto-3 sm:text-sm">{rotulo}</p>
            <p className="text-2xl font-bold tabular-nums md:text-3xl">{valor ?? '–'}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function PainelClientes({ clientes }) {
  const [busca, setBusca] = useState('')
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q || !clientes) return clientes ?? []
    return clientes.filter((c) => [c.nome, c.slug, c.dono_email].some((v) => (v ?? '').toLowerCase().includes(q)))
  }, [clientes, busca])

  return (
    <section className="rounded-xl border border-borda bg-card p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Store size={18} className="text-acento" /> Clientes
          {clientes?.length > 0 && <span className="text-sm font-normal text-texto-3">({clientes.length})</span>}
        </h2>
        {clientes && clientes.length > 0 && (
          <div className="relative w-full sm:w-72">
            <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-3" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, endereço ou e-mail"
              aria-label="Buscar clientes" className={`${classeCampo} rounded-lg py-1.5 pl-9 text-sm`} />
          </div>
        )}
      </div>

      <div className="mt-4">
        {clientes === null ? (
          <p className="py-3 text-sm text-texto-3">Carregando…</p>
        ) : clientes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-borda-forte px-6 py-16 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-acento/10 text-acento">
              <Store size={26} aria-hidden />
            </span>
            <p className="mt-4 font-semibold">Nenhum cliente ainda</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-texto-3">
              Gere um convite ao lado e mande o link. Quando a empresa se cadastrar, ela aparece aqui.
            </p>
          </div>
        ) : filtrados.length === 0 ? (
          <p className="py-6 text-center text-sm text-texto-3">Nada encontrado para “{busca}”.</p>
        ) : (
          <>
            {/* Computador: tabela */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-borda text-left text-xs uppercase tracking-wider text-texto-3">
                  <th className="pb-2 font-semibold">Empresa</th>
                  <th className="pb-2 font-semibold">Dono</th>
                  <th className="pb-2 font-semibold">Desde</th>
                  <th className="pb-2 text-right font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {filtrados.map((c) => (
                  <tr key={c.id} className="transition hover:bg-elevado/40">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <Avatar cliente={c} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{c.nome}</p>
                          <EnderecoDoCliente slug={c.slug} />
                        </div>
                      </div>
                    </td>
                    <td className="max-w-48 truncate py-3 pr-3 text-texto-2">{c.dono_email ?? '—'}</td>
                    <td className="whitespace-nowrap py-3 pr-3 text-texto-3 tabular-nums">
                      {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 text-right"><Situacao ativo={c.ativo} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Celular: lista */}
            <ul className="divide-y divide-borda md:hidden">
              {filtrados.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <Avatar cliente={c} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.nome}</p>
                    <p className="truncate text-xs text-texto-3">{c.dono_email ?? 'sem dono'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Situacao ativo={c.ativo} />
                    <EnderecoDoCliente slug={c.slug} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}

function Avatar({ cliente: c }) {
  if (c.logo_url) return <img src={c.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
  return (
    <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-acento font-bold text-sobre-acento"
      style={c.cor_primaria ? { background: c.cor_primaria, color: textoSobre(c.cor_primaria) } : undefined}>
      {(c.nome || '?').trim().charAt(0).toUpperCase()}
    </span>
  )
}

function EnderecoDoCliente({ slug }) {
  return (
    <a href={`/${slug}`} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-xs text-texto-3 hover:text-texto">
      /{slug} <ExternalLink size={11} />
    </a>
  )
}

function Situacao({ ativo }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${ativo ? 'bg-ok/15 text-ok' : 'bg-danger/15 text-danger'}`}>
      {ativo ? <CircleCheck size={12} aria-hidden /> : <CirclePause size={12} aria-hidden />}
      {ativo ? 'Ativo' : 'Suspenso'}
    </span>
  )
}
