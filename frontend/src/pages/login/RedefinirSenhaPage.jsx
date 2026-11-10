import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { useAuth } from '@/context/useAuth'
import { traduzirErro } from '@/lib/erros'
import TelaDeEntrada from '@/components/auth/TelaDeEntrada'
import { Alerta, BotaoPrimario, CampoSenha } from '@/components/auth/Campos'

// /redefinir-senha — destino do link de "Esqueci a senha". O Supabase lê o
// token da URL e abre uma sessão; aqui a pessoa só escolhe a senha nova.
// Depois vai para /login, que já sabe para onde levar cada conta.
//
// No Supabase, esta URL precisa estar em Authentication → URL Configuration →
// Redirect URLs (localhost e o domínio de produção).
export default function RedefinirSenhaPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  if (!supabaseConfigurado) return null
  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 size={24} className="animate-spin text-texto-3" aria-label="Carregando" />
      </div>
    )
  }

  if (!session) {
    return (
      <TelaDeEntrada>
        <div className="surgir">
          <h1 className="text-2xl font-bold tracking-tight">Link inválido ou expirado</h1>
          <p className="mt-2 text-sm text-texto-2">
            Peça um link novo na tela de login, em <strong className="text-texto">Esqueci a senha</strong>.
          </p>
          <Link to="/login"
            className="mt-8 flex w-full items-center justify-center rounded-xl bg-acento py-3.5 font-semibold text-sobre-acento lg:rounded-(--radius-controle) lg:py-2.5">
            Ir para o login
          </Link>
        </div>
      </TelaDeEntrada>
    )
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.')
    if (senha !== confirmacao) return setErro('As senhas não são iguais.')
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) return setErro(traduzirErro(error))
    toast.success('Senha alterada!')
    navigate('/login', { replace: true })
  }

  return (
    <TelaDeEntrada>
      <div className="surgir">
        <h1 className="text-2xl font-bold tracking-tight">Criar senha nova</h1>
        <p className="mt-1 text-sm text-texto-2">Para a conta {session.user.email}.</p>

        <form onSubmit={salvar} className="mt-8 space-y-5">
          <CampoSenha id="senha-nova" rotulo="Senha nova" required autoFocus autoComplete="new-password"
            placeholder="Pelo menos 6 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <CampoSenha id="senha-confirmar" rotulo="Repita a senha" required autoComplete="new-password"
            placeholder="A mesma senha" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
          {erro && <Alerta>{erro}</Alerta>}
          <BotaoPrimario carregando={salvando} textoCarregando="Salvando…">Salvar senha</BotaoPrimario>
        </form>
      </div>
    </TelaDeEntrada>
  )
}
