import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ChevronRight, Loader2, LogOut, MessageCircle, ShieldCheck } from 'lucide-react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { linkWhatsApp } from '@/config/contato'
import { useAuth } from '@/context/useAuth'
import FormLogin from '@/components/auth/FormLogin'
import TelaDeEntrada from '@/components/auth/TelaDeEntrada'
import Marca from '@/components/ui/Marca'

// /login — entrada única do sistema. Não existe "login de admin": depois de
// entrar, o banco diz quem a pessoa é e para onde ela vai.
//   admin sem empresa      → /admin
//   uma empresa            → /<slug>
//   várias (ou admin + empresa) → escolhe numa lista
export default function LoginGeralPage() {
  const { session, loading, sair } = useAuth()
  const uid = session?.user.id ?? null
  const [destino, setDestino] = useState({ uid: null })

  useEffect(() => {
    if (!uid) return
    let cancelado = false
    Promise.all([
      supabase.rpc('eh_admin'),
      supabase.from('cliente_membros').select('papel, clientes(slug, nome, ativo)').eq('user_id', uid),
    ]).then(([adm, mem]) => {
      if (cancelado) return
      if (adm.error || mem.error) return setDestino({ uid, erro: true })
      const empresas = (mem.data ?? [])
        .filter((m) => m.clientes)
        .map((m) => ({ ...m.clientes, papel: m.papel }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      setDestino({ uid, admin: adm.data === true, empresas })
    })
    return () => { cancelado = true }
  }, [uid])

  // Sem banco no .env: o /demo abre sem login (modo de desenvolvimento).
  if (!supabaseConfigurado) return <Navigate to="/demo" replace />
  if (loading) return <Carregando />
  if (!session) return <FormLogin rodape={<Cadastro />} />
  if (destino.uid !== uid) return <Carregando />

  if (destino.erro) {
    return (
      <Aviso titulo="Não foi possível entrar" sair={sair}>
        Não conseguimos carregar os dados da sua conta. Tente de novo em instantes.
      </Aviso>
    )
  }

  const { admin, empresas } = destino
  if (admin && empresas.length === 0) return <Navigate to="/admin" replace />
  if (!admin && empresas.length === 1) return <Navigate to={`/${empresas[0].slug}`} replace />
  if (!admin && empresas.length === 0) {
    return (
      <Aviso titulo="Nenhuma empresa ainda" sair={sair}>
        A conta <strong className="text-texto">{session.user.email}</strong> ainda não está ligada a nenhuma
        empresa. Se você recebeu um código de convite, use o link do convite para criar a sua.
      </Aviso>
    )
  }

  return (
    <TelaDeEntrada>
      <div className="surgir">
        <h1 className="text-2xl font-bold tracking-tight">Onde você quer entrar?</h1>
        <p className="mt-1 text-sm text-texto-2">{session.user.email}</p>

        <ul className="mt-8 space-y-2">
          {admin && (
            <Opcao para="/admin" icone={<ShieldCheck size={20} className="text-acento" />}
              titulo="Painel do administrador" detalhe="Convites e clientes" />
          )}
          {empresas.map((e) => (
            <Opcao key={e.slug} para={`/${e.slug}`} icone={<Marca tamanho={32} />}
              titulo={e.nome} detalhe={e.ativo ? `/${e.slug}` : 'suspensa'} />
          ))}
        </ul>

        <BotaoSair sair={sair} />
      </div>
    </TelaDeEntrada>
  )
}

// Cliente novo não se cadastra sozinho: fala com a gente pelo WhatsApp e
// recebe o código de convite.
function Cadastro() {
  return (
    <div className="surgir mt-8" style={{ animationDelay: '120ms' }}>
      <div className="flex items-center gap-3 text-xs text-texto-3">
        <span className="h-px flex-1 bg-borda" />
        Ainda não tem conta?
        <span className="h-px flex-1 bg-borda" />
      </div>
      <a href={linkWhatsApp()} target="_blank" rel="noopener noreferrer"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-borda-forte py-3.5 font-semibold transition hover:border-acento hover:text-acento lg:rounded-(--radius-controle) lg:py-2.5">
        <MessageCircle size={18} className="text-acento" />
        Quero me cadastrar
      </a>
    </div>
  )
}

function Opcao({ para, icone, titulo, detalhe }) {
  return (
    <li>
      <Link to={para}
        className="group flex items-center gap-3 rounded-xl border border-borda bg-fundo p-3 transition hover:border-acento/60 hover:bg-elevado lg:rounded-lg lg:bg-card">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-card lg:bg-fundo">{icone}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{titulo}</span>
          <span className="block truncate text-xs text-texto-3">{detalhe}</span>
        </span>
        <ChevronRight size={18} className="text-texto-3 transition group-hover:translate-x-0.5 group-hover:text-texto" />
      </Link>
    </li>
  )
}

function Aviso({ titulo, sair, children }) {
  return (
    <TelaDeEntrada>
      <div className="surgir">
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        <p className="mt-3 text-sm leading-relaxed text-texto-2">{children}</p>
        <BotaoSair sair={sair} />
      </div>
    </TelaDeEntrada>
  )
}

function BotaoSair({ sair }) {
  return (
    <button onClick={sair} className="mt-8 flex items-center gap-2 text-sm text-texto-3 transition hover:text-texto">
      <LogOut size={16} /> Entrar com outra conta
    </button>
  )
}

function Carregando() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 size={24} className="animate-spin text-texto-3" aria-label="Carregando" />
    </div>
  )
}
