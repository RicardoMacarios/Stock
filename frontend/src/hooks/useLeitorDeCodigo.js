import { useEffect, useRef } from 'react'

// Leitor de código USB/Bluetooth ("pistola") funciona como teclado: digita o
// código muito rápido e aperta Enter. Este hook pega essa digitação em
// qualquer lugar da página QUANDO o foco não está num campo (aí o próprio
// campo recebe o Enter). Teclas com mais de 60 ms entre si = pessoa
// digitando, não leitor: o buffer zera.
export function useLeitorDeCodigo(aoLer, { ativo = true } = {}) {
  const callback = useRef(aoLer)
  useEffect(() => { callback.current = aoLer }, [aoLer])

  useEffect(() => {
    if (!ativo) return
    let buffer = ''
    let ultima = 0

    function tecla(e) {
      const alvo = e.target
      if (alvo instanceof HTMLElement && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))) return
      if (e.ctrlKey || e.altKey || e.metaKey) return

      const agora = performance.now()
      if (agora - ultima > 60) buffer = ''
      ultima = agora

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          e.preventDefault()
          callback.current(buffer)
        }
        buffer = ''
      } else if (e.key.length === 1) {
        buffer += e.key
      }
    }

    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [ativo])
}
