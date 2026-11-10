import { useEffect, useState } from 'react'
import { Boxes, CircleCheck, Clock, Package, PackageOpen, PackageX, RefreshCw, TriangleAlert } from 'lucide-react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { useCliente } from '@/context/useCliente'
import PageHeader from '@/components/ui/PageHeader'
import {
  formatarNumero, porcentagem, produtosDeExemplo, proporcaoDoMinimo, quandoFoi, resumirEstoque,
} from './resumo'

// Tela inicial do cliente (/:slug): retrato do estoque a partir de `produtos`.
// `children` deixa um cliente ACRESCENTAR algo sem copiar a tela:
//   src/clientes/<slug>/paginas/DashboardPage.jsx → <Base>…</Base>

// Situação sempre com ícone + rótulo, nunca só cor.
const SITUACOES = {
  ok: { rotulo: 'Em dia', icone: CircleCheck, texto: 'text-ok', barra: 'bg-ok' },
  baixo: { rotulo: 'Baixo', icone: TriangleAlert, texto: 'text-warn', barra: 'bg-warn' },
  zerado: { rotulo: 'Zerado', icone: PackageX, texto: 'text-danger', barra: 'bg-danger' },
}

const LIMITE_REPOR = 6

export default function DashboardPage({ children }) {
  const { config } = useCliente()
  const { produtos, erro, carregando, recarregar } = useProdutos()

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader titulo="Dashboard" subtitulo={`Resumo do estoque de ${config.nome}`} />

      {!supabaseConfigurado && (
        <p className="mb-6 rounded-lg border border-borda bg-card px-3 py-2 text-sm text-texto-2">
          Dados de exemplo: o banco não está configurado (frontend/.env).
        </p>
      )}

      {erro ? <Erro recarregar={recarregar} />
        : carregando ? <Esqueleto />
          : produtos.length === 0 ? <Vazio />
            : <Painel resumo={resumirEstoque(produtos)} />}

      {children}
    </div>
  )
}

// ── Dados ─────────────────────────────────────────────────────────────────

function useProdutos() {
  const { cliente } = useCliente()
  const clienteId = cliente?.id ?? null
  const [versao, setVersao] = useState(0)
  const chave = `${clienteId}:${versao}`
  const [resultado, setResultado] = useState({ chave: null, produtos: [], erro: false })

  useEffect(() => {
    if (!supabaseConfigurado || !clienteId) return
    let cancelado = false
    // O RLS já limita aos produtos deste cliente; o filtro deixa explícito.
    supabase
      .from('produtos')
      .select('id, nome, quantidade, estoque_minimo, criado_em')
      .eq('cliente_id', clienteId)
      .then(({ data, error }) => {
        if (!cancelado) setResultado({ chave, produtos: data ?? [], erro: Boolean(error) })
      })
    return () => { cancelado = true }
  }, [clienteId, chave])

  const recarregar = () => setVersao((v) => v + 1)

  if (!supabaseConfigurado) return { produtos: produtosDeExemplo(), erro: false, carregando: false, recarregar }
  return {
    produtos: resultado.produtos,
    erro: resultado.chave === chave && resultado.erro,
    carregando: resultado.chave !== chave,
    recarregar,
  }
}

// ── Painel ────────────────────────────────────────────────────────────────

function Painel({ resumo }) {
  const { total, unidades, contagem, repor, recentes } = resumo

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Indicador rotulo="Produtos" valor={formatarNumero(total)} icone={Package}
          detalhe={`${formatarNumero(contagem.ok)} em dia`} />
        <Indicador rotulo="Unidades em estoque" valor={formatarNumero(unidades)} icone={Boxes}
          detalhe="somando todos os produtos" />
        <Indicador rotulo="Estoque baixo" valor={formatarNumero(contagem.baixo)} situacao="baixo"
          detalhe="no mínimo ou abaixo" />
        <Indicador rotulo="Sem estoque" valor={formatarNumero(contagem.zerado)} situacao="zerado"
          detalhe="nenhuma unidade" />
      </div>

      <SaudeDoEstoque contagem={contagem} total={total} />

      <div className="grid gap-4 lg:grid-cols-5">
        <Cartao titulo="Precisa repor" className="lg:col-span-3"
          extra={repor.length > 0 && <span className="text-xs text-texto-3">{repor.length} produto{repor.length > 1 ? 's' : ''}</span>}>
          {repor.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-sm text-texto-2">
              <CircleCheck size={18} className="text-ok" /> Tudo em dia: nenhum produto no mínimo ou zerado.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-borda">
                {repor.slice(0, LIMITE_REPOR).map((p) => <LinhaRepor key={p.id} produto={p} />)}
              </ul>
              {repor.length > LIMITE_REPOR && (
                <p className="pt-3 text-xs text-texto-3">e mais {repor.length - LIMITE_REPOR}</p>
              )}
            </>
          )}
        </Cartao>

        <Cartao titulo="Últimos cadastrados" className="lg:col-span-2">
          <ul className="divide-y divide-borda">
            {recentes.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.nome}</span>
                  <span className="block text-xs text-texto-3 tabular-nums">{formatarNumero(p.quantidade)} un.</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-texto-3">
                  <Clock size={12} aria-hidden /> {quandoFoi(p.criado_em)}
                </span>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>
    </div>
  )
}

function Indicador({ rotulo, valor, detalhe, icone, situacao }) {
  const s = situacao ? SITUACOES[situacao] : null
  const Icone = s?.icone ?? icone
  return (
    <div className="rounded-xl border border-borda bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-texto-2">{rotulo}</p>
        <Icone size={18} aria-hidden className={s?.texto ?? 'text-texto-3'} />
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">{valor}</p>
      <p className="mt-1 text-xs text-texto-3">{detalhe}</p>
    </div>
  )
}

// Barra de partes: em dia × baixo × zerado. Cada parte tem rótulo e número na
// legenda; a cor só reforça.
function SaudeDoEstoque({ contagem, total }) {
  const partes = ['ok', 'baixo', 'zerado'].filter((k) => contagem[k] > 0)
  return (
    <Cartao titulo="Saúde do estoque">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img"
        aria-label={partes.map((k) => `${SITUACOES[k].rotulo}: ${contagem[k]}`).join(', ')}>
        {partes.map((k) => (
          <div key={k} title={`${SITUACOES[k].rotulo}: ${contagem[k]} (${porcentagem(contagem[k], total)}%)`}
            className={`${SITUACOES[k].barra} transition-[flex-grow] duration-500 first:rounded-l-full last:rounded-r-full`}
            style={{ flexGrow: contagem[k], flexBasis: 0, minWidth: 6 }} />
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {['ok', 'baixo', 'zerado'].map((k) => {
          const { rotulo, icone: Icone, texto } = SITUACOES[k]
          return (
            <li key={k} className="flex items-center gap-2">
              <Icone size={16} aria-hidden className={texto} />
              <span className="text-texto-2">{rotulo}</span>
              <span className="font-semibold tabular-nums">{formatarNumero(contagem[k])}</span>
              <span className="text-texto-3 tabular-nums">({porcentagem(contagem[k], total)}%)</span>
            </li>
          )
        })}
      </ul>
    </Cartao>
  )
}

function LinhaRepor({ produto: p }) {
  const s = SITUACOES[p.situacao]
  const temMinimo = p.estoque_minimo != null
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{p.nome}</span>
        {temMinimo && (
          <span className="mt-1.5 block h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-elevado" aria-hidden>
            <span className={`block h-full rounded-full ${s.barra}`}
              style={{ width: p.situacao === 'zerado' ? 0 : `${Math.max(4, proporcaoDoMinimo(p) * 100)}%` }} />
          </span>
        )}
      </span>
      <span className="shrink-0 text-right text-sm tabular-nums">
        <span className="font-semibold">{formatarNumero(p.quantidade)}</span>
        {temMinimo && <span className="text-texto-3"> / mín. {formatarNumero(p.estoque_minimo)}</span>}
      </span>
      <span className={`flex w-20 shrink-0 items-center justify-end gap-1 text-xs font-medium ${s.texto}`}>
        <s.icone size={14} aria-hidden /> {s.rotulo}
      </span>
    </li>
  )
}

// ── Peças ─────────────────────────────────────────────────────────────────

function Cartao({ titulo, extra, className = '', children }) {
  return (
    <section className={`rounded-xl border border-borda bg-card p-4 md:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  )
}

function Vazio() {
  return (
    <div className="rounded-xl border border-dashed border-borda-forte bg-card px-6 py-14 text-center">
      <PackageOpen size={40} className="mx-auto text-texto-3" aria-hidden />
      <h2 className="mt-4 text-lg font-semibold">Nenhum produto cadastrado ainda</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-texto-2">
        Quando houver produtos, aqui aparecem o total em estoque, o que está acabando e os últimos cadastrados.
      </p>
    </div>
  )
}

function Erro({ recarregar }) {
  return (
    <div className="rounded-xl border border-danger/40 bg-danger/10 px-6 py-10 text-center">
      <p className="text-sm text-texto">Não foi possível carregar os produtos.</p>
      <button onClick={recarregar}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-borda-forte px-4 py-2 text-sm font-medium transition hover:bg-elevado">
        <RefreshCw size={14} /> Tentar de novo
      </button>
    </div>
  )
}

function Esqueleto() {
  const bloco = 'animate-pulse rounded-xl border border-borda bg-card'
  return (
    <div className="space-y-4" aria-label="Carregando" aria-busy>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className={`${bloco} h-32`} />)}
      </div>
      <div className={`${bloco} h-28`} />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className={`${bloco} h-72 lg:col-span-3`} />
        <div className={`${bloco} h-72 lg:col-span-2`} />
      </div>
    </div>
  )
}
