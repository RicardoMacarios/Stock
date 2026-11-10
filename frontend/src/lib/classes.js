// Classes repetidas de campos.

// Telas antigas (admin): campo simples.
export const classeCampo = 'w-full rounded border border-borda-forte bg-fundo px-3 py-2'

// Telas da loja (produtos, configurações): campo arredondado, foco na cor de
// acento e 16px no celular (o iPhone não dá zoom ao focar).
export const classeEntrada =
  'w-full rounded-xl border border-borda-forte bg-fundo px-3 py-2.5 text-base outline-none transition ' +
  'placeholder:text-texto-3 focus:border-acento focus:ring-2 focus:ring-acento/25 lg:text-sm'
