import { useState } from 'react'
import { MapPin, MessageCircle, Phone, Search, ShoppingBag, UserPlus } from 'lucide-react'
import { classeEntrada } from '@/lib/classes'
import { dinheiro, quantidade as fmtQtd } from '@/lib/formato'
import { filtrarClientes, iniciais, linkWhatsApp } from '@/pages/clientes/dados'

// Peças de cliente da loja usadas em Clientes, Condicional e Vendas:
// BuscaCliente (achar ou começar um cadastro), FormCliente (campos) e
// CartaoCliente (dados + resumo da ficha).


export function BuscaCliente({ clientes, escolher, cadastrar, autoFocus = true, compacto = false }) {
  const [busca, setBusca] = useState('')
  const achados = busca.trim() ? filtrarClientes(clientes, busca).slice(0, 6) : []

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-texto-3" />
        <input autoFocus={autoFocus} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou telefone do cliente"
          aria-label="Buscar cliente" className={`${classeEntrada} ${compacto ? 'h-11' : 'h-12'} pl-10`} />
      </div>
      {achados.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-borda">
          {achados.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => escolher(c)}
                className="flex w-full items-center gap-3 border-b border-borda px-3 py-2.5 text-left last:border-0 hover:bg-elevado">
                <Avatar nome={c.nome} tamanho="h-8 w-8 text-xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.nome}</span>
                  {c.telefone && <span className="block text-xs text-texto-3">{c.telefone}</span>}
                  {Number(c.condicionais_abertos) > 0 && (
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-warn/12 px-1.5 py-0.5 text-[0.65rem] font-semibold text-warn">
                      <ShoppingBag size={10} /> condicional em aberto
                    </span>
                  )}
                </span>
                {Number(c.gasto) > 0 && <span className="shrink-0 text-xs text-texto-3 tabular-nums">{dinheiro(c.gasto)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {cadastrar && (
        <button type="button" onClick={() => cadastrar(busca.trim())}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-borda-forte py-3 text-sm font-medium text-texto-2 transition hover:border-acento hover:text-acento">
          <UserPlus size={16} /> {busca.trim() && achados.length === 0 ? `Cadastrar “${busca.trim()}”` : 'Cadastrar cliente novo'}
        </button>
      )}
    </div>
  )
}

export function FormCliente({ valor, mudar, autoFocus = true }) {
  const campo = (chave) => (e) => mudar({ ...valor, [chave]: e.target.value })
  return (
    <div className="space-y-3">
      <Campo rotulo="Nome *">
        <input autoFocus={autoFocus} value={valor.nome} onChange={campo('nome')} maxLength={120} placeholder="Nome do cliente" className={classeEntrada} />
      </Campo>
      <Campo rotulo="Telefone / WhatsApp">
        <input value={valor.telefone ?? ''} onChange={campo('telefone')} maxLength={30} inputMode="tel" placeholder="(16) 99999-0000" className={classeEntrada} />
      </Campo>
      <Campo rotulo="Rua">
        <input value={valor.rua ?? ''} onChange={campo('rua')} maxLength={200} placeholder="Ex.: Rua das Flores" autoComplete="address-line1"
          className={classeEntrada} />
      </Campo>
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <Campo rotulo="Número">
          <input value={valor.numero ?? ''} onChange={campo('numero')} maxLength={20} placeholder="123" inputMode="numeric"
            className={classeEntrada} />
        </Campo>
        <Campo rotulo="Bairro">
          <input value={valor.bairro ?? ''} onChange={campo('bairro')} maxLength={100} placeholder="Ex.: Centro" className={classeEntrada} />
        </Campo>
      </div>
      <Campo rotulo="Sobre o cliente">
        <textarea value={valor.observacoes ?? ''} onChange={campo('observacoes')} maxLength={1000} rows={3}
          placeholder="Tamanho que veste, estilo, preferências, indicação…" className={`${classeEntrada} resize-none`} />
      </Campo>
    </div>
  )
}

function Campo({ rotulo, children }) {
  return (
    <label className="block text-sm font-medium text-texto-2">
      {rotulo}
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

export function Avatar({ nome, tamanho = 'h-11 w-11 text-sm' }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full bg-acento/15 font-bold text-acento ${tamanho}`}>
      {iniciais(nome)}
    </span>
  )
}

// Dados do cliente e, se tiver, o resumo da ficha.
export function CartaoCliente({ cliente: c, trocar, acoes }) {
  const whats = linkWhatsApp(c.telefone)
  const temResumo = c.gasto !== undefined
  return (
    <div className="rounded-2xl border border-borda bg-fundo/40 p-4">
      <div className="flex items-start gap-3">
        <Avatar nome={c.nome} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{c.nome}</p>
          {c.telefone && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-texto-2">
              <Phone size={13} className="text-texto-3" /> {c.telefone}
              {whats && (
                <a href={whats} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-acento hover:underline">
                  <MessageCircle size={12} /> WhatsApp
                </a>
              )}
            </p>
          )}
          {c.endereco && <p className="mt-0.5 flex items-start gap-1.5 text-sm text-texto-2"><MapPin size={13} className="mt-0.5 shrink-0 text-texto-3" /> {c.endereco}</p>}
        </div>
        {trocar && <button type="button" onClick={trocar} className="shrink-0 text-xs text-texto-3 hover:text-texto">Trocar</button>}
        {acoes}
      </div>
      {c.observacoes && <p className="mt-3 rounded-lg bg-elevado/60 px-3 py-2 text-xs text-texto-2">{c.observacoes}</p>}
      {temResumo && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <MiniNumero rotulo="Já gastou" valor={dinheiro(c.gasto)} />
          <MiniNumero rotulo="Peças" valor={fmtQtd(c.pecas)} />
          <MiniNumero rotulo="Compras" valor={fmtQtd(c.compras)} />
        </div>
      )}
      {Number(c.condicionais_abertos) > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-warn">
          <ShoppingBag size={12} /> Com {c.condicionais_abertos} condicional{Number(c.condicionais_abertos) > 1 ? 'is' : ''} em aberto
        </p>
      )}
    </div>
  )
}

function MiniNumero({ rotulo, valor }) {
  return (
    <div className="rounded-lg bg-elevado/50 px-2 py-1.5">
      <p className="text-[0.65rem] text-texto-3">{rotulo}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{valor}</p>
    </div>
  )
}
