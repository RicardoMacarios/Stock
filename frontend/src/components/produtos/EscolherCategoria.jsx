import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { nomeCategoria, normalizarCategoria } from '@/lib/categorias'

// Categoria do produto em botões: as da loja e, no fim, "+ Nova" para
// digitar outra (ex.: Blusa de frio). A nova já fica escolhida e aparece
// para os outros produtos depois de salvar. Clicar na escolhida desmarca.
// `valor`: texto da categoria ("Camiseta"); `aoMudar(texto)`.
export default function EscolherCategoria({ categorias, valor, aoMudar }) {
  const [criando, setCriando] = useState(false)
  const [nova, setNova] = useState('')
  const escolhida = normalizarCategoria(valor)

  // A escolhida que ainda não existe na loja (nova, ainda não salva) também vira botão.
  const lista = escolhida && !categorias.some((c) => c.valor === escolhida)
    ? [...categorias, { valor: escolhida, rotulo: nomeCategoria(escolhida) }]
    : categorias

  function adicionar() {
    const n = normalizarCategoria(nova)
    if (!n) return setCriando(false)
    aoMudar(nomeCategoria(n))
    setNova('')
    setCriando(false)
  }

  return (
    <div>
      <p className="text-sm font-medium text-texto-2">Categoria</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Categoria">
        {lista.map((c) => {
          const ativa = escolhida === c.valor
          return (
            <button key={c.valor} type="button" onClick={() => aoMudar(ativa ? '' : c.rotulo)} aria-pressed={ativa}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                ativa ? 'border-acento bg-acento/12 font-semibold text-acento' : 'border-borda-forte text-texto-2 hover:border-acento hover:text-acento'
              }`}>
              {ativa && <Check size={12} aria-hidden />}
              {c.rotulo}
            </button>
          )
        })}

        {criando ? (
          <span className="flex items-center gap-1 rounded-full border border-acento bg-fundo py-0.5 pl-2.5 pr-0.5">
            <input autoFocus value={nova} onChange={(e) => setNova(e.target.value)} maxLength={60} placeholder="Nova categoria"
              aria-label="Nome da nova categoria"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); adicionar() }
                if (e.key === 'Escape') { e.stopPropagation(); setCriando(false) }
              }}
              className="w-32 bg-transparent text-xs outline-none" />
            <button type="button" onClick={adicionar} className="rounded-full bg-acento px-2.5 py-0.5 text-xs font-semibold text-sobre-acento">
              Adicionar
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setCriando(true)}
            className="flex items-center gap-1 rounded-full border border-dashed border-borda-forte px-2.5 py-1 text-xs text-texto-2 transition hover:border-acento hover:text-acento">
            <Plus size={12} aria-hidden /> Nova
          </button>
        )}
      </div>
    </div>
  )
}
