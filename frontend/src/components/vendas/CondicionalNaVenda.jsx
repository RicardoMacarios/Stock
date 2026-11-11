import { Link } from 'react-router-dom'
import { CalendarDays, Check, ShoppingBag } from 'lucide-react'
import { dinheiro, quantidade as fmtQtd } from '@/lib/formato'
import { dataCurta, prazo, totaisDoCondicional } from '@/pages/condicional/dados'

const SELO_PRAZO = {
  atrasado: 'bg-danger/12 text-danger',
  hoje: 'bg-warn/12 text-warn',
  ok: 'bg-elevado text-texto-2',
}

// No caixa, quando o cliente escolhido tem um condicional em aberto: mostra
// as peças e o valor e pergunta se cobra junto ou só o que ele leva hoje.
// `juntar`: null (não escolheu) | true | false.
export default function CondicionalNaVenda({ cond, juntar, aoEscolher, slug }) {
  const t = totaisDoCondicional(cond)
  const p = prazo(cond)
  return (
    <div className="border-b border-borda p-4 md:p-5">
      <div className={`rounded-2xl border p-4 ${juntar === null ? 'border-warn/50 bg-warn/5' : 'border-borda bg-fundo/40'}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShoppingBag size={16} className="text-acento" aria-hidden /> Condicional em aberto
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-texto-3">
              <CalendarDays size={12} aria-hidden /> pegou {dataCurta(cond.saiu_em)}
              {cond.vendedor_nome && ` · ${cond.vendedor_nome}`}
            </p>
          </div>
          <div className="text-right">
            {p && <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${SELO_PRAZO[p.tipo]}`}>{p.texto}</span>}
            <p className="mt-1 text-xs text-texto-3">{fmtQtd(t.pecas)} peça{t.pecas === 1 ? '' : 's'}</p>
            <p className="font-semibold tabular-nums">{dinheiro(t.valor)}</p>
          </div>
        </div>

        <ul className="mt-2 space-y-0.5 text-xs text-texto-2">
          {(cond.itens ?? []).map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span className="truncate">{fmtQtd(i.quantidade)}× {i.produto_nome}</span>
              <span className="shrink-0 tabular-nums text-texto-3">{dinheiro(Number(i.quantidade) * Number(i.preco_unitario))}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Opcao ativo={juntar === true} onClick={() => aoEscolher(true)}>
            Cobrar junto <span className="font-normal text-texto-3">(+ {dinheiro(t.valor)})</span>
          </Opcao>
          <Opcao ativo={juntar === false} onClick={() => aoEscolher(false)}>Só as peças de hoje</Opcao>
        </div>
        {juntar === true && (
          <p className="mt-2 text-xs text-texto-3">
            O condicional fecha com todas as peças compradas. Se ele devolveu alguma,{' '}
            <Link to={`/${slug}/condicional`} className="text-acento hover:underline">faça o acerto em Condicional</Link>.
          </p>
        )}
        {juntar === false && <p className="mt-2 text-xs text-texto-3">O condicional continua em aberto.</p>}
      </div>
    </div>
  )
}

function Opcao({ ativo, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm transition ${
        ativo ? 'border-acento bg-acento/10 font-semibold text-texto' : 'border-borda text-texto-2 hover:border-borda-forte hover:bg-elevado'
      }`}>
      {ativo && <Check size={14} className="text-acento" aria-hidden />}
      {children}
    </button>
  )
}
