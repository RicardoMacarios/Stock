import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Banknote, Boxes, Camera, CircleCheck, Package, PackagePlus, PackageX, Pencil, Plus, ScanBarcode, Trash2,
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
import { todasAsLinhas } from '@/lib/consulta'

// /:slug/produtos — cadastrar, editar, dar entrada no estoque e apagar.
// Escrita direto na tabela: a policy produtos_do_cliente já limita ao cliente.
// `children` deixa um cliente acrescentar algo sem copiar a tela.

// Câmera só baixa a biblioteca de leitura (ZXing) quando abre.
const LeitorCamera = lazy(() => import('@/components/ui/LeitorCamera'))

const VAZIO = { nome: '', codigo: '', quantidade: '', estoque_minimo: '', preco_custo: '', preco_venda: '' }

// Situação sempre com ícone + rótulo, nunca só cor.
const SITUACAO = {
  ok: { rotulo: 'Em dia', icone: CircleCheck, selo: 'bg-ok/12 text-ok' },
  baixo: { rotulo: 'Baixo', icone: TriangleAlert, selo: 'bg-warn/12 text-warn' },
  zerado: { rotulo: 'Zerado', icone: PackageX, selo: 'bg-danger/12 text-danger' },
}

const ORDENS = {
  nome: { rotulo: 'Nome', comparar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR') },
  estoque: { rotulo: 'Menor estoque', comparar: (a, b) => Number(a.quantidade) - Number(b.quantidade) },
  recentes: { rotulo: 'Mais recentes', comparar: (a, b) => new Date(b.criado_em) - new Date(a.criado_em) },
}

export default function ProdutosPage({ children }) {
  const { cliente } = useCliente()
  const clienteId = cliente?.id
  const [produtos, setProdutos] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos') // todos | baixo | zerado
  const [ordem, setOrdem] = useState('nome')
  const [camera, setCamera] = useState(false)
  // null | { produto: null (novo) ou o produto, codigo: código bipado para o novo }
  const [editando, setEditando] = useState(null)

  const carregar = useCallback(async () => {
    if (!clienteId) return
    const { data, error } = await todasAsLinhas(() => supabase.from('produtos')
      .select('id, nome, codigo, codigo_legado, quantidade, estoque_minimo, preco_custo, preco_venda, criado_em')
      .eq('cliente_id', clienteId).order('nome').order('id'))
    if (error) toast.error('Não foi possível carregar os produtos.')
    setProdutos((data ?? []).map((p) => ({ ...p, situacao: situacao(p) })))
  }, [clienteId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial vinda do banco
    carregar()
  }, [carregar])

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
      .filter((p) => filtro === 'todos' || p.situacao === filtro)
      .sort(ORDENS[ordem].comparar)
    return buscarProdutos(ordenados, busca)
  }, [produtos, busca, filtro, ordem])

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
            {lista.map((p) => (
              <LinhaProduto key={p.id} produto={p} editar={() => setEditando({ produto: p })} mudou={carregar} />
            ))}
          </ul>
        )}
      </section>

      {editando && (
        <PainelProduto key={editando.produto?.id ?? `novo:${editando.codigo ?? ''}`} produto={editando.produto}
          codigoInicial={editando.codigo} clienteId={clienteId}
          fechar={() => setEditando(null)} salvo={() => { setEditando(null); carregar() }} />
      )}

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

const iniciais = (nome) => nome.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase()

// ── Painel de cadastro/edição ─────────────────────────────────────────────
// Lateral no computador; folha que sobe no celular.

function PainelProduto({ produto, codigoInicial, clienteId, fechar, salvo }) {
  const [campos, setCampos] = useState(() => (produto
    ? {
        nome: produto.nome,
        codigo: produto.codigo ?? '',
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
      quantidade: lerNumero(campos.quantidade) ?? 0,
      estoque_minimo: lerNumero(campos.estoque_minimo),
      preco_custo: custo,
      preco_venda: venda,
    }
    if (!valores.nome) return toast.error('Informe o nome do produto.')
    if (Object.values(valores).some((v) => Number.isNaN(v))) return toast.error('Confira os números (use vírgula para centavos).')
    if (valores.quantidade < 0) return toast.error('A quantidade não pode ser negativa.')

    setSalvando(true)
    const { error } = produto
      ? await supabase.from('produtos').update(valores).eq('id', produto.id)
      : await supabase.from('produtos').insert({ ...valores, cliente_id: clienteId })
    setSalvando(false)
    if (error) return toast.error(traduzirErro(error))
    toast.success(produto ? 'Produto atualizado.' : 'Produto cadastrado.')
    salvo()
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

          <div>
            <label htmlFor="codigo" className="block text-sm font-medium text-texto-2">
              Código <span className="font-normal text-texto-3">(bipe a etiqueta)</span>
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
            <div className="grid grid-cols-2 gap-3">
              <Rotulo texto="Custo (R$)">
                <input inputMode="decimal" value={campos.preco_custo} onChange={mudar('preco_custo')} placeholder="0,00" className={classeEntrada} />
              </Rotulo>
              <Rotulo texto="Venda (R$)">
                <input inputMode="decimal" value={campos.preco_venda} onChange={mudar('preco_venda')} placeholder="0,00" className={classeEntrada} />
              </Rotulo>
            </div>
            <p className="mt-3 text-sm text-texto-3">
              {margem !== null
                ? <>Lucro por peça <strong className="text-texto">{dinheiro(lucroPeca)}</strong> · margem <strong className={margem >= 0 ? 'text-ok' : 'text-danger'}>{margem}%</strong></>
                : 'Com custo e venda, mostramos o lucro por peça.'}
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
              <button type="button" onClick={() => setApagando(true)} className="flex items-center gap-1.5 text-sm text-texto-3 hover:text-danger">
                <Trash2 size={14} /> Apagar produto
              </button>
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
