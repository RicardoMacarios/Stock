import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { ClienteProvider } from '@/context/ClienteContext'
import { useCliente } from '@/context/useCliente'
import { useAuth } from '@/context/useAuth'
import { supabase } from '@/lib/supabase'
import { Pagina, Componente } from '@/clientes/Personalizavel'
import { itensDeMenu } from '@/config/modulos'

// Telas fora de cliente (sem slug na URL).
const LoginGeralPage = lazy(() => import('@/pages/login/LoginGeralPage'))
const RedefinirSenhaPage = lazy(() => import('@/pages/login/RedefinirSenhaPage'))
const CadastroPage = lazy(() => import('@/pages/cadastro/CadastroPage'))
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'))

// Rotas fixas ficam ANTES de /:slug. Rota fixa nova entra também em
// SLUGS_RESERVADOS (src/utils/slug.js) e em public.slug_reservado (banco).
export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginGeralPage />} />
        <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/:slug/*" element={<RaizDoCliente />} />
      </Routes>
    </Suspense>
  )
}

function RaizDoCliente() {
  const { slug } = useParams()
  return (
    // key: trocar de cliente remonta tudo, nada de estado de um vaza para o outro.
    <ClienteProvider key={slug} slug={slug}>
      <RotasDoCliente />
    </ClienteProvider>
  )
}

function RotasDoCliente() {
  const { estado, config, ehDono } = useCliente()

  if (estado === 'carregando') return null
  if (estado === 'inativo') return <Aviso texto="Este acesso está temporariamente suspenso." />
  if (estado !== 'ok') return <Aviso texto="Não encontramos este endereço." />

  const itens = itensDeMenu(config, { ehDono })
  const temIndex = itens.some((item) => !item.caminho)

  // Tudo passa por <Pagina>/<Componente>: qualquer tela (inclusive o login) ou
  // o layout inteiro pode ser trocado só para este cliente.
  return (
    <Routes>
      <Route path="login" element={<Pagina nome="LoginPage" />} />
      <Route element={<RequerAcesso><Componente nome="ClienteLayout" /></RequerAcesso>}>
        {itens.map((item) =>
          item.caminho
            ? <Route key={item.caminho} path={item.caminho} element={<Pagina nome={item.pagina} />} />
            : <Route key="index" index element={<Pagina nome={item.pagina} />} />,
        )}
        {/* Dashboard desligada para o cliente: abre o primeiro item do menu. */}
        {!temIndex && itens[0] && <Route index element={<Navigate to={itens[0].caminho} replace />} />}
        <Route path="*" element={<Aviso texto="Página não encontrada." />} />
      </Route>
    </Routes>
  )
}

// Logado E membro deste cliente (ou admin). O RLS já esconderia os dados de
// outro cliente; isto é para a tela dizer "sem acesso" em vez de abrir vazia.
function RequerAcesso({ children }) {
  const { slug, cliente } = useCliente()
  const { session, loading, exigeLogin, sair } = useAuth()
  const [acesso, setAcesso] = useState({ chave: null, pode: false })
  const chave = session && cliente?.id ? `${session.user.id}:${cliente.id}` : null

  useEffect(() => {
    if (!chave) return
    let cancelado = false
    supabase.rpc('pode_acessar', { p_cliente_id: cliente.id }).then(({ data }) => {
      if (!cancelado) setAcesso({ chave, pode: data === true })
    })
    return () => { cancelado = true }
  }, [chave, cliente?.id])

  if (!exigeLogin) return children
  if (loading) return null
  if (!session) return <Navigate to={`/${slug}/login`} replace />
  if (acesso.chave !== chave) return null
  if (!acesso.pode) {
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center">
        <div>
          <p className="text-texto-2">Sua conta ({session.user.email}) não tem acesso a este endereço.</p>
          <button onClick={sair} className="mt-3 text-sm underline">Entrar com outra conta</button>
        </div>
      </div>
    )
  }
  return children
}

function Aviso({ texto, children }) {
  return (
    <div className="min-h-[60dvh] grid place-items-center p-6 text-center">
      <div>
        <p className="text-texto-2">{texto}</p>
        {children}
      </div>
    </div>
  )
}
