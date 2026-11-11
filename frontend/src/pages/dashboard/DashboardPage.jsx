import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote, Boxes, CircleCheck, Package, PackagePlus, PackageX,
  RefreshCw, ShoppingCart, Shirt, TrendingUp, TriangleAlert,
} from 'lucide-react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { useCliente } from '@/context/useCliente'
import { useProdutos } from '@/hooks/useProdutos'
import { dinheiro, inicioDeHoje } from '@/lib/formato'
import {
  COR_SEM_VENDEDOR, corDoVendedor, proximoDia, totaisDasVendas, useVendasDoDia, useVendedores,
} from '@/pages/vendas/dados'
import SeletorDeDia from '@/components/ui/SeletorDeDia'
import PainelVendedores from './GraficoVendedores'
import {
  formatarNumero, porcentagem, produtosDeExemplo, resumirEstoque, vendasRecentesDeExemplo,
} from './resumo'

// Tela inicial do cliente (/:slug): vendas de hoje em cima, estoque embaixo.
// `children` deixa um cliente ACRESCENTAR algo sem copiar a tela:
//   src/clientes/<slug>/paginas/DashboardPage.jsx → <Base>…</Base>

// Situação sempre com ícone + rótulo, nunca só cor.
const SITUACOES = {
  ok: { rotulo: 'Em dia', icone: CircleCheck, texto: 'text-ok', barra: 'bg-ok', chip: 'bg-ok/12 text-ok' },
  baixo: { rotulo: 'Baixo', icone: TriangleAlert, texto: 'text-warn', barra: 'bg-warn', chip: 'bg-warn/12 text-warn' },
  zerado: { rotulo: 'Zerado', icone: PackageX, texto: 'text-danger', barra: 'bg-danger', chip: 'bg-danger/12 text-danger' },
}

const LIMITE_REPOR = 7
const DIAS_GIRO = 30 // "vende" = saiu nos últimos 30 dias

export default function DashboardPage({ children }) {
  const { slug } = useCliente()
  const { produtos, erro, carregando, recarregar } = useProdutosDoPainel()
  const hoje = inicioDeHoje().getTime()
  const [dia, setDia] = useState(hoje)
  // Passou da meia-noite com a tela aberta em "hoje": acompanha o dia novo.
  const diaEfetivo = dia > hoje ? hoje : dia

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <Cabecalho slug={slug} dia={diaEfetivo} hoje={hoje} setDia={setDia} />

      {!supabaseConfigurado && (
        <p className="rounded-xl border border-borda bg-card px-4 py-3 text-sm text-texto-2">
          Dados de exemplo: o banco não está configurado (frontend/.env).
        </p>
      )}

      <VendasDoDia dia={diaEfetivo} ehHoje={diaEfetivo === hoje} />

      <section>
        <TituloSecao titulo="Estoque" acao={<Link to={`/${slug}/produtos`} className="text-sm font-medium text-acento hover:underline">Ver produtos</Link>} />
        {erro ? <Erro recarregar={recarregar} />
          : carregando ? <Esqueleto />
            : produtos.length === 0 ? <Vazio slug={slug} />
              : <Painel resumo={resumirEstoque(produtos)} slug={slug} />}
      </section>

      {children}
    </div>
  )
}

function Cabecalho({ slug, dia, hoje, setDia }) {
  const ehHoje = dia === hoje
  const ontem = proximoDia(hoje, -1)
  const titulo = ehHoje ? 'Resumo de hoje' : dia === ontem ? 'Resumo de ontem' : 'Resumo do dia'
  const data = new Date(dia).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm text-texto-3 first-letter:uppercase">{data}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{titulo}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SeletorDeDia dia={dia} hoje={hoje} setDia={setDia} />
        <Link to={`/${slug}/vendas`}
          className="flex items-center gap-2 rounded-xl bg-acento px-4 py-2.5 font-semibold text-sobre-acento shadow-lg shadow-acento/15 transition hover:brightness-110">
          <ShoppingCart size={18} /> Nova venda
        </Link>
      </div>
    </header>
  )
}

function TituloSecao({ titulo, acao }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
      {acao}
    </div>
  )
}

// Cartão de número: ícone em chip, rótulo, valor grande e uma linha de apoio.
function CartaoNumero({ rotulo, valor, unidade, detalhe, icone: Icone, chip = 'bg-acento/12 text-acento', destaque = false, className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 ${
      destaque ? 'border-acento/40 bg-gradient-to-br from-acento/15 via-card to-card' : 'border-borda bg-card'
    } ${className}`}>
      {destaque && <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-acento/15 blur-2xl" />}
      <div className="relative flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${destaque ? 'bg-acento text-sobre-acento' : chip}`}>
          <Icone size={20} aria-hidden />
        </span>
        <p className="text-sm font-medium text-texto-2">{rotulo}</p>
      </div>
      <p className="relative mt-4 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl lg:text-[2rem]">
        {valor}
        {unidade && <span className="ml-1.5 text-base font-medium tracking-normal text-texto-3">{unidade}</span>}
      </p>
      {detalhe && <div className="relative mt-1 text-xs text-texto-3">{detalhe}</div>}
    </div>
  )
}

// ── Vendas do dia ─────────────────────────────────────────────────────────
// Um dia por vez: o mês fica na tela Financeiro (pages/financeiro). Hoje relê a
// cada 30 s e ao voltar para a aba, para o dashboard no balcão acompanhar.

function VendasDoDia({ dia, ehHoje }) {
  const { cliente, slug, ehDono } = useCliente()
  const { vendas, carregando } = useVendasDoDia(cliente?.id, dia, { atualizarACada: ehHoje ? 30_000 : undefined })
  const { vendedores } = useVendedores(cliente?.id)
  const relogio = useAgora(60_000)
  // Dia passado: o eixo do gráfico vai até as 18h ou até a última venda.
  const ultima = vendas.length ? new Date(vendas.at(-1).vendido_em).getTime() : 0
  const agora = ehHoje ? relogio : Math.max(ultima + 30 * 60_000, new Date(dia).setHours(18, 0, 0, 0))
  const t = totaisDasVendas(vendas)
  const margem = t.valor > 0 && t.semCusto < t.linhas ? Math.round((t.lucro / t.valor) * 100) : null

  if (carregando) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className={`h-36 animate-pulse rounded-2xl border border-borda bg-card ${i === 2 ? 'col-span-2 lg:col-span-1' : ''}`} />)}
        </div>
        <div className="h-80 animate-pulse rounded-2xl border border-borda bg-card" />
      </div>
    )
  }

  const temVendedores = vendedores.length > 0 || vendas.some((v) => v.vendedor_id)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <CartaoNumero rotulo="Peças vendidas" valor={formatarNumero(t.pecas)} icone={Shirt}
          unidade={Number(t.pecas) === 1 ? 'peça' : 'peças'}
          detalhe={<PecasPorVendedor vendas={vendas} vendedores={vendedores} total={t.pecas} />} />
        <CartaoNumero rotulo="Valor vendido" valor={dinheiro(t.valor)} icone={Banknote}
          detalhe={t.vendas ? `ticket médio ${dinheiro(t.valor / t.vendas)}` : ehHoje ? 'nenhuma venda ainda' : 'nenhuma venda no dia'} />
        <CartaoNumero rotulo="Lucro" valor={dinheiro(t.lucro)} icone={TrendingUp} destaque className="col-span-2 lg:col-span-1"
          detalhe={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {margem !== null ? <span>margem de <strong className="text-texto-2">{margem}%</strong></span> : <span>valor vendido menos o custo</span>}
              {t.semCusto > 0 && (
                <span className="flex items-center gap-1 text-warn">
                  <TriangleAlert size={12} aria-hidden /> {t.semCusto} sem custo cadastrado
                </span>
              )}
            </span>
          } />
      </div>

      {temVendedores ? (
        <PainelVendedores vendas={vendas} vendedores={vendedores} agora={agora} ehHoje={ehHoje} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-borda bg-card p-5">
          <div>
            <p className="font-semibold">Acompanhe cada vendedor</p>
            <p className="mt-1 text-sm text-texto-3">Cadastre a equipe e o gráfico mostra quanto cada um vendeu no dia.</p>
          </div>
          {ehDono && (
            <Link to={`/${slug}/configuracoes`} className="rounded-xl border border-borda-forte px-4 py-2 text-sm font-medium hover:bg-elevado">
              Cadastrar vendedores
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// Peças de cada vendedor no dia: barra dividida nas cores do gráfico e, embaixo,
// o número de cada um (a cor só reforça; o nome está escrito).
function PecasPorVendedor({ vendas, vendedores, total }) {
  if (!total) return <span>nenhuma peça vendida ainda</span>
  const porVendedor = new Map()
  for (const v of vendas) {
    const chave = v.vendedor_id ?? 'sem'
    const atual = porVendedor.get(chave) ?? {
      nome: v.vendedor_nome ?? 'Sem vendedor',
      cor: v.vendedor_id ? corDoVendedor(vendedores, v.vendedor_id) : COR_SEM_VENDEDOR,
      pecas: 0,
    }
    atual.pecas += Number(v.quantidade)
    porVendedor.set(chave, atual)
  }
  // Ordem do cadastro (= ordem das cores), igual à legenda do gráfico.
  const ordem = (id) => (id === 'sem' ? Infinity : vendedores.findIndex((v) => v.id === id))
  const partes = [...porVendedor.entries()].sort(([a], [b]) => ordem(a) - ordem(b)).map(([, p]) => p)

  return (
    <div className="mt-2">
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" role="img"
        aria-label={partes.map((p) => `${p.nome}: ${formatarNumero(p.pecas)}`).join(', ')}>
        {partes.map((p) => (
          <span key={p.nome} className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ flexGrow: p.pecas, flexBasis: 0, background: p.cor }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {partes.map((p) => (
          <li key={p.nome} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.cor }} aria-hidden />
            <span className="max-w-20 truncate">{p.nome}</span>
            <strong className="font-semibold text-texto-2 tabular-nums">{formatarNumero(p.pecas)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Relógio que anda sozinho (o eixo do gráfico vai até "agora").
function useAgora(intervalo) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervalo)
    return () => clearInterval(t)
  }, [intervalo])
  return agora
}

// ── Estoque: dados ────────────────────────────────────────────────────────

// Lista guardada no navegador (a mesma de Produtos/Vendas): abre na hora.
function useProdutosDoPainel() {
  const { cliente } = useCliente()
  const p = useProdutos(cliente?.id ?? null)
  if (!supabaseConfigurado) return { produtos: produtosDeExemplo(), erro: false, carregando: false, recarregar: () => {} }
  return { ...p, produtos: p.produtos ?? [] }
}

// ── Estoque: painel ───────────────────────────────────────────────────────

function Painel({ resumo, slug }) {
  const { total, unidades, contagem, repor } = resumo
  const { cliente } = useCliente()
  const recentes = useVendasRecentes(cliente?.id)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CartaoNumero rotulo="Produtos" valor={formatarNumero(total)} icone={Package}
          detalhe={`${formatarNumero(contagem.ok)} em dia`} />
        <CartaoNumero rotulo="Peças em estoque" valor={formatarNumero(unidades)} icone={Boxes}
          detalhe="somando todos os produtos" />
        <CartaoNumero rotulo="Estoque baixo" valor={formatarNumero(contagem.baixo)} icone={TriangleAlert}
          chip={SITUACOES.baixo.chip} detalhe="no mínimo ou abaixo" />
        <CartaoNumero rotulo="Sem estoque" valor={formatarNumero(contagem.zerado)} icone={PackageX}
          chip={SITUACOES.zerado.chip} detalhe="nenhuma peça" />
      </div>

      <SaudeDoEstoque contagem={contagem} total={total} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <PrecisaRepor repor={repor} contagem={contagem} giro={recentes.giro} carregando={recentes.carregando} slug={slug}
          className="min-w-0" />
        <MaisVendidos linhas={recentes.linhas} carregando={recentes.carregando} produtos={resumo.porId}
          className="min-w-0" />
      </div>
    </div>
  )
}

// Barra de partes + três quadros (em dia, baixo, zerado). A cor só reforça:
// cada parte tem ícone, rótulo e número.
function SaudeDoEstoque({ contagem, total }) {
  const partes = ['ok', 'baixo', 'zerado'].filter((k) => contagem[k] > 0)
  return (
    <Cartao titulo="Saúde do estoque" extra={<span className="text-xs text-texto-3">{formatarNumero(total)} produtos</span>}>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img"
        aria-label={partes.map((k) => `${SITUACOES[k].rotulo}: ${contagem[k]}`).join(', ')}>
        {partes.map((k) => (
          <div key={k} title={`${SITUACOES[k].rotulo}: ${contagem[k]} (${porcentagem(contagem[k], total)}%)`}
            className={`${SITUACOES[k].barra} transition-[flex-grow] duration-500 first:rounded-l-full last:rounded-r-full`}
            style={{ flexGrow: contagem[k], flexBasis: 0, minWidth: 6 }} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {['ok', 'baixo', 'zerado'].map((k) => {
          const { rotulo, icone: Icone, chip } = SITUACOES[k]
          return (
            <div key={k} className="flex items-center gap-2.5 rounded-xl border border-borda bg-fundo/40 p-2.5 sm:p-3">
              <span className={`hidden h-9 w-9 shrink-0 place-items-center rounded-lg sm:grid ${chip}`}><Icone size={17} aria-hidden /></span>
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate text-xs text-texto-3">
                  <Icone size={12} aria-hidden className={`sm:hidden ${SITUACOES[k].texto}`} /> {rotulo}
                </p>
                <p className="text-lg font-bold leading-tight tabular-nums">
                  {formatarNumero(contagem[k])}
                  <span className="ml-1 text-xs font-normal text-texto-3">{porcentagem(contagem[k], total)}%</span>
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </Cartao>
  )
}

// O que repor primeiro: o que está em falta E vende. Produto que saiu nos
// últimos 30 dias vem antes (quem vendeu mais, primeiro); o que não gira fica
// para o fim. Sem isso, centenas de zerados parados escondem o que importa.
function PrecisaRepor({ repor, contagem, giro, carregando, slug, className = '' }) {
  const [filtro, setFiltro] = useState('vende') // vende | zerado | baixo
  const vendeu = (p) => giro.get(p.id) ?? 0
  const vendem = repor.filter((p) => vendeu(p) > 0)
  // sort estável: dentro do mesmo giro, mantém a ordem de urgência do resumo.
  const lista = (filtro === 'vende' ? vendem : repor.filter((p) => p.situacao === filtro))
    .slice().sort((a, b) => vendeu(b) - vendeu(a))
  const filtros = [
    ['vende', 'Vendem', vendem.length],
    ['zerado', 'Zerados', contagem.zerado],
    ['baixo', 'Baixos', contagem.baixo],
  ]
  const resto = lista.length - LIMITE_REPOR
  const linkResto = filtro === 'vende' ? `/${slug}/produtos` : `/${slug}/produtos?filtro=${filtro}`
  const explicacao = {
    vende: `Em falta e com venda nos últimos ${DIAS_GIRO} dias: repor primeiro.`,
    zerado: 'Sem nenhuma peça. Os que mais vendem aparecem primeiro.',
    baixo: 'No estoque mínimo ou abaixo dele.',
  }[filtro]

  return (
    <Cartao titulo="Precisa repor" className={`flex flex-col ${className}`}
      extra={<Link to={`/${slug}/produtos?filtro=zerado`} className="text-xs font-medium text-acento hover:underline">Ver produtos</Link>}>
      {repor.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-ok/8 px-4 py-6">
          <CircleCheck size={22} className="shrink-0 text-ok" />
          <div>
            <p className="text-sm font-medium">Tudo em dia</p>
            <p className="text-xs text-texto-3">Nenhum produto no mínimo ou zerado.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {filtros.map(([chave, rotulo, n]) => (
              <button key={chave} type="button" onClick={() => setFiltro(chave)} aria-pressed={filtro === chave}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  filtro === chave ? 'border-acento bg-acento/12 text-texto' : 'border-borda-forte text-texto-2 hover:bg-elevado'}`}>
                {rotulo}
                <span className={`rounded-full px-1.5 tabular-nums ${filtro === chave ? 'bg-acento/20' : 'bg-elevado'}`}>
                  {chave === 'vende' && carregando ? '…' : formatarNumero(n)}
                </span>
              </button>
            ))}
          </div>
          <p className="mb-3 text-xs text-texto-3">{explicacao}</p>

          {carregando && filtro === 'vende' ? (
            <p className="py-6 text-sm text-texto-3">Carregando…</p>
          ) : lista.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-ok/8 px-4 py-5">
              <CircleCheck size={20} className="shrink-0 text-ok" />
              <p className="text-sm text-texto-2">
                {filtro === 'vende' ? `Nada do que vendeu nos últimos ${DIAS_GIRO} dias está em falta.` : 'Nenhum produto aqui.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda">
              {lista.slice(0, LIMITE_REPOR).map((p) => <LinhaRepor key={p.id} produto={p} vendeu={vendeu(p)} />)}
            </ul>
          )}
          {resto > 0 && (
            <Link to={linkResto} className="mt-3 self-start text-xs font-medium text-texto-3 hover:text-acento">
              e mais {formatarNumero(resto)}: ver em Produtos →
            </Link>
          )}
        </>
      )}
    </Cartao>
  )
}

// Uma linha compacta: situação (ícone + texto), nome, quanto vendeu e o estoque.
function LinhaRepor({ produto: p, vendeu }) {
  const s = SITUACOES[p.situacao]
  const temMinimo = p.estoque_minimo != null
  const faltam = temMinimo ? Math.max(0, Number(p.estoque_minimo) - Number(p.quantidade)) : 0
  return (
    <li className="flex items-center gap-3 bg-fundo/40 px-3 py-2.5">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${s.chip}`} title={s.rotulo}>
        <s.icone size={15} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug" title={p.nome}>{p.nome}</p>
        <p className="mt-0.5 text-xs text-texto-3">
          <span className={s.texto}>{s.rotulo}</span>
          {faltam > 0 && <> · faltam {formatarNumero(faltam)} p/ o mínimo</>}
          {vendeu > 0 && <> · <span className="text-texto-2">vendeu {formatarNumero(vendeu)} em {DIAS_GIRO} dias</span></>}
        </p>
      </div>
      <p className="shrink-0 text-right text-sm tabular-nums">
        <span className={`font-bold ${p.situacao === 'zerado' ? 'text-danger' : ''}`}>{formatarNumero(p.quantidade)}</span>
        {temMinimo && <span className="text-texto-3"> / {formatarNumero(p.estoque_minimo)}</span>}
      </p>
    </li>
  )
}

// Mais vendidos da semana (últimos 7 dias) ou do mês (do dia 1 até hoje):
// barras com o número escrito e, embaixo, quanto ainda tem no estoque (o
// campeão de vendas zerado salta aos olhos).
const LIMITE_MAIS_VENDIDOS = 6
const inicioDaSemana = () => proximoDia(inicioDeHoje().getTime(), -6)
const inicioDoMesAtual = () => { const d = inicioDeHoje(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime() }
const PERIODOS = {
  semana: { rotulo: 'Semana', explicacao: 'últimos 7 dias', desde: inicioDaSemana, vazio: 'Nenhuma venda nos últimos 7 dias.' },
  mes: {
    rotulo: 'Mês', desde: inicioDoMesAtual, vazio: 'Nenhuma venda neste mês ainda.',
    explicacao: new Date().toLocaleDateString('pt-BR', { month: 'long' }),
  },
}

function MaisVendidos({ linhas, carregando, produtos, className = '' }) {
  const [periodo, setPeriodo] = useState('semana')
  const p = PERIODOS[periodo]
  const desde = p.desde()
  const porProduto = new Map()
  for (const v of linhas) {
    if (new Date(v.vendido_em).getTime() < desde) continue
    const chave = v.produto_id ?? v.produto_nome
    const x = porProduto.get(chave) ?? { chave, produtoId: v.produto_id, nome: v.produto_nome, pecas: 0, valor: 0 }
    x.pecas += Number(v.quantidade)
    x.valor += Number(v.quantidade) * Number(v.preco_unitario)
    porProduto.set(chave, x)
  }
  const todos = [...porProduto.values()].sort((a, b) => b.pecas - a.pecas || b.valor - a.valor)
  const itens = todos.slice(0, LIMITE_MAIS_VENDIDOS)
  const maior = Math.max(1, ...itens.map((i) => i.pecas))
  const totalPecas = todos.reduce((t, i) => t + i.pecas, 0)

  return (
    <Cartao titulo="Mais vendidos" className={`flex flex-col ${className}`}
      extra={<span className="text-xs text-texto-3 first-letter:uppercase">{p.explicacao}</span>}>
      {/* Semana | Mês, acima da lista */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-borda bg-fundo/40 p-1" role="group" aria-label="Período">
        {Object.entries(PERIODOS).map(([chave, { rotulo }]) => (
          <button key={chave} type="button" onClick={() => setPeriodo(chave)} aria-pressed={periodo === chave}
            className={`rounded-lg py-1.5 text-sm font-medium transition ${
              periodo === chave ? 'bg-acento text-sobre-acento shadow-sm' : 'text-texto-2 hover:bg-elevado hover:text-texto'}`}>
            {rotulo}
          </button>
        ))}
      </div>

      {carregando ? (
        <p className="py-6 text-sm text-texto-3">Carregando…</p>
      ) : itens.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <ShoppingCart size={22} className="text-texto-3" aria-hidden />
          <p className="text-sm text-texto-3">{p.vazio}</p>
        </div>
      ) : (
        <>
          <ol className="divide-y divide-borda overflow-hidden rounded-xl border border-borda">
            {itens.map((i, n) => {
              const produto = i.produtoId ? produtos.get(i.produtoId) : null
              const s = produto ? SITUACOES[produto.situacao] : null
              return (
                <li key={i.chave} className="flex items-center gap-3 bg-fundo/40 px-3 py-2.5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums ${
                    n === 0 ? 'bg-acento text-sobre-acento' : 'bg-elevado text-texto-2'}`}>
                    {n + 1}º
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* Nome quebra em até 2 linhas em vez de cortar */}
                    <p className="line-clamp-2 text-sm font-medium leading-snug" title={i.nome}>{i.nome}</p>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-elevado" aria-hidden>
                      <div className="h-full rounded-full bg-acento transition-[width] duration-700" style={{ width: `${(i.pecas / maior) * 100}%` }} />
                    </div>
                    <p className={`mt-1 flex items-center gap-1 truncate text-xs ${s && produto.situacao !== 'ok' ? s.texto : 'text-texto-3'}`}>
                      {s ? (
                        <>
                          <s.icone size={12} aria-hidden className="shrink-0" />
                          {produto.situacao === 'zerado' ? 'Acabou no estoque' : `${formatarNumero(produto.quantidade)} no estoque`}
                        </>
                      ) : 'Produto removido'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <p><strong>{formatarNumero(i.pecas)}</strong> <span className="text-xs text-texto-3">peça{i.pecas === 1 ? '' : 's'}</span></p>
                    <p className="text-xs text-texto-3">{dinheiro(i.valor)}</p>
                  </div>
                </li>
              )
            })}
          </ol>
          <p className="mt-auto pt-4 text-xs text-texto-3">
            {formatarNumero(totalPecas)} peça{totalPecas === 1 ? '' : 's'} vendida{totalPecas === 1 ? '' : 's'} de {formatarNumero(todos.length)} produto{todos.length === 1 ? '' : 's'} diferente{todos.length === 1 ? '' : 's'}
          </p>
        </>
      )}
    </Cartao>
  )
}

// Vendas recentes, numa leitura só para os dois cartões. Desde o que vier
// antes: 30 dias atrás (giro do Precisa repor) ou o dia 1º do mês (Mês).
//   linhas: para o Mais vendidos filtrar semana ou mês;
//   giro:   produto_id → peças vendidas nos últimos 30 dias.
// Lê em páginas: um mês movimentado passa do limite de 1000 linhas.
function useVendasRecentes(clienteId) {
  const [estado, setEstado] = useState({ id: null, linhas: [] })
  useEffect(() => {
    if (!supabaseConfigurado || !clienteId) return
    let cancelado = false
    const desde = new Date(Math.min(inicioDoGiro(), inicioDoMesAtual())).toISOString()
    async function ler() {
      const todas = []
      for (let pagina = 0; pagina < 20; pagina++) {
        const { data, error } = await supabase.from('vendas')
          .select('produto_id, produto_nome, quantidade, preco_unitario, vendido_em')
          .eq('cliente_id', clienteId).gte('vendido_em', desde)
          .order('vendido_em').order('id').range(pagina * 1000, pagina * 1000 + 999)
        if (error || !data) break
        todas.push(...data)
        if (data.length < 1000) break
      }
      if (!cancelado) setEstado({ id: clienteId, linhas: todas })
    }
    ler()
    return () => { cancelado = true }
  }, [clienteId])

  const linhas = !supabaseConfigurado ? vendasRecentesDeExemplo()
    : estado.id === clienteId ? estado.linhas : []
  const giroDesde = inicioDoGiro()
  const giro = new Map()
  for (const v of linhas) {
    if (!v.produto_id || new Date(v.vendido_em).getTime() < giroDesde) continue
    giro.set(v.produto_id, (giro.get(v.produto_id) ?? 0) + Number(v.quantidade))
  }
  return { linhas, giro, carregando: supabaseConfigurado && estado.id !== clienteId }
}

const inicioDoGiro = () => proximoDia(inicioDeHoje().getTime(), -(DIAS_GIRO - 1))

// ── Peças ─────────────────────────────────────────────────────────────────

function Cartao({ titulo, extra, className = '', children }) {
  return (
    <section className={`rounded-2xl border border-borda bg-card p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{titulo}</h3>
        {extra}
      </div>
      {children}
    </section>
  )
}

function Vazio({ slug }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-borda bg-card p-5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-acento/12 text-acento">
        <PackagePlus size={22} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Nenhum produto cadastrado ainda</p>
        <p className="mt-0.5 text-sm text-texto-3">Cadastre as peças para ver o total em estoque e o que está acabando.</p>
      </div>
      <Link to={`/${slug}/produtos`}
        className="rounded-xl bg-acento px-4 py-2 text-sm font-semibold text-sobre-acento transition hover:brightness-110">
        Cadastrar produtos
      </Link>
    </div>
  )
}

function Erro({ recarregar }) {
  return (
    <div className="rounded-2xl border border-danger/40 bg-danger/10 px-6 py-10 text-center">
      <p className="text-sm text-texto">Não foi possível carregar os produtos.</p>
      <button onClick={recarregar}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-borda-forte px-4 py-2 text-sm font-medium transition hover:bg-elevado">
        <RefreshCw size={14} /> Tentar de novo
      </button>
    </div>
  )
}

function Esqueleto() {
  const bloco = 'animate-pulse rounded-2xl border border-borda bg-card'
  return (
    <div className="space-y-4" aria-label="Carregando" aria-busy>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className={`${bloco} h-36`} />)}
      </div>
      <div className={`${bloco} h-28`} />
    </div>
  )
}
