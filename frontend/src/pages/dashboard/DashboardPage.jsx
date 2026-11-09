import { useCliente } from '@/context/useCliente'
import PageHeader from '@/components/ui/PageHeader'

// Tela inicial do cliente (/:slug).
// `children` deixa um cliente ACRESCENTAR algo sem copiar a tela:
//   src/clientes/<slug>/paginas/DashboardPage.jsx → <Base>…</Base>
export default function DashboardPage({ children }) {
  const { config } = useCliente()

  return (
    <>
      <PageHeader titulo="Dashboard" subtitulo={config.nome} />
      {children}
    </>
  )
}
