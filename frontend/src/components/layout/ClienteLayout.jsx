import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Package, FileText, Settings, ShoppingBag, ShoppingCart, Users, Wallet, Circle, LogOut } from 'lucide-react'
import { useCliente } from '@/context/useCliente'
import { useAuth } from '@/context/useAuth'
import { useTemaDoCliente } from '@/hooks/useTemaDoCliente'
import { itensDeMenu } from '@/config/modulos'
import Marca from '@/components/ui/Marca'

// Ícones por nome, para config de cliente poder escolher sem importar nada.
// Ícone novo: importe acima e registre aqui.
const ICONES = { LayoutDashboard, Package, FileText, Settings, ShoppingBag, ShoppingCart, Users, Wallet }

// Moldura das telas do cliente.
//   Computador: menu lateral fixo (marca, navegação, usuário).
//   Celular: barra de cima com a marca e barra de abas embaixo, no alcance do polegar.
export default function ClienteLayout() {
  const { slug, config, ehDono } = useCliente()
  const { session, sair } = useAuth()
  useTemaDoCliente(slug, config.tema, config.nome)

  const itens = itensDeMenu(config, { ehDono }).map((item) => ({
    ...item,
    Icone: ICONES[item.icone] ?? Circle,
    para: `/${slug}${item.caminho ? `/${item.caminho}` : ''}`,
  }))
  const email = session?.user.email

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* ── Computador: menu lateral ── */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-borda bg-card/60 lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <Marca logo={config.tema.logo} tamanho={38} />
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{config.nome}</p>
            <p className="text-xs text-texto-3">Controle de estoque</p>
          </div>
        </div>

        <p className="px-5 pb-2 pt-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-texto-3">Menu</p>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {itens.map(({ Icone, ...item }) => (
            <NavLink key={item.para} to={item.para} end
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive ? 'bg-acento/10 font-semibold text-texto' : 'text-texto-2 hover:bg-elevado hover:text-texto'
                }`}>
              {({ isActive }) => (
                <>
                  {isActive && <span aria-hidden className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-acento" />}
                  <Icone size={18} className={isActive ? 'text-acento' : 'text-texto-3 group-hover:text-texto-2'} />
                  {item.rotulo}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {session && (
          <div className="m-3 flex items-center gap-3 rounded-xl border border-borda bg-fundo/60 p-3">
            <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-acento/15 text-sm font-bold uppercase text-acento">
              {email?.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{email}</p>
              <p className="text-xs text-texto-3">{ehDono ? 'Dono' : 'Equipe'}</p>
            </div>
            <button onClick={sair} aria-label="Sair" title="Sair"
              className="rounded-lg p-2 text-texto-3 transition hover:bg-elevado hover:text-texto">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>

      {/* ── Celular: barra de cima ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-borda bg-fundo/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <Marca logo={config.tema.logo} tamanho={30} />
          <span className="truncate font-semibold">{config.nome}</span>
        </div>
        {session && (
          <button onClick={sair} aria-label="Sair" className="rounded-lg p-2 text-texto-3 hover:bg-elevado hover:text-texto">
            <LogOut size={18} />
          </button>
        )}
      </header>

      <main className="min-w-0 px-4 pb-28 pt-5 md:px-8 lg:px-10 lg:pb-10 lg:pt-8">
        <Outlet />
      </main>

      {/* ── Celular: abas embaixo ── */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid border-t border-borda bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        style={{ gridTemplateColumns: `repeat(${itens.length}, minmax(0, 1fr))` }}>
        {itens.map(({ Icone, ...item }) => (
          <NavLink key={item.para} to={item.para} end
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[0.68rem] font-medium transition ${isActive ? 'text-acento' : 'text-texto-3'}`}>
            <Icone size={20} />
            <span className="max-w-full truncate px-1">{item.rotulo}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
