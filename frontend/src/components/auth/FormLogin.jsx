import { useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { traduzirErro } from '@/lib/erros'
import TelaDeEntrada from './TelaDeEntrada'
import { Alerta, BotaoPrimario, Campo, CampoSenha } from './Campos'

// Login por e-mail e senha: em /login (entrada geral) e em /:slug/login (com a
// cara do cliente). A navegação depois de entrar fica com quem usa: a sessão
// muda e a tela reage.
//
// "Esqueci a senha" troca o formulário aqui mesmo; o link do e-mail leva para
// /redefinir-senha.
export default function FormLogin({ nome, logo, rodape }) {
  const [modo, setModo] = useState('entrar') // 'entrar' | 'recuperar'
  const [email, setEmail] = useState('')

  return (
    <TelaDeEntrada nome={nome} logo={logo}>
      {/* key: troca de modo refaz a animação de entrada */}
      <div key={modo} className="surgir">
        {modo === 'entrar'
          ? <Entrar email={email} setEmail={setEmail} esqueci={() => setModo('recuperar')} />
          : <Recuperar email={email} setEmail={setEmail} voltar={() => setModo('entrar')} />}
      </div>
      {modo === 'entrar' && rodape}
    </TelaDeEntrada>
  )
}

function Entrar({ email, setEmail, esqueci }) {
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function entrar(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEnviando(false)
    if (error) setErro(traduzirErro(error))
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Entrar</h1>
      <p className="mt-1 text-sm text-texto-2">Use o e-mail e a senha da sua conta.</p>

      <form onSubmit={entrar} className="mt-8 space-y-5">
        <Campo id="email" rotulo="E-mail" icone={Mail} type="email" required autoComplete="email" autoFocus
          inputMode="email" placeholder="voce@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />

        <CampoSenha required autoComplete="current-password" placeholder="Sua senha" value={senha}
          onChange={(e) => setSenha(e.target.value)}
          acaoDoRotulo={
            <button type="button" onClick={esqueci} className="text-xs font-medium text-acento hover:underline">
              Esqueci a senha
            </button>
          } />

        {erro && <Alerta>{erro}</Alerta>}

        <BotaoPrimario carregando={enviando} textoCarregando="Entrando…">Entrar</BotaoPrimario>
      </form>
    </>
  )
}

function Recuperar({ email, setEmail, voltar }) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/redefinir-senha`,
    })
    setEnviando(false)
    if (error) setErro(traduzirErro(error))
    else setEnviado(true)
  }

  return (
    <>
      <button type="button" onClick={voltar}
        className="mb-6 flex items-center gap-1.5 text-sm text-texto-3 transition hover:text-texto">
        <ArrowLeft size={16} /> Voltar para o login
      </button>

      <h1 className="text-2xl font-bold tracking-tight">Esqueceu a senha?</h1>
      <p className="mt-1 text-sm text-texto-2">
        Informe o e-mail da sua conta. Enviaremos um link para você criar uma senha nova.
      </p>

      {enviado ? (
        <div className="mt-8 space-y-5">
          <Alerta tipo="ok">
            Se existir uma conta com <strong>{email.trim()}</strong>, o link chega em instantes.
            Confira também a caixa de spam.
          </Alerta>
          <BotaoPrimario type="button" onClick={voltar}>Voltar para o login</BotaoPrimario>
        </div>
      ) : (
        <form onSubmit={enviar} className="mt-8 space-y-5">
          <Campo id="email-recuperar" rotulo="E-mail" icone={Mail} type="email" required autoComplete="email"
            autoFocus inputMode="email" placeholder="voce@empresa.com" value={email}
            onChange={(e) => setEmail(e.target.value)} />
          {erro && <Alerta>{erro}</Alerta>}
          <BotaoPrimario carregando={enviando} textoCarregando="Enviando…">Enviar link</BotaoPrimario>
        </form>
      )}
    </>
  )
}
