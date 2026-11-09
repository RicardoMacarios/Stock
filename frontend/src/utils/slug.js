// Arquivo sem JSX e sem import do Vite de propósito: o scripts/novo-cliente.js
// (Node puro) importa daqui para validar o slug com a MESMA regra da tela.

export function generateSlug(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Caminhos que o App.jsx declara antes de /:slug, mais alguns guardados para o
// futuro. Cliente com um desses slugs ficaria inacessível: a rota fixa ganha.
// Rota nova no App.jsx entra aqui E na função public.slug_reservado do banco.
// `_modelo` é a pasta-molde em src/clientes/ — não pode virar cliente.
export const SLUGS_RESERVADOS = new Set([
  'login', 'cadastro', 'esqueci-senha', 'redefinir-senha', 'termos', 'privacidade',
  'admin', 'api', 'app', 'assets', 'www', 'suporte', 'ajuda', 'entrar', 'sair',
  'planos', '_modelo',
])

export function slugReservado(slug) {
  return SLUGS_RESERVADOS.has(slug)
}

// Slug válido = já está normalizado, não é vazio e não é reservado.
export function slugValido(slug) {
  return Boolean(slug) && generateSlug(slug) === slug && !slugReservado(slug)
}
