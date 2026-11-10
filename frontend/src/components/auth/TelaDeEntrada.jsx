import { Package, ShieldCheck, Users } from 'lucide-react'
import Marca, { Logotipo } from '@/components/ui/Marca'

// Só o que o sistema já faz. Recurso novo entra aqui quando existir de fato.
const BENEFICIOS = [
  { icone: Package, titulo: 'Estoque organizado', texto: 'Produtos, entradas e saídas num só lugar.' },
  { icone: Users, titulo: 'Sua equipe junto', texto: 'Cada pessoa com o próprio acesso.' },
  { icone: ShieldCheck, titulo: 'Dados protegidos', texto: 'Cada empresa vê só o que é dela.' },
]

// Moldura das telas de entrada (login e escolha de empresa).
//   Computador: painel da marca à esquerda, conteúdo à direita.
//   Celular: marca grande no topo e o conteúdo numa "folha" que sobe por baixo.
//
// Sem `nome`: marca do sistema (logotipo Stock). Com `nome` (login dentro do
// slug): logo e nome do cliente.
export default function TelaDeEntrada({ nome, logo, children }) {
  const rodape = `© ${new Date().getFullYear()} ${nome ?? 'Stock'}`

  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* ── Computador ── */}
      <aside className="relative hidden overflow-hidden border-r border-borda bg-card p-12 lg:flex lg:flex-col lg:justify-between">
        <Decoracao />
        <div className="relative">
          {nome ? <MarcaDoCliente nome={nome} logo={logo} tamanho={52} /> : <Logotipo tamanho={52} slogan />}
        </div>

        <div className="relative max-w-md">
          <h2 className="surgir text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
            Seu estoque,<br />
            <span className="text-acento">sob controle.</span>
          </h2>
          <ul className="mt-10 space-y-5">
            {BENEFICIOS.map(({ icone: Icone, titulo, texto }, i) => (
              <li key={titulo} className="surgir flex gap-4" style={{ animationDelay: `${120 + i * 90}ms` }}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-acento/25 bg-acento/10 text-acento">
                  <Icone size={18} />
                </span>
                <span>
                  <span className="block font-semibold">{titulo}</span>
                  <span className="block text-sm text-texto-2">{texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-texto-3">{rodape}</p>
      </aside>

      {/* ── Celular: topo com a marca ── */}
      <header className="relative flex flex-col items-center justify-center overflow-hidden px-6 pb-10 pt-[max(3.5rem,env(safe-area-inset-top))] lg:hidden">
        <Decoracao compacta />
        <div className="surgir relative">
          {nome
            ? <MarcaDoCliente nome={nome} logo={logo} tamanho={64} empilhado />
            : <Logotipo tamanho={72} slogan empilhado />}
        </div>
      </header>

      {/* Conteúdo: folha arredondada no celular, coluna centralizada no computador. */}
      <main className="relative flex flex-1 flex-col rounded-t-3xl border-t border-borda bg-card px-6 pt-8 shadow-[0_-12px_40px_rgb(0_0_0/0.35)]
        pb-[max(1.5rem,env(safe-area-inset-bottom))]
        lg:items-center lg:justify-center lg:rounded-none lg:border-0 lg:bg-transparent lg:p-6 lg:shadow-none">
        <div className="mx-auto w-full max-w-sm">{children}</div>
        <p className="mt-auto pt-10 text-center text-xs text-texto-3 lg:hidden">{rodape}</p>
      </main>
    </div>
  )
}

function MarcaDoCliente({ nome, logo, tamanho, empilhado = false }) {
  return (
    <div className={empilhado ? 'flex flex-col items-center gap-3 text-center' : 'flex items-center gap-3'}>
      <Marca logo={logo} tamanho={tamanho} />
      <span className={empilhado ? 'text-2xl font-bold tracking-tight' : 'text-lg font-semibold'}>{nome}</span>
    </div>
  )
}

// Cantos em diagonal, como no logo, e um brilho suave: só decoração.
function Decoracao({ compacta = false }) {
  const canto = compacta ? 'h-40 w-40 -left-20 -top-20' : 'h-72 w-72 -left-24 -top-24'
  const cantoOposto = compacta ? 'h-40 w-40 -right-20 -bottom-28' : 'h-72 w-72 -right-24 -bottom-24'
  return (
    <>
      <div aria-hidden className={`pointer-events-none absolute rotate-45 bg-gradient-to-b from-acento/35 to-transparent ${canto}`} />
      <div aria-hidden className={`pointer-events-none absolute rotate-45 bg-gradient-to-t from-acento/35 to-transparent ${cantoOposto}`} />
      <div aria-hidden
        className={`pointer-events-none absolute rounded-full bg-acento/10 blur-3xl ${
          compacta ? 'left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2' : 'left-1/4 top-1/3 h-96 w-96'
        }`} />
    </>
  )
}
