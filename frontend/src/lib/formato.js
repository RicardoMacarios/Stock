// Formatação de números para a tela (pt-BR).

const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const realInteiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const realCurto = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 })
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

export const dinheiro = (v) => real.format(Number(v) || 0)
// "R$ 1,2 mil" — eixos de gráfico, onde não cabe o valor inteiro.
export const dinheiroCurto = (v) => (Math.abs(v) < 1000 ? realInteiro.format(v) : realCurto.format(v))
export const quantidade = (v) => numero.format(Number(v) || 0)

// "12,50" ou "12.50" → 12.5. Vazio → null.
export function lerNumero(texto) {
  const limpo = String(texto ?? '').trim().replace(/\s|R\$/g, '')
  if (!limpo) return null
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const n = Number(normal)
  return Number.isFinite(n) ? n : NaN
}

// Valor do banco (12.5) → texto do campo ("12,50").
export const paraCampo = (v) => (v === null || v === undefined || v === '' ? '' : Number(v).toFixed(2).replace('.', ','))

export const horaCurta = (data) => new Date(data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

// Meia-noite de hoje no horário do navegador.
export function inicioDeHoje() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
