import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { Printer, QrCode } from 'lucide-react'
import Painel from '@/components/ui/Painel'
import { supabase } from '@/lib/supabase'
import { traduzirErro } from '@/lib/erros'
import { classeEntrada } from '@/lib/classes'
import { dinheiro } from '@/lib/formato'
import { codigoLivre, qrEmSvg } from '@/lib/qrcode'

// Etiqueta da peça: QR Code com o código (é o que o caixa lê para achar o
// produto) + nome, valor e código impressos. Sai na impressora de etiquetas
// da loja: uma etiqueta por página, no tamanho escolhido (o navegador
// lembra). Imprime quantas cópias pedir (padrão: uma por peça em estoque).

const TAMANHOS = [
  { valor: '50x30', rotulo: '50 × 30 mm' },
  { valor: '40x25', rotulo: '40 × 25 mm' },
  { valor: '60x40', rotulo: '60 × 40 mm' },
]
const CHAVE_TAMANHO = 'stock:etiqueta-tamanho'

function lerTamanho() {
  try { return localStorage.getItem(CHAVE_TAMANHO) || '50x30' } catch { return '50x30' }
}
function lembrarTamanho(v) {
  try { localStorage.setItem(CHAVE_TAMANHO, v) } catch { /* sem armazenamento: só não lembra */ }
}
// "50x30" → { w: 50, h: 30 } (mm). Inválido → 50×30.
function medidas(texto) {
  const [w, h] = String(texto).toLowerCase().replace(',', '.').split(/\s*[x×]\s*/).map(Number)
  return w >= 15 && h >= 10 && w <= 150 && h <= 150 ? { w, h } : { w: 50, h: 30 }
}

export default function Etiquetas({ produto, clienteId, fechar, mudou }) {
  const [codigo, setCodigo] = useState(produto.codigo || (produto.codigo_legado != null ? String(produto.codigo_legado) : ''))
  const [qr, setQr] = useState(null)
  const [tamanho, setTamanho] = useState(lerTamanho)
  const [copias, setCopias] = useState(() => String(Math.max(1, Math.round(Number(produto.quantidade) || 1))))
  const [gerando, setGerando] = useState(false)
  const { w, h } = medidas(tamanho)
  const nCopias = Math.min(500, Math.max(1, Math.round(Number(copias) || 1)))
  const personalizado = !TAMANHOS.some((t) => t.valor === tamanho)

  useEffect(() => {
    if (!codigo) return
    let cancelado = false
    qrEmSvg(codigo).then((r) => { if (!cancelado) setQr(r) })
    return () => { cancelado = true }
  }, [codigo])

  async function gerarCodigo() {
    setGerando(true)
    let novo
    try {
      novo = await codigoLivre(supabase, clienteId)
    } catch (erro) {
      setGerando(false)
      return toast.error(traduzirErro(erro))
    }
    const { error } = await supabase.from('produtos').update({ codigo: novo }).eq('id', produto.id)
    setGerando(false)
    if (error) return toast.error(traduzirErro(error))
    setCodigo(novo)
    mudou?.()
  }

  function imprimir() {
    lembrarTamanho(tamanho)
    document.body.classList.add('imprimindo-etiquetas')
    const fim = () => {
      document.body.classList.remove('imprimindo-etiquetas')
      window.removeEventListener('afterprint', fim)
    }
    window.addEventListener('afterprint', fim)
    window.print()
  }

  const etiqueta = (chave) => <Etiqueta key={chave} produto={produto} codigo={codigo} qr={qr} w={w} h={h} />

  return (
    <Painel titulo="Etiqueta da peça" fechar={fechar} largura="lg:w-[28rem]" rodape={
      <div className="flex gap-2">
        <button type="button" onClick={fechar} className="flex-1 rounded-xl border border-borda-forte py-3 font-medium text-texto-2 hover:bg-elevado">Fechar</button>
        <button type="button" onClick={imprimir} disabled={!qr}
          className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-acento py-3 font-semibold text-sobre-acento transition hover:brightness-110 disabled:opacity-50">
          <Printer size={18} /> Imprimir {nCopias} etiqueta{nCopias === 1 ? '' : 's'}
        </button>
      </div>
    }>
      {!codigo ? (
        <div className="rounded-2xl border border-warn/40 bg-warn/5 p-4 text-sm">
          <p className="font-medium">Esta peça não tem código.</p>
          <p className="mt-1 text-texto-3">O QR Code leva o código da peça, para o caixa achar o produto ao ler a etiqueta.</p>
          <button type="button" onClick={gerarCodigo} disabled={gerando}
            className="mt-3 flex items-center gap-2 rounded-xl bg-acento px-4 py-2.5 text-sm font-semibold text-sobre-acento disabled:opacity-60">
            <QrCode size={16} /> {gerando ? 'Gerando…' : 'Gerar código e etiqueta'}
          </button>
        </div>
      ) : (
        <>
          {/* Prévia em tamanho real aproximado (no papel sai em mm) */}
          <div className="grid place-items-center rounded-2xl bg-elevado/50 p-6">
            <div className="shadow-lg">{etiqueta('previa')}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1.5 block text-texto-2">Tamanho da etiqueta</span>
              <select value={personalizado ? 'outro' : tamanho} onChange={(e) => setTamanho(e.target.value === 'outro' ? '45x35' : e.target.value)}
                className={classeEntrada}>
                {TAMANHOS.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                <option value="outro">Outro tamanho…</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-texto-2">Quantas etiquetas</span>
              <input inputMode="numeric" value={copias} onChange={(e) => setCopias(e.target.value.replace(/\D/g, ''))} className={classeEntrada} />
            </label>
          </div>
          {personalizado && (
            <label className="block text-sm">
              <span className="mb-1.5 block text-texto-2">Largura × altura em mm</span>
              <input value={tamanho} onChange={(e) => setTamanho(e.target.value)} placeholder="45x35" className={classeEntrada} />
            </label>
          )}
          <p className="text-xs text-texto-3">
            Na janela de impressão, escolha a impressora de etiquetas, papel do mesmo tamanho e margens “Nenhuma”.
            O tamanho fica guardado neste computador.
          </p>
        </>
      )}

      {/* Só aparece no papel: as cópias, uma por página */}
      {codigo && qr && createPortal(
        <div className="area-etiquetas">
          <style>{`@page { size: ${w}mm ${h}mm; margin: 0; }`}</style>
          {Array.from({ length: nCopias }, (_, i) => etiqueta(i))}
        </div>,
        document.body,
      )}
    </Painel>
  )
}

// Uma etiqueta, em mm: QR à esquerda (altura toda), texto à direita.
function Etiqueta({ produto, codigo, qr, w, h }) {
  const borda = Math.max(1.2, h * 0.06)
  const lado = Math.min(h - borda * 2, w * 0.48)
  const fonte = Math.max(5.5, Math.min(9, h * 0.24)) // pt
  return (
    <div className="etiqueta" style={{
      width: `${w}mm`, height: `${h}mm`, padding: `${borda}mm`, gap: `${borda}mm`,
      display: 'flex', alignItems: 'center', background: '#fff', color: '#000', overflow: 'hidden', boxSizing: 'border-box',
      fontFamily: 'Arial, Helvetica, sans-serif',
    }}>
      {qr ? (
        <svg viewBox={`0 0 ${qr.tamanho} ${qr.tamanho}`} style={{ width: `${lado}mm`, height: `${lado}mm`, flexShrink: 0 }}
          shapeRendering="crispEdges" role="img" aria-label={`QR Code ${codigo}`}>
          <path d={qr.caminho} fill="#000" />
        </svg>
      ) : (
        <div style={{ width: `${lado}mm`, height: `${lado}mm`, flexShrink: 0, background: '#eee' }} />
      )}
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
        <p style={{
          margin: 0, fontSize: `${fonte * 0.85}pt`, lineHeight: 1.15, fontWeight: 600,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{produto.nome}</p>
        <p style={{ margin: 0, fontSize: `${fonte * 1.45}pt`, fontWeight: 800, lineHeight: 1.1 }}>
          {produto.preco_venda != null ? dinheiro(produto.preco_venda) : ''}
        </p>
        <p style={{ margin: 0, fontSize: `${fonte * 0.7}pt`, fontFamily: 'monospace', letterSpacing: '0.02em' }}>{codigo}</p>
      </div>
    </div>
  )
}
