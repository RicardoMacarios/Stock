// Cria src/clientes/<slug>/ a partir de src/clientes/_modelo.
// Usado pelo novo-cliente (manual) e pelo sincronizar-clientes (a partir do banco).

import { cpSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const pastaClientes = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'clientes')

export function pastaExiste(slug) {
  return existsSync(join(pastaClientes, slug))
}

export function criarPastaDoCliente(slug, nome) {
  const destino = join(pastaClientes, slug)
  cpSync(join(pastaClientes, '_modelo'), destino, { recursive: true })

  // Troca os marcadores em todos os arquivos copiados.
  const substituir = (pasta) => {
    for (const item of readdirSync(pasta)) {
      const caminho = join(pasta, item)
      if (statSync(caminho).isDirectory()) substituir(caminho)
      else {
        const texto = readFileSync(caminho, 'utf8')
          .replaceAll('__SLUG__', slug)
          .replaceAll('__NOME__', nome ?? slug)
        writeFileSync(caminho, texto)
      }
    }
  }
  substituir(destino)
  return destino
}
