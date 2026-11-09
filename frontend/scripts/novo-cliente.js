// Cria a pasta de personalização de um cliente, sem passar pelo banco.
//
//   npm run novo-cliente -- "Mercado do Zé"     → src/clientes/mercado-do-ze/
//
// No dia a dia o cliente nasce pelo convite (/cadastro) e a pasta vem do
// `npm run sincronizar-clientes`. Este comando é para quando você mesmo cria.

import { generateSlug, slugReservado } from '../src/utils/slug.js'
import { criarPastaDoCliente, pastaExiste } from './lib/pastaDoCliente.js'

const entrada = process.argv.slice(2).join(' ').trim()

if (!entrada) {
  console.error('Uso: npm run novo-cliente -- "<nome ou slug do cliente>"')
  process.exit(1)
}

const slug = generateSlug(entrada)

if (!slug) {
  console.error(`"${entrada}" não gera um slug válido.`)
  process.exit(1)
}
if (slugReservado(slug)) {
  console.error(`"${slug}" é reservado (rota fixa do sistema). Escolha outro.`)
  process.exit(1)
}
if (pastaExiste(slug)) {
  console.error(`src/clientes/${slug} já existe.`)
  process.exit(1)
}

const nome = entrada === slug ? slug : entrada
criarPastaDoCliente(slug, nome)

console.log(`
✔ Criado src/clientes/${slug}/

Se o cliente ainda não existe no banco, cadastre:

  insert into public.clientes (slug, nome) values ('${slug}', '${nome.replaceAll("'", "''")}');
`)
