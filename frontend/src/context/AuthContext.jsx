import { useEffect, useState } from 'react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { AuthContext } from './useAuth'
import { apagarTudoGuardado } from '@/lib/guardado'
import { esquecerProdutos } from '@/hooks/useProdutos'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(supabaseConfigurado)

  useEffect(() => {
    if (!supabaseConfigurado) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => setSession(sessao))
    return () => data.subscription.unsubscribe()
  }, [])

  // Sair apaga o que ficou guardado no navegador (produtos da loja).
  const sair = () => {
    esquecerProdutos()
    apagarTudoGuardado()
    return supabase?.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, sair, exigeLogin: supabaseConfigurado }}>
      {children}
    </AuthContext.Provider>
  )
}
