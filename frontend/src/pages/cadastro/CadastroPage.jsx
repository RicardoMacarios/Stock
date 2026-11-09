import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { useAuth } from '@/context/useAuth'
import { traduzirErro } from '@/lib/erros'
import { generateSlug } from '@/utils/slug'
import { classeBotao, classeCampo } from '@/lib/classes'

// /cadastro?codigo=XXXX-XXXX
//
// Quem tem um código de convite cria a conta e, no mesmo passo, o cliente com
// a URL dele. Já logado (ex.: precisou confirmar o e-mail antes), só pede o
// código e o nome da empresa.
export default function CadastroPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [codigo, setCodigo] = useState(params.get('codigo') ?? '')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aguardandoEmail, setAguardandoEmail] = useState(false)

  if (!supabaseConfigurado) {
    return <Centro><p className="text-texto-2">Banco não configurado (frontend/.env).</p></Centro>
  }

  async function cadastrar(e) {
    e.preventDefault()
    setEnviando(true)
    try {
      // 1. Código primeiro: código errado não pode deixar conta criada à toa.
      const { data: conf, error: erroConf } = await supabase.rpc('conferir_convite', { p_codigo: codigo })
      if (erroConf) throw erroConf
      const convite = Array.isArray(conf) ? conf[0] : conf
      if (!convite?.valido) throw new Error(convite?.motivo ?? 'convite_invalido')

      // 2. Conta (se ainda não está logado).
      if (!session) {
        const { data, error } = await supabase.auth.signUp({ email, password: senha })
        if (error) throw error
        if (!data.session) {
          // Supabase com "Confirm email" ligado: sem sessão até confirmar.
          setAguardandoEmail(true)
          return
        }
      }

      // 3. Cliente + vínculo de dono + código queimado, tudo no banco.
      const { data: cliente, error } = await supabase.rpc('criar_cliente_com_convite', {
        p_codigo: codigo,
        p_nome: nome,
        p_slug: generateSlug(nome),
      })
      if (error) throw error

      toast.success('Conta criada!')
      navigate(`/${cliente.slug}`, { replace: true })
    } catch (erro) {
      toast.error(traduzirErro(erro))
    } finally {
      setEnviando(false)
    }
  }

  if (aguardandoEmail) {
    return (
      <Centro>
        <h1 className="text-xl font-bold">Confirme seu e-mail</h1>
        <p className="mt-2 text-sm text-texto-2">
          Enviamos um link para <strong>{email}</strong>. Depois de confirmar, entre e volte
          nesta página com o mesmo código para terminar.
        </p>
      </Centro>
    )
  }

  const slugPrevisto = generateSlug(nome)

  return (
    <div className="min-h-dvh grid place-items-center p-4">
      <form onSubmit={cadastrar} className="w-full max-w-sm space-y-4 rounded-lg border border-borda bg-card p-6">
        <h1 className="text-xl font-bold">Criar conta</h1>

        <input required placeholder="Código de convite" value={codigo} autoCapitalize="characters"
          onChange={(e) => setCodigo(e.target.value.toUpperCase())} className={`${classeCampo} font-mono`} />

        <div>
          <input required placeholder="Nome da empresa" value={nome}
            onChange={(e) => setNome(e.target.value)} className={classeCampo} />
          {slugPrevisto && (
            <p className="mt-1 text-xs text-texto-3">
              Seu endereço: <span className="font-mono">/{slugPrevisto}</span>
            </p>
          )}
        </div>

        {session ? (
          <p className="text-xs text-texto-3">Entrando como {session.user.email}</p>
        ) : (
          <>
            <input type="email" required autoComplete="email" placeholder="E-mail" value={email}
              onChange={(e) => setEmail(e.target.value)} className={classeCampo} />
            <input type="password" required minLength={6} autoComplete="new-password" placeholder="Senha"
              value={senha} onChange={(e) => setSenha(e.target.value)} className={classeCampo} />
          </>
        )}

        <button disabled={enviando} className={classeBotao}>{enviando ? 'Criando…' : 'Criar conta'}</button>
        <p className="text-center text-xs text-texto-3">
          Já tem conta? Entre pelo endereço da sua empresa. <Link to="/" className="underline">Início</Link>
        </p>
      </form>
    </div>
  )
}

function Centro({ children }) {
  return <div className="min-h-dvh grid place-items-center p-6 text-center"><div className="max-w-sm">{children}</div></div>
}
