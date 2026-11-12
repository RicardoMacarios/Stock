// Telefone brasileiro: DDD + número. Celular tem 11 dígitos, fixo tem 10.
//   mascararTelefone('16997485859') → '(16) 99748-5859'
//   mascararTelefone('1633334444')  → '(16) 3333-4444'
// Serve para o campo (formata enquanto digita) e para mostrar telefones já
// salvos, inclusive os antigos gravados só com números.

export const MAX_DIGITOS_TELEFONE = 11

export const digitosDoTelefone = (texto) => String(texto ?? '').replace(/\D/g, '').slice(0, MAX_DIGITOS_TELEFONE)

export function mascararTelefone(texto) {
  const d = digitosDoTelefone(texto)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  const ddd = d.slice(0, 2)
  const resto = d.slice(2)
  // Até 8 dígitos depois do DDD formata como fixo (4-4); com 9, como celular (5-4).
  const corte = resto.length > 8 ? 5 : 4
  return resto.length > corte
    ? `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`
    : `(${ddd}) ${resto}`
}

// Vazio vale (telefone é opcional); preenchido tem de ter DDD + número completo.
export function telefoneValido(texto) {
  const n = digitosDoTelefone(texto).length
  return n === 0 || n === 10 || n === 11
}

// Para mostrar: formata se for um telefone brasileiro; se não, mostra como veio.
export function formatarTelefone(texto) {
  const bruto = String(texto ?? '').replace(/\D/g, '')
  return bruto.length === 10 || bruto.length === 11 ? mascararTelefone(bruto) : (texto ?? '')
}
