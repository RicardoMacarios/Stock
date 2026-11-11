// Guarda dados no navegador (IndexedDB), para a tela abrir na hora sem
// esperar o banco. Cabe muito mais que o localStorage (milhares de produtos).
// Qualquer falha (aba anônima, armazenamento bloqueado) vira "não tem nada
// guardado": a tela segue funcionando, só carrega do banco como antes.

const BANCO = 'stock'
const LOJA = 'guardado'

let abrindo = null
function abrir() {
  if (abrindo) return abrindo
  abrindo = new Promise((resolve) => {
    try {
      const req = indexedDB.open(BANCO, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(LOJA)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return abrindo
}

function pedir(modo, fazer) {
  return abrir().then((db) => new Promise((resolve) => {
    if (!db) return resolve(null)
    try {
      const req = fazer(db.transaction(LOJA, modo).objectStore(LOJA))
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  }))
}

export const lerGuardado = (chave) => pedir('readonly', (s) => s.get(chave))
export const guardar = (chave, valor) => pedir('readwrite', (s) => s.put(valor, chave))
export const apagarGuardado = (chave) => pedir('readwrite', (s) => s.delete(chave))
export const apagarTudoGuardado = () => pedir('readwrite', (s) => s.clear())
