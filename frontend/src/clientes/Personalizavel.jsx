import { Suspense } from 'react'
import { useCliente } from '@/context/useCliente'
import { resolverComponente, resolverPagina } from './registro'

function Carregando() {
  return <div className="p-8 text-texto-3 text-sm">Carregando…</div>
}

// <Pagina nome="ProdutosPage" /> renderiza src/clientes/<slug>/paginas/ProdutosPage.jsx
// se o cliente tiver, senão a ProdutosPage da base.
export function Pagina({ nome, ...props }) {
  const { slug } = useCliente()
  const Componente = resolverPagina(nome, slug)
  return (
    <Suspense fallback={<Carregando />}>
      {/* eslint-disable-next-line react-hooks/static-components -- resolverPagina guarda o lazy em cache: mesma referência a cada render */}
      <Componente {...props} />
    </Suspense>
  )
}

// Mesmo mecanismo para componentes: src/clientes/<slug>/componentes/<nome>.jsx
// ou o de src/components/**.
export function Componente({ nome, fallback = null, ...props }) {
  const { slug } = useCliente()
  const Resolvido = resolverComponente(nome, slug)
  return (
    <Suspense fallback={fallback}>
      {/* eslint-disable-next-line react-hooks/static-components -- idem: cacheado em registro.js */}
      <Resolvido {...props} />
    </Suspense>
  )
}
