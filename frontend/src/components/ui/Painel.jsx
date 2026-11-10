import { useEffect } from 'react'
import { X } from 'lucide-react'

// Painel por cima da tela: lateral no computador, folha que sobe no celular.
// Título e rodapé fixos; só o meio rola. Esc ou clique fora fecha.
export default function Painel({ titulo, fechar, rodape, largura = 'lg:w-[34rem]', children }) {
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && fechar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [fechar])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/60 backdrop-blur-[2px] lg:items-stretch" onClick={fechar}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={titulo}
        className={`surgir flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-borda bg-card lg:max-h-none lg:rounded-none lg:border-l lg:border-t-0 ${largura}`}>
        <div className="flex items-center justify-between border-b border-borda px-5 py-4">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button type="button" onClick={fechar} aria-label="Fechar" className="rounded-lg p-2 text-texto-3 hover:bg-elevado hover:text-texto">
            <X size={18} />
          </button>
        </div>
        {/* min-h-0: sem ele o meio cresce do tamanho do conteúdo e empurra o topo para fora da tela */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {rodape && <div className="border-t border-borda px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{rodape}</div>}
      </div>
    </div>
  )
}
