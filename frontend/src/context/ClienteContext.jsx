import { useEffect, useMemo, useState } from 'react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { configDoCliente, temPersonalizacao } from '@/clientes/registro'
import { slugValido } from '@/utils/slug'
import { ClienteContext } from './useCliente'

// Resolve quem é o cliente do slug da URL e monta a config final:
//   config/padrao.js  <  src/clientes/<slug>/config.js  <  dados do banco (nome)
//
// estado: 'carregando' | 'ok' | 'nao_encontrado' | 'inativo'
export function ClienteProvider({ slug, children }) {
  const [resultado, setResultado] = useState({ slug: null, estado: 'carregando', registro: null })

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

    supabase.rpc('cliente_por_slug', { p_slug: slug }).then(({ data, error }) => {
      const registro = Array.isArray(data) ? data[0] : data
      if (error || !registro) return concluir('nao_encontrado')
      if (!registro.ativo) return concluir('inativo', registro)
      concluir('ok', registro)
    })

    return () => { cancelado = true }
  }, [slug])

  // Enquanto o efeito do slug novo não terminou, o resultado ainda é do anterior.
  const atual = resultado.slug === slug ? resultado : { estado: 'carregando', registro: null }

  const valor = useMemo(() => ({
    slug,
    estado: atual.estado,
    cliente: atual.registro,
    config: configDoCliente(slug, atual.registro?.nome ? { nome: atual.registro.nome } : null),
  }), [slug, atual.estado, atual.registro])

  return <ClienteContext.Provider value={valor}>{children}</ClienteContext.Provider>
}
