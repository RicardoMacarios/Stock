import { useEffect, useRef, useState } from 'react'
import { CameraOff, X } from 'lucide-react'

// Lê QR Code ou código de barras pela câmera (traseira, no celular).
// Carregue com React.lazy: a biblioteca (ZXing) só baixa quando a câmera abre.
// Leu um código → chama aoLer(texto) uma vez e fecha.
//
// Câmera só funciona em página segura: https ou localhost.
export default function LeitorCamera({ aoLer, fechar, titulo = 'Aponte para o código' }) {
  const video = useRef(null)
  const [erro, setErro] = useState('')
  // Ref: a câmera não reinicia quando o componente pai re-renderiza.
  const aoLerRef = useRef(aoLer)
  useEffect(() => { aoLerRef.current = aoLer }, [aoLer])

  useEffect(() => {
    let controles = null
    let encerrado = false

    ;(async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (encerrado) return
        const leitor = new BrowserMultiFormatReader()
        controles = await leitor.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          video.current,
          (resultado) => {
            if (!resultado || encerrado) return
            encerrado = true
            controles?.stop()
            navigator.vibrate?.(60)
            aoLerRef.current(resultado.getText().trim())
          },
        )
        if (encerrado) controles.stop()
      } catch (e) {
        if (encerrado) return
        setErro(e?.name === 'NotAllowedError'
          ? 'Sem permissão para usar a câmera. Libere o acesso nas configurações do navegador.'
          : 'Não foi possível abrir a câmera neste aparelho.')
      }
    })()

    return () => { encerrado = true; controles?.stop() }
  }, [])

  // Esc fecha.
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && fechar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [fechar])

  return (
    <div role="dialog" aria-modal="true" aria-label={titulo}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-0 sm:p-6">
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-fundo sm:h-auto sm:max-w-md sm:rounded-2xl sm:border sm:border-borda">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="font-semibold">{titulo}</p>
          <button type="button" onClick={fechar} aria-label="Fechar câmera" className="rounded-lg p-2 text-texto-3 hover:bg-elevado hover:text-texto">
            <X size={20} />
          </button>
        </div>

        <div className="relative flex-1 bg-black sm:aspect-square sm:flex-none">
          {erro ? (
            <div className="grid h-full place-items-center p-6 text-center">
              <div>
                <CameraOff size={32} className="mx-auto text-texto-3" />
                <p className="mt-3 text-sm text-texto-2">{erro}</p>
              </div>
            </div>
          ) : (
            <>
              <video ref={video} muted playsInline className="h-full w-full object-cover" />
              {/* Moldura de mira */}
              <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="h-56 w-56 rounded-2xl border-2 border-acento shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]" />
              </div>
            </>
          )}
        </div>

        <p className="px-4 py-3 text-center text-xs text-texto-3">QR Code ou código de barras. Lê sozinho quando entra na moldura.</p>
      </div>
    </div>
  )
}
