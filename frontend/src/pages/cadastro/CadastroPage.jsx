import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2, CircleCheck, Loader2, Mail, MailCheck, TriangleAlert } from 'lucide-react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { useAuth } from '@/context/useAuth'
import { traduzirErro } from '@/lib/erros'
import { generateSlug } from '@/utils/slug'
import TelaDeEntrada from '@/components/auth/TelaDeEntrada'
import { Alerta, BotaoPrimario, Campo, CampoSenha } from '@/components/auth/Campos'

// /cadastro?codigo=XXXX-XXXX — o link do convite.
//
// Sempre cria uma CONTA NOVA: nome da empresa, e-mail e senha. Se o navegador
// já tem alguém logado (ex.: o admin testando o próprio link), essa sessão sai
// antes, para a empresa nunca nascer na conta errada.
//
// Com "Confirm email" ligado no Supabase, o link do e-mail volta para cá com
// &continuar=1: aí a conta já existe e só falta criar a empresa.
export default function CadastroPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const continuar = params.get('continuar') === '1'

  const codigo = (params.get('codigo') ?? '').trim().toUpperCase()
  const [nome, setNome] = useState(params.get('empresa') ?? '')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [aguardandoEmail, setAguardandoEmail] = useState(false)
  const convite = useConvite(params.get('codigo'))

  if (!supabaseConfigurado) {
    return <TelaDeEntrada><p className="text-texto-2">Banco não configurado (frontend/.env).</p></TelaDeEntrada>
  }
  if (loading || convite.estado === 'conferindo') return <Carregando />

  const finalizando = continuar && Boolean(session)

  async function criarEmpresa() {
    const { data: cliente, error } = await supabase.rpc('criar_cliente_com_convite', {
      p_codigo: codigo,
      p_nome: nome,
      p_slug: generateSlug(nome),
    })
    if (error) throw error
    toast.success('Empresa criada!')
    navigate(`/${cliente.slug}`, { replace: true })
  }

  async function cadastrar(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      // Código primeiro: código errado não pode deixar conta criada à toa.
      const { data: conf, error: erroConf } = await supabase.rpc('conferir_convite', { p_codigo: codigo })
      if (erroConf) throw erroConf
      const situacao = Array.isArray(conf) ? conf[0] : conf
      if (!situacao?.valido) throw new Error(situacao?.motivo ?? 'convite_invalido')

      if (!finalizando) {
        // Conta nova sempre. Quem estava logado neste navegador sai antes.
        if (session) await supabase.auth.signOut({ scope: 'local' })
        const voltarPara = `${location.origin}/cadastro?codigo=${encodeURIComponent(codigo)}` +
          `&empresa=${encodeURIComponent(nome)}&continuar=1`
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { emailRedirectTo: voltarPara },
        })
        if (error) {
          // E-mail que já tem conta (ex.: cadastrou mas a empresa não chegou a
          // nascer): com a senha certa, usa a conta e só cria a empresa.
          if (!/already registered/i.test(error.message)) throw error
          const { error: erroLogin } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
          if (erroLogin) throw new Error('conta_existente_senha_errada')
          await criarEmpresa()
          return
        }
        if (!data.session) {
          // "Confirm email" ligado: sem sessão até confirmar.
          setAguardandoEmail(true)
          return
        }
      }

      await criarEmpresa()
    } catch (falha) {
      setErro(traduzirErro(falha))
    } finally {
      setEnviando(false)
    }
  }

  if (aguardandoEmail) {
    return (
      <TelaDeEntrada>
        <div className="surgir text-center lg:text-left">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-acento/10 text-acento lg:mx-0">
            <MailCheck size={26} />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Confirme seu e-mail</h1>
          <p className="mt-2 text-sm leading-relaxed text-texto-2">
            Enviamos um link para <strong className="text-texto">{email}</strong>. Abra o link e a sua
            empresa <strong className="text-texto">{nome}</strong> é criada na hora.
          </p>
          <p className="mt-4 text-xs text-texto-3">Não chegou? Confira a caixa de spam.</p>
        </div>
      </TelaDeEntrada>
    )
  }

  // Link sem código, ou código que já não serve: nem mostra o formulário.
  if (convite.estado === 'invalido' && !finalizando) {
    return (
      <TelaDeEntrada>
        <div className="surgir">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-warn/10 text-warn">
            <TriangleAlert size={26} />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Convite indisponível</h1>
          <p className="mt-2 text-sm text-texto-2">{traduzirErro(convite.motivo)} Fale com quem te enviou o link.</p>
          <Link to="/login" className="mt-8 inline-block text-sm font-medium text-acento hover:underline">Ir para o login</Link>
        </div>
      </TelaDeEntrada>
    )
  }

  const slugPrevisto = generateSlug(nome)

  return (
    <TelaDeEntrada>
      <div className="surgir">
        <h1 className="text-2xl font-bold tracking-tight">{finalizando ? 'Falta pouco' : 'Crie sua conta'}</h1>
        <p className="mt-1 text-sm text-texto-2">
          {finalizando ? 'Confirme o nome da empresa para terminar.' : 'Cadastre sua empresa para começar a usar o Stock.'}
        </p>

        <p className="mt-6 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-3 py-2.5 text-sm text-ok lg:rounded-(--radius-controle)">
          <CircleCheck size={16} aria-hidden />
          Convite <span className="font-mono font-semibold">{codigo}</span> válido
        </p>

        <form onSubmit={cadastrar} className="mt-6 space-y-5">
          <div>
            <Campo id="empresa" rotulo="Nome da empresa" icone={Building2} required autoFocus maxLength={80}
              placeholder="Ex.: Mercado do Zé" value={nome} onChange={(e) => setNome(e.target.value)} />
            {slugPrevisto && (
              <p className="mt-1.5 text-xs text-texto-3">
                Seu endereço: <span className="font-mono text-texto-2">{location.host}/{slugPrevisto}</span>
              </p>
            )}
          </div>

          {!finalizando && (
            <>
              <Campo id="email" rotulo="E-mail" icone={Mail} type="email" required autoComplete="email" inputMode="email"
                placeholder="voce@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <CampoSenha id="senha" rotulo="Senha" required minLength={6} autoComplete="new-password"
                placeholder="Pelo menos 6 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </>
          )}

          {session && !finalizando && (
            <p className="text-xs text-texto-3">
              Este navegador está conectado como {session.user.email}. Ao criar a conta nova, essa sessão é encerrada aqui.
            </p>
          )}

          {erro && <Alerta>{erro}</Alerta>}

          <BotaoPrimario carregando={enviando} textoCarregando="Criando…">
            {finalizando ? 'Criar empresa' : 'Criar conta'}
          </BotaoPrimario>
        </form>

        <p className="mt-6 text-center text-sm text-texto-3">
          Já tem conta? <Link to="/login" className="font-medium text-acento hover:underline">Entrar</Link>
        </p>
      </div>
    </TelaDeEntrada>
  )
}

// Confere o código assim que a página abre, para não deixar a pessoa
// preencher tudo e só então descobrir que o convite venceu.
function useConvite(codigo) {
  const [resultado, setResultado] = useState({ codigo: null, estado: 'conferindo', motivo: null })

  useEffect(() => {
    if (!supabaseConfigurado || !codigo) return
    let cancelado = false
    supabase.rpc('conferir_convite', { p_codigo: codigo }).then(({ data, error }) => {
      if (cancelado) return
      const c = Array.isArray(data) ? data[0] : data
      if (error || !c?.valido) setResultado({ codigo, estado: 'invalido', motivo: error ?? c?.motivo ?? 'convite_invalido' })
      else setResultado({ codigo, estado: 'valido', motivo: null })
    })
    return () => { cancelado = true }
  }, [codigo])

  if (!codigo) return { estado: 'invalido', motivo: 'convite_invalido' }
  return resultado.codigo === codigo ? resultado : { estado: 'conferindo', motivo: null }
}

function Carregando() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 size={24} className="animate-spin text-texto-3" aria-label="Carregando" />
    </div>
  )
}
