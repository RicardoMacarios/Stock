import { useEffect, useRef } from 'react'

// Fim de uma lista longa: quando aparece na tela (ou quase), pede mais itens.
// Listas de milhares de linhas desenham só o começo e crescem ao rolar.
// O botão fica de reserva (navegador sem IntersectionObserver, teclado).
export default function MaisAoRolar({ mostrando, total, mais }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) mais()
    }, { rootMargin: '600px 0px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [mais, mostrando])

  if (mostrando >= total) return null
  return (
    <div ref={ref} className="flex items-center justify-center gap-3 border-t border-borda p-4 text-xs text-texto-3">
      Mostrando {mostrando.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}
      <button type="button" onClick={mais} className="rounded-lg border border-borda-forte px-3 py-1.5 text-texto-2 hover:bg-elevado">
        Mostrar mais
      </button>
    </div>
  )
}
