import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Banknote, Boxes, Camera, CircleCheck, Package, PackagePlus, PackageX, Pencil, Plus, QrCode, ScanBarcode, Trash2,
  TriangleAlert, X,
} from 'lucide-react'
import { useLeitorDeCodigo } from '@/hooks/useLeitorDeCodigo'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { useCliente } from '@/context/useCliente'
import { traduzirErro } from '@/lib/erros'
import { classeEntrada } from '@/lib/classes'
import { dinheiro, lerNumero, paraCampo, quantidade as fmtQtd } from '@/lib/formato'
import { situacao } from '@/pages/dashboard/resumo'
import { acharPorCodigo, buscarProdutos } from '@/lib/busca'
import { useProdutos } from '@/hooks/useProdutos'
import MaisAoRolar from '@/components/ui/MaisAoRolar'
import { categoriasDe, nomeCategoria, normalizarCategoria } from '@/lib/categorias'
import { gerarCodigoDaPeca } from '@/lib/qrcode'
import Etiquetas from '@/components/produtos/Etiquetas'

// /:slug/produtos — cadastrar, editar, dar entrada no estoque e apagar.
// Escrita direto na tabela: a policy produtos_do_cliente já limita ao cliente.
// `children` deixa um cliente acrescentar algo sem copiar a tela.

// Câmera só baixa a biblioteca de leitura (ZXing) quando abre.
const LeitorCamera = lazy(() => import('@/components/ui/LeitorCamera'))

const VAZIO = { nome: '', codigo: '', categoria: '', quantidade: '', estoque_minimo: '', preco_custo: '', preco_venda: '' }

// Situação sempre com ícone + rótulo, nunca só cor.
const SITUACAO = {
  ok: { rotulo: 'Em dia', icone: CircleCheck, selo: 'bg-ok/12 text-ok' },
  baixo: { rotulo: 'Baixo', icone: TriangleAlert, selo: 'bg-warn/12 text-warn' },
  zerado: { rotulo: 'Zerado', icone: PackageX, selo: 'bg-danger/12 text-danger' },
}

// Collator: bem mais rápido que localeCompare em listas de milhares.
const porNome = new Intl.Collator('pt-BR').compare

// Lista longa: desenha de tantos em tantos, conforme rola.
const POR_VEZ = 60

const ORDENS = {
  nome: { rotulo: 'Nome', comparar: (a, b) => porNome(a.nome, b.nome) },
  estoque: { rotulo: 'Menor estoque', comparar: (a, b) => Number(a.quantidade) - Number(b.quantidade) },
  recentes: { rotulo: 'Mais recentes', comparar: (a, b) => new Date(b.criado_em) - new Date(a.criado_em) },
}

export default function ProdutosPage({ children }) {
  const { cliente } = useCliente()
  const clienteId = cliente?.id
  // Lista guardada no navegador: abre na hora e busca só o que mudou.
  const { produtos: guardados, recarregar: carregar } = useProdutos(clienteId)
  const produtos = useMemo(() => guardados && guardados.map((p) => ({ ...p, situacao: situacao(p) })), [guardados])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos') // todos | baixo | zerado
  const [categoria, setCategoria] = useState('') // '' = todas
  const [ordem, setOrdem] = useState('nome')
  const [camera, setCamera] = useState(false)
  // null | { produto: null (novo) ou o produto, codigo: código bipado para o novo }
  const [editando, setEditando] = useState(null)
  const [etiqueta, setEtiqueta] = useState(null) // produto cuja etiqueta está aberta

  // Bipou: peça cadastrada → mostra; nova → abre o cadastro com o código
  // preenchido (cadastrar a coleção é bipar e completar).
  function bipou(codigo) {
    const p = acharPorCodigo(produtos, codigo)
    if (p) { setFiltro('todos'); setBusca(codigo.trim()) } else setEditando({ produto: null, codigo })
  }
  useLeitorDeCodigo(bipou, { ativo: !editando && !camera })

  const contagem = useMemo(() => {
    const c = { todos: 0, baixo: 0, zerado: 0, pecas: 0, valor: 0 }
    for (const p of produtos ?? []) {
      c.todos += 1
      if (p.situacao !== 'ok') c[p.situacao] += 1
      const qtd = Math.max(0, Number(p.quantidade))
      c.pecas += qtd
      c.valor += qtd * Number(p.preco_venda ?? 0)
    }
    return c
  }, [produtos])

  const lista = useMemo(() => {
    // Ordena antes e busca depois: com busca, o mais relevante (código exato)
    // sobe e o empate fica na ordem escolhida.
    const ordenados = (produtos ?? [])
      .filter((p) => (filtro === 'todos' || p.situacao === filtro) && (!categoria || p.categoria === categoria))
      .sort(ORDENS[ordem].comparar)
    return buscarProdutos(ordenados, busca)
  }, [produtos, busca, filtro, ordem, categoria])
  const categorias = useMemo(() => categoriasDe(produtos), [produtos])

  // Quantos desenhar. Mudou busca, filtro ou ordem: volta ao começo.
  const chaveLista = `${busca}|${filtro}|${ordem}|${categoria}`
  const [pagina, setPagina] = useState({ chave: chaveLista, n: POR_VEZ })
  const mostrar = pagina.chave === chaveLista ? pagina.n : POR_VEZ
  const mais = useCallback(() => setPagina((p) => ({ chave: chaveLista, n: (p.chave === chaveLista ? p.n : POR_VEZ) + POR_VEZ })), [chaveLista])

  if (!supabaseConfigurado) {
    return <p className="text-sm text-texto-3">Banco não configurado (frontend/.env).</p>
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Produtos</h1>
          <p className="mt-1 text-sm text-texto-3">Peças, preços e estoque. Bipe uma etiqueta nova para cadastrar.</p>
        </div>
        <button onClick={() => setEditando({ produto: null })}
          className="flex items-center gap-2 rounded-xl bg-acento px-4 py-2.5 font-semibold text-sobre-acento shadow-lg shadow-acento/15 transition hover:brightness-110">
          <Plus size={18} /> Novo produto
        </button>
      </header>

      {/* Números rápidos */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Numero icone={Package} rotulo="Produtos" valor={fmtQtd(contagem.todos)} />
        <Numero icone={Boxes} rotulo="Peças em estoque" valor={fmtQtd(contagem.pecas)} />
        <Numero icone={Banknote} rotulo="Estoque a preço de venda" valor={dinheiro(contagem.valor)} />
        <Numero icone={TriangleAlert} rotulo="Precisam repor" valor={fmtQtd(contagem.baixo + contagem.zerado)}
          chip={contagem.baixo + contagem.zerado ? 'bg-warn/12 text-warn' : undefined} />
      </div>

      <section className="rounded-2xl border border-borda bg-card">
        {/* Busca, filtros e ordem */}
        <div className="space-y-3 border-b border-borda p-4 md:p-5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanBarcode size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-acento" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome, parte do código ou bipar"
                aria-label="Buscar produto" className={`${classeEntrada} h-12 pl-11`} />
              {busca && (
                <button onClick={() => setBusca('')} aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-texto-3 hover:text-texto">
                  <X size={16} />
                </button>
              )}
            </div>
            <button type="button" onClick={() => setCamera(true)} aria-label="Ler código com a câmera" title="Ler com a câmera"
              className="flex h-12 shrink-0 items-center gap-2 rounded-xl border border-borda-forte px-3.5 text-sm font-medium text-texto-2 transition hover:border-acento hover:text-acento">
              <Camera size={20} /> <span className="hidden sm:inline">Câmera</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {[['todos', 'Todos'], ['baixo', 'Baixo'], ['zerado', 'Zerado']].map(([chave, rotulo]) => (
                <button key={chave} onClick={() => setFiltro(chave)} aria-pressed={filtro === chave}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    filtro === chave ? 'border-acento bg-acento/12 text-texto' : 'border-borda-forte text-texto-2 hover:bg-elevado'
                  }`}>
                  {rotulo}
                  <span className={`rounded-full px-1.5 tabular-nums ${filtro === chave ? 'bg-acento/20' : 'bg-elevado'}`}>{contagem[chave]}</span>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-texto-3">
              Ordenar
              <select value={ordem} onChange={(e) => setOrdem(e.target.value)}
                className="rounded-lg border border-borda-forte bg-fundo px-2 py-1.5 text-xs text-texto outline-none focus:border-acento">
                {Object.entries(ORDENS).map(([chave, o]) => <option key={chave} value={chave}>{o.rotulo}</option>)}
              </select>
            </label>
          </div>
          {categorias.length > 0 && (
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:-mx-5 md:px-5" role="group" aria-label="Filtrar por categoria">
              {[{ valor: '', rotulo: 'Todas as categorias', quantos: null }, ...categorias].map((c) => (
                <button key={c.valor || 'todas'} type="button" onClick={() => setCategoria(c.valor)} aria-pressed={categoria === c.valor}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    categoria === c.valor ? 'border-acento bg-acento/12 text-texto' : 'border-borda-forte text-texto-2 hover:bg-elevado'
                  }`}>
                  {c.rotulo}
                  {c.quantos !== null && (
                    <span className={`rounded-full px-1.5 tabular-nums ${categoria === c.valor ? 'bg-acento/20' : 'bg-elevado'}`}>{c.quantos}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lista */}
        {produtos === null ? (
          <p className="p-6 text-sm text-texto-3">Carregando…</p>
        ) : produtos.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-acento/12 text-acento">
              <PackagePlus size={26} aria-hidden />
            </span>
            <p className="mt-4 font-semibold">Nenhum produto ainda</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-texto-3">Bipe a etiqueta de uma peça ou clique em “Novo produto”.</p>
          </div>
        ) : lista.length === 0 ? (
          <p className="p-8 text-center text-sm text-texto-3">Nada encontrado com esse filtro.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {lista.slice(0, mostrar).map((p) => (
              <LinhaProduto key={p.id} produto={p} editar={() => setEditando({ produto: p })} mudou={carregar} />
            ))}
          </ul>
        )}
        {lista.length > 0 && (
          <MaisAoRolar mostrando={Math.min(mostrar, lista.length)} total={lista.length} mais={mais} />
        )}
      </section>

      {editando && (
        <PainelProduto key={editando.produto?.id ?? `novo:${editando.codigo ?? ''}`} produto={editando.produto}
          codigoInicial={editando.codigo} clienteId={clienteId} categorias={categorias}
          fechar={() => setEditando(null)}
          salvo={(salvoAgora, novo) => { setEditando(null); carregar(); if (novo && salvoAgora) setEtiqueta(salvoAgora) }}
          abrirEtiqueta={(p) => { setEditando(null); setEtiqueta(p) }} />
      )}

      {/* Peça nova já abre a etiqueta (QR Code + nome + valor) para imprimir */}
      {etiqueta && <Etiquetas produto={etiqueta} fechar={() => setEtiqueta(null)} mudou={carregar} />}

      {camera && (
        <Suspense fallback={null}>
          <LeitorCamera titulo="Ler código da etiqueta" fechar={() => setCamera(false)}
            aoLer={(texto) => { setCamera(false); bipou(texto) }} />
        </Suspense>
      )}
      {children}
    </div>
  )
}

function Numero({ icone: Icone, rotulo, valor, chip = 'bg-acento/12 text-acento' }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-borda bg-card p-4">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${chip}`}><Icone size={19} aria-hidden /></span>
      <div className="min-w-0">
        <p className="truncate text-xs text-texto-3">{rotulo}</p>
        <p className="truncate text-lg font-bold tabular-nums">{valor}</p>
      </div>
    </div>
  )
}

// ── Linha ─────────────────────────────────────────────────────────────────

function LinhaProduto({ produto: p, editar, mudou }) {
  const [entrada, setEntrada] = useState(null) // null | texto
  const s = SITUACAO[p.situacao]
  const custo = Number(p.preco_custo)
  const venda = Number(p.preco_venda)
  const margem = p.preco_custo != null && venda > 0 ? Math.round(((venda - custo) / venda) * 100) : null

  async function darEntrada(e) {
    e.preventDefault()
    const n = lerNumero(entrada)
    if (!n || n <= 0) return toast.error('Informe quantas peças entraram.')
    const { error } = await supabase.from('produtos').update({ quantidade: Number(p.quantidade) + n }).eq('id', p.id)
    if (error) return toast.error(traduzirErro(error))
    toast.success(`+${fmtQtd(n)} em ${p.nome}`)
    setEntrada(null)
    mudou()
  }

  return (
    <li className="px-4 py-3.5 transition hover:bg-elevado/30 md:px-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-elevado text-sm font-bold text-texto-2">
          {iniciais(p.nome)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{p.nome}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texto-3">
            {p.codigo_legado != null && <span className="rounded bg-elevado px-1.5 py-0.5 font-mono text-texto-2" title="Código antigo">#{p.codigo_legado}</span>}
            {p.categoria && <span className="rounded bg-acento/10 px-1.5 py-0.5 text-acento">{nomeCategoria(p.categoria)}</span>}
            {p.codigo && <span className="rounded bg-fundo px-1.5 py-0.5 font-mono">{p.codigo}</span>}
            <span>custo {p.preco_custo != null ? dinheiro(p.preco_custo) : '—'}</span>
            {margem !== null && <span className="text-texto-2">· margem {margem}%</span>}
          </div>
        </div>

        <div className="hidden w-28 text-right sm:block">
          <p className="font-semibold tabular-nums">{p.preco_venda != null ? dinheiro(p.preco_venda) : '—'}</p>
          <p className="text-xs text-texto-3">preço</p>
        </div>

        <div className="w-24 text-right">
          <p className="text-lg font-bold leading-tight tabular-nums">{fmtQtd(p.quantidade)}</p>
          <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.68rem] font-semibold ${s.selo}`}>
            <s.icone size={11} aria-hidden />
            {p.situacao === 'ok' && p.estoque_minimo != null ? `mín. ${fmtQtd(p.estoque_minimo)}` : s.rotulo}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setEntrada(entrada === null ? '' : null)} title="Dar entrada no estoque"
            className="flex items-center gap-1 rounded-lg border border-borda-forte px-2.5 py-1.5 text-xs font-medium text-texto-2 transition hover:border-acento hover:text-acento">
            <Plus size={14} /> <span className="hidden md:inline">Entrada</span>
          </button>
          <button type="button" onClick={editar} aria-label={`Editar ${p.nome}`} title="Editar"
            className="rounded-lg p-2 text-texto-3 transition hover:bg-elevado hover:text-texto">
            <Pencil size={15} />
          </button>
        </div>
      </div>

      {/* Preço no celular, onde a coluna some */}
      <p className="ml-14 mt-1 text-sm font-semibold tabular-nums sm:hidden">{p.preco_venda != null ? dinheiro(p.preco_venda) : 'sem preço'}</p>

      {entrada !== null && (
        <form onSubmit={darEntrada} className="surgir ml-14 mt-3 flex flex-wrap items-center gap-2">
          <input autoFocus inputMode="decimal" value={entrada} onChange={(e) => setEntrada(e.target.value)}
            placeholder="Quantas peças chegaram?" aria-label={`Entrada de ${p.nome}`}
            className={`${classeEntrada} max-w-56 py-2`} />
          <button className="rounded-xl bg-acento px-4 py-2 text-sm font-semibold text-sobre-acento">Somar ao estoque</button>
          <button type="button" onClick={() => setEntrada(null)} className="text-sm text-texto-3 hover:text-texto">Cancelar</button>
        </form>
      )}
    </li>
  )
}

// Lucro % sobre o custo ⇄ preço de venda.
const ATALHOS_LUCRO = [50, 100, 150, 200]

// Custo + % → venda no formato do campo ("100,00"). null se faltar algo.
function vendaComLucro(custoTexto, lucroTexto) {
  const custo = lerNumero(custoTexto)
  const pct = lerNumero(lucroTexto)
  if (custo === null || pct === null || Number.isNaN(custo) || Number.isNaN(pct) || custo < 0) return null
  return paraCampo(Math.round(custo * (100 + pct)) / 100)
}

// Custo e venda → % sobre o custo ("100" ou "37,5"). Vazio sem custo.
function lucroSobreCusto(custo, venda) {
  const c = Number(custo)
  if (custo === null || custo === undefined || venda === null || venda === undefined || !(c > 0) || Number.isNaN(Number(venda))) return ''
  const pct = Math.round(((Number(venda) - c) / c) * 1000) / 10
  return String(pct).replace('.', ',')
}

const iniciais = (nome) => nome.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase()

// ── Painel de cadastro/edição ─────────────────────────────────────────────
// Lateral no computador; folha que sobe no celular.

function PainelProduto({ produto, codigoInicial, clienteId, categorias = [], fechar, salvo, abrirEtiqueta }) {
  const [campos, setCampos] = useState(() => (produto
    ? {
        nome: produto.nome,
        codigo: produto.codigo ?? '',
        categoria: produto.categoria ? nomeCategoria(produto.categoria) : '',
        quantidade: String(produto.quantidade).replace('.', ','),
        estoque_minimo: produto.estoque_minimo == null ? '' : String(produto.estoque_minimo).replace('.', ','),
        preco_custo: paraCampo(produto.preco_custo),
        preco_venda: paraCampo(produto.preco_venda),
      }
    : { ...VAZIO, codigo: codigoInicial ?? '' }))
  const [salvando, setSalvando] = useState(false)
  const [camera, setCamera] = useState(false)
  const [apagando, setApagando] = useState(false)
  const mudar = (chave) => (e) => setCampos((c) => ({ ...c, [chave]: e.target.value }))

  // Lucro % sobre o custo (100% = custo 50 → venda 100). Os três campos
  // conversam: mudar o % ou o custo recalcula a venda; digitar a venda à mão
  // recalcula o %.
  const [lucro, setLucro] = useState(() => (produto ? lucroSobreCusto(produto.preco_custo, produto.preco_venda) : ''))
  function mudarLucro(texto) {
    setLucro(texto)
    const venda = vendaComLucro(campos.preco_custo, texto)
    if (venda !== null) setCampos((c) => ({ ...c, preco_venda: venda }))
  }
  function mudarCusto(e) {
    const custo = e.target.value
    const venda = vendaComLucro(custo, lucro)
    setCampos((c) => ({ ...c, preco_custo: custo, ...(venda !== null ? { preco_venda: venda } : {}) }))
  }
  function mudarVenda(e) {
    const venda = e.target.value
    setCampos((c) => ({ ...c, preco_venda: venda }))
    setLucro(lucroSobreCusto(lerNumero(campos.preco_custo), lerNumero(venda)))
  }

  const custo = lerNumero(campos.preco_custo)
  const venda = lerNumero(campos.preco_venda)
  const lucroPeca = custo >= 0 && venda > 0 && custo !== null ? venda - custo : null
  const margem = lucroPeca !== null ? Math.round((lucroPeca / venda) * 100) : null

  // Esc fecha.
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && !camera && fechar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [fechar, camera])

  async function salvar(e) {
    e.preventDefault()
    const valores = {
      nome: campos.nome.trim(),
      codigo: campos.codigo.trim() || null,
      categoria: normalizarCategoria(campos.categoria) || null,
      quantidade: lerNumero(campos.quantidade) ?? 0,
      estoque_minimo: lerNumero(campos.estoque_minimo),
      preco_custo: custo,
      preco_venda: venda,
    }
    if (!valores.nome) return toast.error('Informe o nome do produto.')
    if (Object.values(valores).some((v) => Number.isNaN(v))) return toast.error('Confira os números (use vírgula para centavos).')
    if (valores.quantidade < 0) return toast.error('A quantidade não pode ser negativa.')

    // Peça nova sem código do fornecedor: gera um, que vai no QR da etiqueta.
    const gerado = !produto && !valores.codigo
    if (gerado) valores.codigo = gerarCodigoDaPeca()

    setSalvando(true)
    const gravar = () => (produto
      ? supabase.from('produtos').update(valores).eq('id', produto.id)
      : supabase.from('produtos').insert({ ...valores, cliente_id: clienteId })
    ).select('id, nome, codigo, codigo_legado, quantidade, preco_venda').single()
    let { data, error } = await gravar()
    // Código gerado bateu com outro (raríssimo): tenta outro.
    if (error && gerado && String(error.message).includes('produtos_codigo_unico')) {
      valores.codigo = gerarCodigoDaPeca()
      ;({ data, error } = await gravar())
    }
    setSalvando(false)
    if (error) return toast.error(traduzirErro(error))
    toast.success(produto ? 'Produto atualizado.' : 'Produto cadastrado. Imprima a etiqueta.')
    salvo(data, !produto)
  }

  async function apagar() {
    const { error } = await supabase.from('produtos').delete().eq('id', produto.id)
    if (error) return toast.error(traduzirErro(error))
    toast.success('Produto apagado.')
    salvo()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/60 backdrop-blur-[2px] lg:items-stretch" onClick={fechar}>
      <form onSubmit={salvar} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        aria-label={produto ? 'Editar produto' : 'Novo produto'}
        className="surgir flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-borda bg-card lg:max-h-none lg:w-[30rem] lg:rounded-none lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between border-b border-borda px-5 py-4">
          <h2 className="text-lg font-semibold">{produto ? 'Editar produto' : 'Novo produto'}</h2>
          <button type="button" onClick={fechar} aria-label="Fechar" className="rounded-lg p-2 text-texto-3 hover:bg-elevado hover:text-texto">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
          <Rotulo texto="Nome">
            <input autoFocus required maxLength={120} value={campos.nome} onChange={mudar('nome')}
              placeholder="Ex.: Camiseta básica preta M" className={classeEntrada} />
          </Rotulo>

          <Rotulo texto="Categoria">
            <input list="categorias-da-loja" maxLength={60} value={campos.categoria} onChange={mudar('categoria')}
              placeholder="Ex.: Camiseta, Blusa, Bermuda" className={classeEntrada} />
            <datalist id="categorias-da-loja">
              {categorias.map((c) => <option key={c.valor} value={c.rotulo} />)}
            </datalist>
          </Rotulo>
          {categorias.length > 0 && (
            <div className="-mt-2 flex flex-wrap gap-1.5">
              {categorias.slice(0, 12).map((c) => {
                const ativa = normalizarCategoria(campos.categoria) === c.valor
                return (
                  <button key={c.valor} type="button" onClick={() => setCampos((x) => ({ ...x, categoria: ativa ? '' : c.rotulo }))}
                    aria-pressed={ativa}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      ativa ? 'border-acento bg-acento/10 font-semibold text-acento' : 'border-borda-forte text-texto-2 hover:border-acento hover:text-acento'
                    }`}>
                    {c.rotulo}
                  </button>
                )
              })}
            </div>
          )}

          <div>
            <label htmlFor="codigo" className="block text-sm font-medium text-texto-2">
              Código <span className="font-normal text-texto-3">(bipe a etiqueta; sem código, o sistema gera um)</span>
            </label>
            <div className="mt-1.5 flex gap-2">
              {/* Enter do leitor não envia o formulário: só preenche o código. */}
              <input id="codigo" maxLength={120} value={campos.codigo} onChange={mudar('codigo')}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                placeholder="Código de barras ou QR" className={`${classeEntrada} font-mono`} />
              <button type="button" onClick={() => setCamera(true)} aria-label="Ler código com a câmera" title="Ler com a câmera"
                className="grid w-12 shrink-0 place-items-center rounded-xl border border-borda-forte text-texto-2 transition hover:border-acento hover:text-acento">
                <Camera size={18} />
              </button>
            </div>
          </div>

          <fieldset className="rounded-2xl border border-borda p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-texto-3">Preço</legend>
            <div className="grid grid-cols-3 gap-3">
              <Rotulo texto="Custo (R$)">
                <input inputMode="decimal" value={campos.preco_custo} onChange={mudarCusto} placeholder="0,00" className={classeEntrada} />
              </Rotulo>
              <Rotulo texto="Lucro (%)">
                <input inputMode="decimal" value={lucro} onChange={(e) => mudarLucro(e.target.value)} placeholder="100"
                  aria-describedby="lucro-ajuda" className={classeEntrada} />
              </Rotulo>
              <Rotulo texto="Venda (R$)">
                <input inputMode="decimal" value={campos.preco_venda} onChange={mudarVenda} placeholder="0,00" className={classeEntrada} />
              </Rotulo>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {ATALHOS_LUCRO.map((n) => (
                <button key={n} type="button" onClick={() => mudarLucro(String(n))}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    lerNumero(lucro) === n ? 'border-acento bg-acento/10 font-semibold text-acento' : 'border-borda-forte text-texto-2 hover:border-acento hover:text-acento'
                  }`}>
                  {n}%
                </button>
              ))}
            </div>
            <p id="lucro-ajuda" className="mt-3 text-sm text-texto-3">
              {margem !== null
                ? <>Lucro por peça <strong className="text-texto">{dinheiro(lucroPeca)}</strong> · margem de <strong className={margem >= 0 ? 'text-ok' : 'text-danger'}>{margem}%</strong> da venda</>
                : 'Informe o custo e o lucro % (a venda é calculada) ou digite a venda à mão.'}
            </p>
          </fieldset>

          <fieldset className="rounded-2xl border border-borda p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-texto-3">Estoque</legend>
            <div className="grid grid-cols-2 gap-3">
              <Rotulo texto="Quantidade">
                <input inputMode="decimal" value={campos.quantidade} onChange={mudar('quantidade')} placeholder="0" className={classeEntrada} />
              </Rotulo>
              <Rotulo texto="Mínimo" dica="avisa">
                <input inputMode="decimal" value={campos.estoque_minimo} onChange={mudar('estoque_minimo')} placeholder="opcional" className={classeEntrada} />
              </Rotulo>
            </div>
          </fieldset>

          {produto && (
            apagando ? (
              <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm">
                <p className="text-danger">Apagar “{produto.nome}”? As vendas dele continuam no histórico.</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={apagar} className="rounded-lg bg-danger px-3 py-1.5 font-semibold text-fundo">Apagar</button>
                  <button type="button" onClick={() => setApagando(false)} className="px-2 text-texto-3 hover:text-texto">Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => abrirEtiqueta?.(produto)}
                  className="flex items-center gap-2 rounded-xl border border-borda-forte px-3.5 py-2 text-sm font-medium text-texto-2 transition hover:border-acento hover:text-acento">
                  <QrCode size={16} /> Imprimir etiqueta
                </button>
                <button type="button" onClick={() => setApagando(true)} className="flex items-center gap-1.5 text-sm text-texto-3 hover:text-danger">
                  <Trash2 size={14} /> Apagar produto
                </button>
              </div>
            )
          )}
        </div>

        <div className="flex gap-2 border-t border-borda px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={fechar} className="flex-1 rounded-xl border border-borda-forte py-3 font-medium text-texto-2 hover:bg-elevado">
            Cancelar
          </button>
          <button disabled={salvando}
            className="flex-[2] rounded-xl bg-acento py-3 font-semibold text-sobre-acento transition hover:brightness-110 disabled:opacity-60">
            {salvando ? 'Salvando…' : produto ? 'Salvar alterações' : 'Cadastrar produto'}
          </button>
        </div>

        {camera && (
          <Suspense fallback={null}>
            <LeitorCamera titulo="Ler código da etiqueta" fechar={() => setCamera(false)}
              aoLer={(texto) => { setCamera(false); setCampos((c) => ({ ...c, codigo: texto })) }} />
          </Suspense>
        )}
      </form>
    </div>
  )
}

function Rotulo({ texto, dica, children }) {
  return (
    <label className="block text-sm font-medium text-texto-2">
      {texto} {dica && <span className="font-normal text-texto-3">({dica})</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  )
}
