import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Banknote, CalendarDays, HandCoins, Pencil, Plus, Search, ShoppingBag, Shirt, Users } from 'lucide-react'
import SeletorDePagamento from '@/components/vendas/SeletorDePagamento'
import { rotuloPagamento } from '@/lib/pagamento'
import { supabase, supabaseConfigurado } from '@/lib/supabase'
import { useCliente } from '@/context/useCliente'
import { traduzirErro } from '@/lib/erros'
import { classeEntrada } from '@/lib/classes'
import { dinheiro, lerNumero, paraCampo, quantidade as fmtQtd } from '@/lib/formato'
import Painel from '@/components/ui/Painel'
import { Avatar, CartaoCliente, FormCliente } from '@/components/clientes/PecasCliente'
import { CLIENTE_VAZIO, filtrarClientes, salvarCliente, useClientesDaLoja } from './dados'

// /:slug/clientes — quem compra na loja. Cadastro (nome, telefone, endereço,
// sobre) e a ficha: quanto já gastou, peças compradas, compras e condicionais.
// `children` deixa um cliente acrescentar algo sem copiar a tela.

const ORDENS = {
  nome: { rotulo: 'Nome', comparar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR') },
  gasto: { rotulo: 'Quem mais gastou', comparar: (a, b) => Number(b.gasto) - Number(a.gasto) },
  recente: { rotulo: 'Compra mais recente', comparar: (a, b) => new Date(b.ultima_compra ?? 0) - new Date(a.ultima_compra ?? 0) },
}

const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—')

export default function ClientesPage({ children }) {
  const { cliente } = useCliente()
  const clienteId = cliente?.id
  const clientes = useClientesDaLoja(clienteId)
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState('nome')
  const [painel, setPainel] = useState(null) // null | { tipo: 'novo' } | { tipo: 'ficha', id }

  const lista = useMemo(
    () => [...filtrarClientes(clientes.lista, busca)].sort(ORDENS[ordem].comparar),
    [clientes.lista, busca, ordem],
  )
  const resumo = useMemo(() => ({
    total: clientes.lista.length,
    gasto: clientes.lista.reduce((s, c) => s + Number(c.gasto), 0),
    comCondicional: clientes.lista.filter((c) => Number(c.condicionais_abertos) > 0).length,
    emAberto: clientes.lista.reduce((s, c) => s + Number(c.em_aberto ?? 0), 0),
  }), [clientes.lista])

  if (!supabaseConfigurado) return <p className="text-sm text-texto-3">Banco não configurado (frontend/.env).</p>

  // A ficha lê do resumo atualizado (depois de editar, já aparece o novo).
  const naFicha = painel?.tipo === 'ficha' ? clientes.lista.find((c) => c.id === painel.id) : null

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Clientes</h1>
          <p className="mt-1 text-sm text-texto-3">Quem compra na loja, com a ficha de cada um.</p>
        </div>
        <button onClick={() => setPainel({ tipo: 'novo' })}
          className="flex items-center gap-2 rounded-xl bg-acento px-4 py-2.5 font-semibold text-sobre-acento shadow-lg shadow-acento/15 transition hover:brightness-110">
          <Plus size={18} /> Novo cliente
        </button>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Numero icone={Users} rotulo="Clientes" valor={fmtQtd(resumo.total)} />
        <Numero icone={Banknote} rotulo="Já gastaram na loja" valor={dinheiro(resumo.gasto)} />
        <Numero icone={ShoppingBag} rotulo="Com condicional em aberto" valor={fmtQtd(resumo.comCondicional)} />
        <Numero icone={HandCoins} rotulo="Valor em aberto (a receber)" valor={dinheiro(resumo.emAberto)} />
      </div>

      <section className="rounded-2xl border border-borda bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda p-4 md:p-5">
          <div className="relative w-full sm:max-w-sm">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-texto-3" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone"
              aria-label="Buscar cliente" className={`${classeEntrada} pl-10`} />
          </div>
          <label className="flex items-center gap-2 text-xs text-texto-3">
            Ordenar
            <select value={ordem} onChange={(e) => setOrdem(e.target.value)}
              className="rounded-lg border border-borda-forte bg-fundo px-2 py-1.5 text-xs text-texto outline-none focus:border-acento">
              {Object.entries(ORDENS).map(([chave, o]) => <option key={chave} value={chave}>{o.rotulo}</option>)}
            </select>
          </label>
        </div>

        {clientes.carregando ? (
          <p className="p-6 text-sm text-texto-3">Carregando…</p>
        ) : clientes.lista.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-acento/12 text-acento"><Users size={26} /></span>
            <p className="mt-4 font-semibold">Nenhum cliente ainda</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-texto-3">Cadastre aqui, ou na hora de um condicional ou de uma venda.</p>
          </div>
        ) : lista.length === 0 ? (
          <p className="p-8 text-center text-sm text-texto-3">Ninguém encontrado com “{busca}”.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {lista.map((c) => (
              <li key={c.id}>
                <button onClick={() => setPainel({ tipo: 'ficha', id: c.id })}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-elevado/30 md:px-5">
                  <Avatar nome={c.nome} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {c.nome}
                      {Number(c.condicionais_abertos) > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn/12 px-1.5 py-0.5 text-[0.65rem] font-semibold text-warn">
                          <ShoppingBag size={10} /> condicional
                        </span>
                      )}
                      {Number(c.em_aberto) > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger/12 px-1.5 py-0.5 text-[0.65rem] font-semibold text-danger">
                          <HandCoins size={10} /> deve {dinheiro(c.em_aberto)}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-texto-3">
                      {c.telefone ?? 'sem telefone'}
                      {c.ultima_compra && ` · última compra ${dataCurta(c.ultima_compra)}`}
                    </p>
                  </div>
                  <div className="hidden w-20 text-right sm:block">
                    <p className="font-semibold tabular-nums">{fmtQtd(c.pecas)}</p>
                    <p className="text-xs text-texto-3">peças</p>
                  </div>
                  <div className="w-28 text-right">
                    <p className="font-semibold tabular-nums">{dinheiro(c.gasto)}</p>
                    <p className="text-xs text-texto-3">já gastou</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {painel?.tipo === 'novo' && (
        <NovoCliente clienteId={clienteId} fechar={() => setPainel(null)}
          salvo={(c) => { clientes.recarregar(); setPainel({ tipo: 'ficha', id: c.id }) }} />
      )}
      {naFicha && (
        <Ficha cliente={naFicha} clienteId={clienteId} fechar={() => setPainel(null)} mudou={clientes.recarregar} />
      )}
      {children}
    </div>
  )
}

function Numero({ icone: Icone, rotulo, valor, className = '' }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-borda bg-card p-4 ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-acento/12 text-acento"><Icone size={19} aria-hidden /></span>
      <div className="min-w-0">
        <p className="truncate text-xs text-texto-3">{rotulo}</p>
        <p className="truncate text-lg font-bold tabular-nums">{valor}</p>
      </div>
    </div>
  )
}

// ── Novo cliente ──────────────────────────────────────────────────────────

function NovoCliente({ clienteId, fechar, salvo }) {
  const [campos, setCampos] = useState(CLIENTE_VAZIO)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!campos.nome.trim()) return toast.error('Informe o nome do cliente.')
    setSalvando(true)
    const { data, error } = await salvarCliente(clienteId, campos)
    setSalvando(false)
    if (error) return toast.error(traduzirErro(error))
    toast.success(`${data.nome} cadastrado.`)
    salvo(data)
  }

  return (
    <Painel titulo="Novo cliente" fechar={fechar} largura="lg:w-[30rem]" rodape={
      <div className="flex gap-2">
        <button type="button" onClick={fechar} className="flex-1 rounded-xl border border-borda-forte py-3 font-medium text-texto-2 hover:bg-elevado">Cancelar</button>
        <button type="button" onClick={salvar} disabled={salvando}
          className="flex-[2] rounded-xl bg-acento py-3 font-semibold text-sobre-acento transition hover:brightness-110 disabled:opacity-60">
          {salvando ? 'Salvando…' : 'Cadastrar cliente'}
        </button>
      </div>
    }>
      <FormCliente valor={campos} mudar={setCampos} />
    </Painel>
  )
}

// ── Ficha ─────────────────────────────────────────────────────────────────

function Ficha({ cliente: c, clienteId, fechar, mudou }) {
  const [editando, setEditando] = useState(null) // campos em edição
  const [salvando, setSalvando] = useState(false)
  const [versao, setVersao] = useState(0) // relê o histórico depois de receber
  const historico = useHistorico(c.id, versao)

  async function salvar() {
    if (!editando.nome.trim()) return toast.error('Informe o nome do cliente.')
    setSalvando(true)
    const { error } = await salvarCliente(clienteId, editando, c.id)
    setSalvando(false)
    if (error) return toast.error(traduzirErro(error))
    toast.success('Ficha atualizada.')
    setEditando(null)
    mudou()
  }

  const ticket = Number(c.compras) > 0 ? Number(c.gasto) / Number(c.compras) : null

  return (
    <Painel titulo={editando ? 'Editar cliente' : 'Ficha do cliente'} fechar={fechar} rodape={editando && (
      <div className="flex gap-2">
        <button type="button" onClick={() => setEditando(null)} className="flex-1 rounded-xl border border-borda-forte py-3 font-medium text-texto-2 hover:bg-elevado">Cancelar</button>
        <button type="button" onClick={salvar} disabled={salvando}
          className="flex-[2] rounded-xl bg-acento py-3 font-semibold text-sobre-acento transition hover:brightness-110 disabled:opacity-60">
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    )}>
      {editando ? (
        <FormCliente valor={editando} mudar={setEditando} />
      ) : (
        <>
          <CartaoCliente cliente={{ ...c, gasto: undefined, em_aberto: undefined }} acoes={
            <button type="button" onClick={() => setEditando({
              nome: c.nome, telefone: c.telefone ?? '', rua: c.rua ?? '', numero: c.numero ?? '', bairro: c.bairro ?? '',
              observacoes: c.observacoes ?? '',
            })}
              aria-label="Editar cliente" title="Editar" className="shrink-0 rounded-lg p-2 text-texto-3 hover:bg-elevado hover:text-texto">
              <Pencil size={15} />
            </button>
          } />

          {/* Valor em aberto + receber */}
          {Number(c.em_aberto) > 0 && (
            <EmAberto cliente={c} contas={historico.contas} recebeu={() => { mudou(); setVersao((v) => v + 1) }} />
          )}

          {/* Números da ficha */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 rounded-2xl border border-acento/40 bg-gradient-to-br from-acento/15 via-card to-card p-4">
              <p className="flex items-center gap-2 text-sm text-texto-2"><Banknote size={16} className="text-acento" /> Já gastou na loja</p>
              <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{dinheiro(c.gasto)}</p>
            </div>
            <Dado icone={Shirt} rotulo="Peças compradas" valor={fmtQtd(c.pecas)} />
            <Dado icone={ShoppingBag} rotulo="Compras" valor={fmtQtd(c.compras)} />
            <Dado icone={Banknote} rotulo="Ticket médio" valor={ticket === null ? '—' : dinheiro(ticket)} />
            <Dado icone={CalendarDays} rotulo="Última compra" valor={dataCurta(c.ultima_compra)} />
          </div>
          <p className="text-xs text-texto-3">Cliente desde {dataCurta(c.criado_em)}. Contam as compras no caixa com este cliente escolhido e as que saíram de condicional.</p>

          {/* Condicionais */}
          {historico.condicionais.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Condicionais</h3>
              <ul className="space-y-2">
                {historico.condicionais.map((k) => {
                  const pecas = k.itens.reduce((s, i) => s + Number(i.quantidade), 0)
                  const comprou = k.itens.reduce((s, i) => s + Number(i.comprado), 0)
                  return (
                    <li key={k.id} className={`rounded-xl border p-3 text-sm ${k.situacao === 'aberto' ? 'border-warn/40 bg-warn/5' : 'border-borda'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">Pegou {fmtDia(k.saiu_em)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${k.situacao === 'aberto' ? 'bg-warn/12 text-warn' : 'bg-elevado text-texto-2'}`}>
                          {k.situacao === 'aberto' ? 'em aberto' : `acertado · comprou ${fmtQtd(comprou)}`}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-texto-3">{fmtQtd(pecas)} peça{pecas === 1 ? '' : 's'}: {k.itens.map((i) => i.produto_nome).join(', ')}</p>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Compras */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Compras</h3>
            {historico.carregando ? (
              <p className="text-sm text-texto-3">Carregando…</p>
            ) : historico.compras.length === 0 ? (
              <p className="rounded-xl border border-dashed border-borda-forte px-4 py-6 text-center text-sm text-texto-3">Nenhuma compra registrada ainda.</p>
            ) : (
              <ul className="space-y-2">
                {historico.compras.map((p) => (
                  <li key={p.id} className="rounded-xl border border-borda p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{new Date(p.vendido_em).toLocaleDateString('pt-BR')}</span>
                      <span className="font-semibold tabular-nums">{dinheiro(p.total)}</span>
                    </div>
                    {p.conta && (
                      <p className={`mt-0.5 text-xs font-medium ${p.conta.quitado_em ? 'text-texto-3' : 'text-danger'}`}>
                        {p.conta.quitado_em
                          ? `tinha ${dinheiro(p.conta.valor_aberto)} em aberto · pago`
                          : `falta ${dinheiro(Number(p.conta.valor_aberto) - Number(p.conta.valor_recebido))} de ${dinheiro(p.conta.valor_aberto)} em aberto`}
                      </p>
                    )}
                    <ul className="mt-1 space-y-0.5 text-xs text-texto-2">
                      {p.itens.map((i) => <li key={i.id} className="truncate">{fmtQtd(i.quantidade)}× {i.produto_nome}</li>)}
                    </ul>
                    {p.vendedor_nome && <p className="mt-1 text-xs text-texto-3">vendeu: {p.vendedor_nome}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Painel>
  )
}

function Dado({ icone: Icone, rotulo, valor }) {
  return (
    <div className="rounded-xl border border-borda bg-fundo/40 p-3">
      <p className="flex items-center gap-1.5 text-xs text-texto-3"><Icone size={13} /> {rotulo}</p>
      <p className="mt-1 font-semibold tabular-nums">{valor}</p>
    </div>
  )
}

const fmtDia = (dia) => {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR')
}

// ── Valor em aberto ───────────────────────────────────────────────────────
// Quanto o cliente deve, de quais compras, e o "Receber": valor (o total já
// vem preenchido; pode ser só uma parte) + forma. Abate das compras mais
// antigas primeiro.

function EmAberto({ cliente: c, contas, recebeu }) {
  const [abrindo, setAbrindo] = useState(false)
  const [valor, setValor] = useState('')
  const [forma, setForma] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const abertas = contas.filter((k) => !k.quitado_em)
  const saldo = Number(c.em_aberto)

  async function receber() {
    const n = lerNumero(valor)
    if (n === null || Number.isNaN(n) || n <= 0) return toast.error('Informe quanto ele está pagando.')
    if (Math.round(n * 100) > Math.round(saldo * 100)) return toast.error(`O máximo é ${dinheiro(saldo)}.`)
    if (!forma) return toast.error('Escolha a forma de pagamento.')
    setEnviando(true)
    const { data: falta, error } = await supabase.rpc('receber_em_aberto', { p_cliente_loja_id: c.id, p_valor: n, p_forma_pagamento: forma })
    setEnviando(false)
    if (error) return toast.error(traduzirErro(error))
    toast.success(`Recebido ${dinheiro(n)} (${rotuloPagamento(forma)}). ${Number(falta) > 0 ? `Ainda falta ${dinheiro(falta)}.` : 'Tudo pago!'}`)
    setAbrindo(false)
    setValor('')
    setForma(null)
    recebeu()
  }

  return (
    <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm text-texto-2"><HandCoins size={16} className="text-danger" /> Em aberto</p>
          <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{dinheiro(saldo)}</p>
        </div>
        {!abrindo && (
          <button type="button" onClick={() => { setAbrindo(true); setValor(paraCampo(saldo)) }}
            className="rounded-xl bg-acento px-4 py-2.5 text-sm font-semibold text-sobre-acento transition hover:brightness-110">
            Receber
          </button>
        )}
      </div>

      {abertas.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-texto-2">
          {abertas.map((k) => (
            <li key={k.id} className="flex justify-between gap-3">
              <span>Compra de {new Date(k.criado_em).toLocaleDateString('pt-BR')} ({dinheiro(k.valor_total)})</span>
              <span className="shrink-0 tabular-nums">falta {dinheiro(Number(k.valor_aberto) - Number(k.valor_recebido))}</span>
            </li>
          ))}
        </ul>
      )}

      {abrindo && (
        <div className="mt-4 space-y-3 border-t border-danger/20 pt-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-texto-2">Está pagando</span>
            <span className="flex h-10 items-center rounded-lg border border-borda-forte bg-fundo px-2 focus-within:border-acento">
              <span className="text-xs text-texto-3">R$</span>
              <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus
                aria-label="Valor recebido" className="w-24 bg-transparent pl-1 text-right tabular-nums outline-none" />
            </span>
          </label>
          <SeletorDePagamento valor={forma} aoMudar={setForma} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setAbrindo(false)} className="flex-1 rounded-xl border border-borda-forte py-2.5 text-sm text-texto-2 hover:bg-elevado">Cancelar</button>
            <button type="button" onClick={receber} disabled={enviando}
              className="flex-[2] rounded-xl bg-acento py-2.5 text-sm font-semibold text-sobre-acento disabled:opacity-60">
              {enviando ? 'Registrando…' : 'Confirmar recebimento'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Compras (agrupadas por pedido), condicionais e valores em aberto do cliente.
function useHistorico(pessoaId, versao = 0) {
  const [estado, setEstado] = useState({ chave: null, compras: [], condicionais: [], contas: [] })
  const chave = `${pessoaId}:${versao}`

  useEffect(() => {
    let cancelado = false
    Promise.all([
      supabase.from('vendas').select('id, pedido_id, produto_nome, quantidade, preco_unitario, vendido_em, vendedor_nome')
        .eq('cliente_loja_id', pessoaId).order('vendido_em', { ascending: false }).limit(300),
      supabase.from('condicionais').select('id, saiu_em, situacao, itens:condicional_itens(quantidade, comprado, produto_nome)')
        .eq('cliente_loja_id', pessoaId).order('saiu_em', { ascending: false }),
      supabase.from('contas_receber').select('id, pedido_id, valor_total, valor_aberto, valor_recebido, criado_em, quitado_em')
        .eq('cliente_loja_id', pessoaId).order('criado_em', { ascending: true }),
    ]).then(([v, k, r]) => {
      if (cancelado) return
      const porPedido = new Map()
      for (const linha of v.data ?? []) {
        const p = porPedido.get(linha.pedido_id) ?? { id: linha.pedido_id, vendido_em: linha.vendido_em, vendedor_nome: linha.vendedor_nome, itens: [], total: 0 }
        p.itens.push(linha)
        p.total += Number(linha.quantidade) * Number(linha.preco_unitario)
        porPedido.set(linha.pedido_id, p)
      }
      const contas = r.data ?? []
      const contaDoPedido = new Map(contas.map((x) => [x.pedido_id, x]))
      const compras = [...porPedido.values()].map((p) => ({ ...p, conta: contaDoPedido.get(p.id) ?? null }))
      setEstado({ chave, compras, condicionais: k.data ?? [], contas })
    })
    return () => { cancelado = true }
  }, [pessoaId, chave])

  // Releitura (depois de receber) mantém o que já está na tela.
  return estado.chave?.startsWith(`${pessoaId}:`)
    ? { ...estado, carregando: false }
    : { compras: [], condicionais: [], contas: [], carregando: true }
}
