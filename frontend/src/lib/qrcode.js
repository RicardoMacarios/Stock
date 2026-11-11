// QR Code em SVG, com a mesma biblioteca que lê os códigos (ZXing): nada a
// mais para instalar. Carrega só quando alguém vai imprimir etiqueta.
// Devolve { tamanho, caminho }: um <path> com um quadradinho por módulo.
export async function qrEmSvg(texto) {
  const { QRCodeWriter, BarcodeFormat, EncodeHintType, QRCodeDecoderErrorCorrectionLevel } = await import('@zxing/library')
  const dicas = new Map([
    [EncodeHintType.MARGIN, 0], // a margem fica por conta da etiqueta
    [EncodeHintType.ERROR_CORRECTION, QRCodeDecoderErrorCorrectionLevel.M],
  ])
  const m = new QRCodeWriter().encode(String(texto), BarcodeFormat.QR_CODE, 0, 0, dicas)
  const tamanho = m.getWidth()
  let caminho = ''
  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      if (m.get(x, y)) caminho += `M${x} ${y}h1v1h-1z`
    }
  }
  return { tamanho, caminho }
}

// Código novo para peça cadastrada sem etiqueta do fornecedor: 13 dígitos
// começando com 2 (faixa de uso interno da loja nos códigos de barras).
export function gerarCodigoDaPeca() {
  const tempo = String(Date.now()).slice(-10)
  const sorte = String(Math.floor(Math.random() * 100)).padStart(2, '0')
  return `2${tempo}${sorte}`
}
