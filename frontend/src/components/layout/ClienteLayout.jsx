import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Package, FileText, Settings, Circle, LogOut } from 'lucide-react'
import { useCliente } from '@/context/useCliente'
import { useAuth } from '@/context/useAuth'
import { useTemaDoCliente } from '@/hooks/useTemaDoCliente'
import { itensDeMenu } from '@/config/modulos'

// Ícones por nome, para config de cliente poder escolher sem importar nada.
// Ícone novo: importe acima e registre aqui.
const ICONES = { LayoutDashboard, Package, FileText, Settings }

export default function ClienteLayout() {
  const { slug, config, ehDono } = useCliente()
  const { session, sair } = useAuth()
  useTemaDoCliente(slug, config.tema, config.nome)

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="border-b md:border-b-0 md:border-r border-borda bg-card p-4 flex md:flex-col gap-4">
        <div className="flex items-center gap-3">
          {config.tema.logo
            ? <img src={config.tema.logo} alt="" className="h-8 w-8 rounded object-contain" />
            : <span className="h-8 w-8 rounded bg-acento" aria-hidden />}
          <strong className="text-sm">{config.nome}</strong>
        </div>

        <nav className="flex md:flex-col gap-1 flex-1 overflow-x-auto">
          {itensDeMenu(config, { ehDono }).map((item) => {
            const Icone = ICONES[item.icone] ?? Circle
            return (
              <NavLink
                key={item.caminho}
                to={`/${slug}${item.caminho ? `/${item.caminho}` : ''}`}
                end
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-(--radius-controle) px-3 py-2 text-sm whitespace-nowrap ${
                    isActive ? 'bg-elevado text-texto border-l-2 border-acento' : 'text-texto-2 hover:bg-elevado'
                  }`}
              >
                <Icone size={16} /> {item.rotulo}
              </NavLink>
            )
          })}
        </nav>

        {session && (
          <button onClick={sair} className="flex items-center gap-2 text-sm text-texto-3 hover:text-texto">
            <LogOut size={16} /> Sair
          </button>
        )}
      </aside>

      <main className="p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
