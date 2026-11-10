// Escolhe o texto que vai SOBRE uma cor (botão preenchido, avatar): escuro ou
// claro, o que der mais contraste (WCAG). Assim o cliente escolhe só a cor.

const ESCURO = '#0F1112'
const CLARO = '#FFFFFF'

export const corValida = (cor) => /^#[0-9a-f]{6}$/i.test(cor ?? '')

function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contraste = (a, b) => {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

export function textoSobre(cor) {
  return contraste(cor, ESCURO) >= contraste(cor, CLARO) ? ESCURO : CLARO
}
