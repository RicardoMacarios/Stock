import { useEffect, useState } from 'react'

// O teclado do celular está aberto? No iPhone, quando o teclado sobe, o Safari
// leva junto tudo que é `fixed` embaixo (as abas apareciam em cima do teclado).
// Com isso o layout esconde as abas enquanto o teclado está na tela.
//
// Dois sinais, porque nenhum sozinho é confiável em todo celular:
//   1. visualViewport encolheu bem mais que a janela (teclado ocupando espaço);
//   2. o foco está num campo de digitar (input de texto, textarea…) num
//      aparelho de toque.
// Também marca <html data-teclado="aberto">, para o CSS (ex.: a barra
// "Finalizar venda" desce até o fundo quando as abas somem).

const CAMPO_DE_DIGITAR = 'textarea, [contenteditable="true"], input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=date]):not([type=file]):not([type=range]):not([type=color])'

export function useTecladoAberto() {
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    const toque = window.matchMedia('(pointer: coarse)').matches
    if (!toque) return
    const vv = window.visualViewport

    const medir = () => {
      const encolheu = vv ? window.innerHeight - vv.height > 150 : false
      const ativo = document.activeElement
      const digitando = Boolean(ativo && ativo.matches?.(CAMPO_DE_DIGITAR))
      setAberto(encolheu || digitando)
    }
    // focusout acontece antes do foco ir para o próximo campo: espera um tique.
    const depois = () => setTimeout(medir, 50)

    vv?.addEventListener('resize', medir)
    document.addEventListener('focusin', medir)
    document.addEventListener('focusout', depois)
    return () => {
      vv?.removeEventListener('resize', medir)
      document.removeEventListener('focusin', medir)
      document.removeEventListener('focusout', depois)
    }
  }, [])

  useEffect(() => {
    if (aberto) document.documentElement.dataset.teclado = 'aberto'
    else delete document.documentElement.dataset.teclado
  }, [aberto])

  return aberto
}
