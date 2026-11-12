// Quadrinho de número do topo das telas (Produtos, Clientes, Condicional):
// ícone + rótulo + valor.
//
// No celular o quadro é estreito (2 por linha): o ícone fica em cima e o texto
// ganha a largura toda. Nada é cortado com "…" — se não couber, quebra a linha
// (antes "R$ 147.…" e "Estoque a pre…" sumiam). Do sm para cima, ícone ao lado.
export default function NumeroResumo({ icone: Icone, rotulo, valor, chip = 'bg-acento/12 text-acento', className = '' }) {
  return (
    <div className={`flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-borda bg-card p-3.5 sm:flex-row sm:items-center sm:gap-3 sm:p-4 ${className}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10 ${chip}`}><Icone size={18} aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-xs leading-snug text-texto-3">{rotulo}</p>
        <p className="break-words text-lg font-bold leading-tight tabular-nums">{valor}</p>
      </div>
    </div>
  )
}
