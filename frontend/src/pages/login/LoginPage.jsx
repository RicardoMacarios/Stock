import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import { useCliente } from '@/context/useCliente'
import { useTemaDoCliente } from '@/hooks/useTemaDoCliente'
import FormLogin from '@/components/auth/FormLogin'

// Login dentro do slug (/:slug/login): já abre com a cara do cliente.
// A entrada geral (/login, sem cliente) é a LoginGeralPage, nesta pasta.
export default function LoginPage() {
  const { slug, config } = useCliente()
  const { session, exigeLogin } = useAuth()
  useTemaDoCliente(slug, config.tema, config.nome)

  if (session || !exigeLogin) return <Navigate to={`/${slug}`} replace />
  return <FormLogin nome={config.nome} logo={config.tema.logo} />
}
