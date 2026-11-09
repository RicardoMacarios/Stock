import { createContext, useContext } from 'react'

export const ClienteContext = createContext(null)

// { slug, estado, cliente, config }
export function useCliente() {
  const valor = useContext(ClienteContext)
  if (!valor) throw new Error('useCliente() fora de <ClienteProvider>.')
  return valor
}
