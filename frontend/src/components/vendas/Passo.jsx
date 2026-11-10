// Título numerado de etapa (1. Quem vendeu? · 2. Peças…), com ação opcional à direita.
export default function Passo({ numero, titulo, extra }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-acento/15 text-xs text-acento">{numero}</span>
        {titulo}
      </h2>
      {extra}
    </div>
  )
}
