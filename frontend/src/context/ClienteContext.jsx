import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { configDoCliente, temPersonalizacao } from '@/clientes/registro'
import { slugValido } from '@/utils/slug'
import { corValida, textoSobre } from '@/utils/cor'
import { ClienteContext } from './useCliente'
import { useAuth } from './useAuth'

// Resolve quem é o cliente do slug da URL e monta a config final:
//   config/padrao.js  <  src/clientes/<slug>/config.js  <  banco
//
// O banco (nome, cor, logo) é o que o dono troca em Configurações e vale na
// hora. A pasta do cliente fica para o que é código.
//
// estado: 'carregando' | 'ok' | 'nao_encontrado' | 'inativo'
export function ClienteProvider({ slug, children }) {
  const { session } = useAuth()
  const usuarioId = session?.user.id ?? null
  const [resultado, setResultado] = useState({ slug: null, estado: 'carregando', registro: null })
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let cancelado = false
    const concluir = (estado, registro = null) => {
      if (!cancelado) setResultado({ slug, estado, registro })
    }

    if (!slugValido(slug)) {
      concluir('nao_encontrado')
      return
    }

    // Sem banco ligado: qualquer slug com pasta em src/clientes abre, para dar
    // para desenvolver a personalização antes de existir o cadastro.
    if (!supabaseConfigurado) {
      concluir(temPersonalizacao(slug) ? 'ok' : 'nao_encontrado', { id: null, slug, nome: null })
      return
    }

    // Refaz ao entrar/sair (usuarioId): `meu_papel` depende de quem está logado.
    supabase.rpc('cliente_por_slug', { p_slug: slug }).then(({ data, error }) => {
      const registro = Array.isArray(data) ? data[0] : data
      if (error || !registro) return concluir('nao_encontrado')
      if (!registro.ativo) return concluir('inativo', registro)
      concluir('ok', registro)
    })

    return () => { cancelado = true }
  }, [slug, usuarioId, versao])

  // Configurações chama depois de salvar: a tela inteira já pega a cor/logo nova.
  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  // Enquanto o efeito do slug novo não terminou, o resultado ainda é do anterior.
  const atual = resultado.slug === slug ? resultado : { estado: 'carregando', registro: null }

  const valor = useMemo(() => ({
    slug,
    estado: atual.estado,
    cliente: atual.registro,
    papel: atual.registro?.meu_papel ?? null,
    ehDono: atual.registro?.meu_papel === 'dono',
    config: configDoCliente(slug, doBanco(atual.registro)),
    recarregar,
  }), [slug, atual.estado, atual.registro, recarregar])

  return <ClienteContext.Provider value={valor}>{children}</ClienteContext.Provider>
}

// Só o que o banco tem preenchido entra; vazio = segue o código/padrão.
function doBanco(registro) {
  if (!registro) return null
  const tema = {}
  if (corValida(registro.cor_primaria)) {
    tema.corPrimaria = registro.cor_primaria
    tema.corPrimariaInk = textoSobre(registro.cor_primaria)
  }
  if (registro.logo_url) tema.logo = registro.logo_url
  return {
    ...(registro.nome ? { nome: registro.nome } : {}),
    ...(Object.keys(tema).length ? { tema } : {}),
  }
}
