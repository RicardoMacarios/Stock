import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote, Boxes, CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Package, PackagePlus, PackageX,
  RefreshCw, ShoppingCart, Shirt, TrendingUp, TriangleAlert,
} from 'lucide-react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { useCliente } from '@/context/useCliente'
import { dinheiro, inicioDeHoje } from '@/lib/formato'
import {
  COR_SEM_VENDEDOR, corDoVendedor, proximoDia, totaisDasVendas, useVendasDoDia, useVendedores,
} from '@/pages/vendas/dados'
import PainelVendedores from './GraficoVendedores'
import {
  formatarNumero, porcentagem, produtosDeExemplo, proporcaoDoMinimo, resumirEstoque,
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

const LIMITE_REPOR = 6

export default function DashboardPage({ children }) {
  const { slug } = useCliente()
  const { produtos, erro, carregando, recarregar } = useProdutos()
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

// ‹ Hoje › com calendário no meio. Não deixa ir para o futuro.
function SeletorDeDia({ dia, hoje, setDia }) {
  const ehHoje = dia === hoje
  const rotulo = ehHoje ? 'Hoje' : dia === proximoDia(hoje, -1) ? 'Ontem'
    : new Date(dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const paraCampo = (ms) => {
    const d = new Date(ms)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const botao = 'grid h-10 w-10 place-items-center text-texto-2 transition hover:bg-elevado hover:text-texto disabled:opacity-30 disabled:hover:bg-transparent'

  return (
    <div className="flex items-center overflow-hidden rounded-xl border border-borda-forte bg-card">
      <button type="button" onClick={() => setDia(proximoDia(dia, -1))} aria-label="Dia anterior" className={botao}>
        <ChevronLeft size={18} />
      </button>
      <label className="relative flex h-10 min-w-24 cursor-pointer items-center justify-center gap-2 border-x border-borda px-3 text-sm font-semibold hover:bg-elevado">
        <CalendarDays size={16} className="text-acento" aria-hidden />
        {rotulo}
        {/* Calendário nativo por cima, invisível: abre ao clicar no rótulo. */}
        <input type="date" aria-label="Escolher dia" max={paraCampo(hoje)} value={paraCampo(dia)}
          onChange={(e) => {
            if (!e.target.value) return
            const [a, m, d] = e.target.value.split('-').map(Number)
            setDia(Math.min(new Date(a, m - 1, d).getTime(), hoje))
          }}
          onClick={(e) => e.currentTarget.showPicker?.()}
          className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <button type="button" onClick={() => setDia(proximoDia(dia))} disabled={ehHoje} aria-label="Próximo dia" className={botao}>
        <ChevronRight size={18} />
      </button>
    </div>
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

// ── Estoque: painel ───────────────────────────────────────────────────────

function Painel({ resumo, slug }) {
  const { total, unidades, contagem, repor } = resumo
  const { cliente } = useCliente()
  const maisVendidos = useMaisVendidos(cliente?.id)

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Cartao titulo="Precisa repor" className="min-w-0 lg:col-span-3"
          extra={<Link to={`/${slug}/produtos`} className="text-xs font-medium text-acento hover:underline">Ver produtos</Link>}>
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
              <ul className="space-y-2">
                {repor.slice(0, LIMITE_REPOR).map((p) => <LinhaRepor key={p.id} produto={p} />)}
              </ul>
              {repor.length > LIMITE_REPOR && (
                <p className="pt-3 text-xs text-texto-3">e mais {repor.length - LIMITE_REPOR} em Produtos → filtro Baixo/Zerado</p>
              )}
            </>
          )}
        </Cartao>

        <MaisVendidos {...maisVendidos} className="min-w-0 lg:col-span-2" />
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

function LinhaRepor({ produto: p }) {
  const s = SITUACOES[p.situacao]
  const temMinimo = p.estoque_minimo != null
  const faltam = temMinimo ? Math.max(0, Number(p.estoque_minimo) - Number(p.quantidade)) : 0
  return (
    <li className="flex items-center gap-3 rounded-xl border border-borda bg-fundo/40 p-3">
      <span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-bold ${s.chip}`}>
        {p.nome.trim().split(/\s+/).slice(0, 2).map((x) => x.charAt(0)).join('').toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium">{p.nome}</p>
          <p className="shrink-0 text-sm tabular-nums">
            <span className="font-bold">{formatarNumero(p.quantidade)}</span>
            {temMinimo && <span className="text-texto-3"> / {formatarNumero(p.estoque_minimo)}</span>}
          </p>
        </div>
        {temMinimo && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevado" aria-hidden>
            <div className={`h-full rounded-full ${s.barra}`}
              style={{ width: p.situacao === 'zerado' ? 0 : `${Math.max(4, proporcaoDoMinimo(p) * 100)}%` }} />
          </div>
        )}
        <p className={`mt-1 flex items-center gap-1 text-xs ${s.texto}`}>
          <s.icone size={12} aria-hidden /> {s.rotulo}
          {faltam > 0 && <span className="text-texto-3">· faltam {formatarNumero(faltam)} para o mínimo</span>}
        </p>
      </div>
    </li>
  )
}

// Mais vendidos dos últimos 7 dias: barras horizontais (uma série, cor de
// acento), com o número escrito em cada uma.
function MaisVendidos({ itens, carregando, className = '' }) {
  const maior = Math.max(1, ...itens.map((i) => i.pecas))
  return (
    <Cartao titulo="Mais vendidos da semana" className={className}
      extra={<span className="text-xs text-texto-3">últimos 7 dias</span>}>
      {carregando ? (
        <p className="py-6 text-sm text-texto-3">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="py-6 text-center text-sm text-texto-3">Nenhuma venda nos últimos 7 dias.</p>
      ) : (
        <ol className="space-y-3">
          {itens.map((i, n) => (
            <li key={i.nome}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="w-4 shrink-0 text-xs text-texto-3 tabular-nums">{n + 1}º</span>
                  <span className="truncate font-medium">{i.nome}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <strong>{formatarNumero(i.pecas)}</strong> <span className="text-xs text-texto-3">peças</span>
                </span>
              </div>
              <div className="ml-6 mt-1 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-elevado" aria-hidden>
                  <div className="h-full rounded-full bg-acento transition-[width] duration-700" style={{ width: `${(i.pecas / maior) * 100}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right text-xs text-texto-3 tabular-nums">{dinheiro(i.valor)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Cartao>
  )
}

function useMaisVendidos(clienteId) {
  const [estado, setEstado] = useState({ id: null, itens: [] })
  useEffect(() => {
    if (!supabaseConfigurado || !clienteId) return
    let cancelado = false
    supabase.from('vendas').select('produto_nome, quantidade, preco_unitario')
      .eq('cliente_id', clienteId).gte('vendido_em', new Date(proximoDia(inicioDeHoje().getTime(), -6)).toISOString())
      .then(({ data }) => {
        if (cancelado) return
        const porNome = new Map()
        for (const v of data ?? []) {
          const x = porNome.get(v.produto_nome) ?? { nome: v.produto_nome, pecas: 0, valor: 0 }
          x.pecas += Number(v.quantidade)
          x.valor += Number(v.quantidade) * Number(v.preco_unitario)
          porNome.set(v.produto_nome, x)
        }
        setEstado({ id: clienteId, itens: [...porNome.values()].sort((a, b) => b.pecas - a.pecas || b.valor - a.valor).slice(0, 5) })
      })
    return () => { cancelado = true }
  }, [clienteId])
  if (!supabaseConfigurado) return { itens: [], carregando: false }
  return { itens: estado.id === clienteId ? estado.itens : [], carregando: estado.id !== clienteId }
}

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
