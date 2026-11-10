// Marca do sistema. Original em docs/marca/stock-logo.png; aqui ela é
// redesenhada em SVG para ficar nítida em qualquer tamanho e seguir o tema
// (o verde é a cor de acento; num cliente, vira a cor dele).

// Símbolo: o logo do cliente, quando houver; senão a caixa com a prancheta.
export default function Marca({ logo, tamanho = 40 }) {
  if (logo) {
    return <img src={logo} alt="" width={tamanho} height={tamanho} className="shrink-0 rounded-lg object-contain" />
  }
  return (
    <svg viewBox="0 0 64 64" width={tamanho} height={tamanho} aria-hidden className="shrink-0">
      {/* Arco que envolve a caixa */}
      <g fill="none" strokeLinecap="round" className="stroke-acento">
        <path d="M5 38 C 0 52, 14 60, 34 56" strokeWidth="3.5" />
        <path d="M36 7 C 50 4, 58 9, 53 21" strokeWidth="2.5" />
      </g>
      {/* Caixa */}
      <g fill="none" strokeWidth="2.5" strokeLinejoin="round" className="stroke-texto">
        <path d="M6 18 L26 9 L46 18 L26 27 Z" />
        <path d="M6 18 V42 L26 51 V27" />
        <path d="M46 18 V30" />
      </g>
      <path d="M14 21.6 L34 12.6 L38 14.4 L18 23.4 Z" className="fill-acento" />
      {/* Prancheta com a lista conferida */}
      <rect x="34" y="30" width="24" height="30" rx="3.5" strokeWidth="2.5" className="fill-fundo stroke-texto" />
      <rect x="41" y="27" width="10" height="6" rx="2" strokeWidth="2" className="fill-fundo stroke-texto" />
      <g fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M38.5 39.5 l2 2 l3.5 -4 M38.5 46.5 l2 2 l3.5 -4 M38.5 53.5 l2 2 l3.5 -4" className="stroke-acento" />
        <path d="M47 40 H53 M47 47 H53 M47 54 H53" className="stroke-texto" />
      </g>
    </svg>
  )
}

// Logotipo completo: símbolo + "Stock" (o "k" na cor de acento) + slogan.
// `empilhado`: símbolo em cima e texto centralizado embaixo (topo do celular).
export function Logotipo({ tamanho = 44, slogan = false, empilhado = false }) {
  return (
    <div className={empilhado ? 'flex flex-col items-center gap-4 text-center' : 'flex items-center gap-3'}>
      <Marca tamanho={tamanho} />
      <div className="leading-none">
        <span className="block font-extrabold tracking-tight"
          style={{ fontSize: empilhado ? tamanho * 0.5 : tamanho * 0.62 }}>
          Stoc<span className="text-acento">k</span>
        </span>
        {slogan && (
          <span className="mt-2 block text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-texto-2">
            Controle <span className="text-acento">•</span> Organização <span className="text-acento">•</span> Eficiência
          </span>
        )}
      </div>
    </div>
  )
}
