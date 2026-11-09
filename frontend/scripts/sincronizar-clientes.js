// Cria a pasta src/clientes/<slug>/ de todo cliente do banco que ainda não tem.
//
//   npm run sincronizar-clientes
//
// Roda no SEU computador. Lê do frontend/.env:
//   VITE_SUPABASE_URL           (o mesmo do app)
//   SUPABASE_SERVICE_ROLE_KEY   (Supabase → Project Settings → API Keys)
//
// ⚠️ A service role ignora todo o RLS. Fica só no .env local (que o git ignora)
// e NUNCA vai para a Vercel nem para variável começando com VITE_.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { criarPastaDoCliente, pastaExiste, pastaClientes } from './lib/pastaDoCliente.js'

const arquivoEnv = join(pastaClientes, '..', '..', '.env')
if (existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv)

const url = process.env.VITE_SUPABASE_URL
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !chave) {
  console.error('Faltam VITE_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY em frontend/.env.')
  process.exit(1)
}

const supabase = createClient(url, chave, { auth: { persistSession: false } })

const { data: clientes, error } = await supabase
  .from('clientes')
  .select('slug, nome')
  .order('criado_em')

if (error) {
  console.error('Não foi possível ler os clientes:', error.message)
  process.exit(1)
}

const novos = clientes.filter((c) => !pastaExiste(c.slug))

for (const c of novos) {
  criarPastaDoCliente(c.slug, c.nome)
  console.log(`✔ src/clientes/${c.slug}/  (${c.nome})`)
}

console.log(novos.length
  ? `\n${novos.length} pasta(s) criada(s). ${clientes.length} cliente(s) no banco.`
  : `Tudo em dia: ${clientes.length} cliente(s) no banco, todos com pasta.`)
