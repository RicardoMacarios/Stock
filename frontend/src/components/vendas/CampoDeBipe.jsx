import { Suspense, lazy, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Camera, ScanBarcode } from 'lucide-react'
import { useLeitorDeCodigo } from '@/hooks/useLeitorDeCodigo'
import { dinheiro, quantidade as fmtQtd } from '@/lib/formato'
import { acharPorCodigo, buscarProdutos } from '@/lib/busca'

// Câmera só baixa a biblioteca de leitura (ZXing) quando abre.
const LeitorCamera = lazy(() => import('@/components/ui/LeitorCamera'))

// Achar um produto para pôr numa lista (venda, condicional): pistola em
// qualquer ponto da tela, câmera ou busca pelo nome ou parte do código. Chama aoEscolher(produto).
// `ativo` desliga a escuta da pistola (ex.: quando um painel está aberto).
export default function CampoDeBipe({ produtos, aoEscolher, ativo = true, placeholder = 'Bipe, digite o nome ou parte do código' }) {
  const [busca, setBusca] = useState('')
  const [camera, setCamera] = useState(false)

  const encontrados = useMemo(() => {
    if (!busca.trim() || !produtos) return []
    return buscarProdutos(produtos, busca).slice(0, 8)
  }, [produtos, busca])

  function escolher(p) {
    setBusca('')
    aoEscolher(p)
  }

  function bipar(texto) {
    const codigo = texto.trim()
    const p = acharPorCodigo(produtos, codigo)
    if (!p) { setBusca(''); return toast.error(`Código ${codigo} não cadastrado. Cadastre em Produtos.`) }
    escolher(p)
  }
  useLeitorDeCodigo(bipar, { ativo: ativo && !camera })

  function enter(e) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const q = busca.trim()
    if (!q) return
    if (acharPorCodigo(produtos, q)) return bipar(q)
    if (encontrados.length === 1) return escolher(encontrados[0])
    if (encontrados.length === 0) toast.error(`Nada encontrado para “${q}”.`)
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <ScanBarcode size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-acento" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={enter}
            placeholder={placeholder} aria-label="Bipar ou buscar produto"
            className="h-12 w-full rounded-xl border border-borda-forte bg-fundo pl-11 pr-3 text-base outline-none transition placeholder:text-texto-3 focus:border-acento focus:ring-2 focus:ring-acento/25 lg:text-sm" />
        </div>
        <button type="button" onClick={() => setCamera(true)} aria-label="Ler código com a câmera" title="Ler com a câmera"
          className="flex h-12 shrink-0 items-center gap-2 rounded-xl border border-borda-forte px-3.5 text-sm font-medium text-texto-2 transition hover:border-acento hover:text-acento">
          <Camera size={20} /> <span className="hidden sm:inline">Câmera</span>
        </button>
      </div>

      {busca.trim() && (
        <ul className="absolute inset-x-0 top-14 z-10 max-h-72 overflow-auto rounded-xl border border-borda-forte bg-fundo shadow-2xl">
          {encontrados.length === 0 && <li className="px-4 py-3 text-sm text-texto-3">Nenhum produto com “{busca}”.</li>}
          {encontrados.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => escolher(p)} disabled={Number(p.quantidade) <= 0}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-elevado disabled:cursor-not-allowed disabled:opacity-50">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.nome}</span>
                  <span className="block text-xs text-texto-3">
                    {p.codigo_legado != null && <span className="font-mono">#{p.codigo_legado} · </span>}
                    {Number(p.quantidade) <= 0 ? 'sem estoque' : `${fmtQtd(p.quantidade)} em estoque`}
                  </span>
                </span>
                {p.preco_venda != null && <span className="shrink-0 font-semibold tabular-nums">{dinheiro(p.preco_venda)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {camera && (
        <Suspense fallback={null}>
          <LeitorCamera titulo="Bipar peça" fechar={() => setCamera(false)}
            aoLer={(texto) => { setCamera(false); bipar(texto) }} />
        </Suspense>
      )}
    </div>
  )
}
