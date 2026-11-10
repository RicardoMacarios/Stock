import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

// Quanto falta: "4:32" ou "3:59:10". null quando já venceu.
export function restante(expiraEm, agora) {
  const ms = new Date(expiraEm).getTime() - agora
  if (Number.isNaN(ms) || ms <= 0) return null
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

// Convites + relógio de 1 s. Fica fora do painel porque a página também conta
// os convites válidos no topo. Sem o relógio a contagem só andaria quando algo
// mais provocasse render, e o convite pareceria válido depois de vencido.
export function useConvites() {
  const [convites, setConvites] = useState(null)
  const [agora, setAgora] = useState(() => Date.now())

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_listar_convites', { p_limite: 12 })
    if (error) toast.error('Não foi possível carregar os convites.')
    setConvites(data ?? [])
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial vinda do banco
    carregar()
    const relogio = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(relogio)
  }, [carregar])

  const validos = convites?.filter((c) => !c.usado_em && restante(c.expira_em, agora)).length ?? null
  return { convites, carregar, agora, validos }
}
