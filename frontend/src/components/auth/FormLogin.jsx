import { useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { traduzirErro } from '@/lib/erros'
import { classeBotao, classeCampo } from '@/lib/classes'

// Formulário de e-mail e senha usado no login do cliente (/:slug/login) e no /admin.
// A navegação depois de entrar fica com quem usa: a sessão muda e a tela reage.
export default function FormLogin({ titulo, rodape }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setEnviando(false)
    if (error) toast.error(traduzirErro(error))
  }

  return (
    <div className="min-h-dvh grid place-items-center p-4">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-lg border border-borda bg-card p-6">
        <h1 className="text-xl font-bold">{titulo}</h1>
        <input type="email" required autoComplete="email" placeholder="E-mail" value={email}
          onChange={(e) => setEmail(e.target.value)} className={classeCampo} />
        <input type="password" required autoComplete="current-password" placeholder="Senha" value={senha}
          onChange={(e) => setSenha(e.target.value)} className={classeCampo} />
        <button disabled={enviando} className={classeBotao}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        {rodape}
      </form>
    </div>
  )
}
