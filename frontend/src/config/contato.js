// Contato comercial do Stock (o dono do sistema, não de um cliente).
// Usado no botão "Quero me cadastrar" do /login.

// Formato internacional, só dígitos: 55 (Brasil) + DDD + número.
export const WHATSAPP = '5516997485859'

export const MENSAGEM_CADASTRO = 'Olá! Quero me cadastrar no Stock.'

export const linkWhatsApp = (mensagem = MENSAGEM_CADASTRO) =>
  `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensagem)}`
