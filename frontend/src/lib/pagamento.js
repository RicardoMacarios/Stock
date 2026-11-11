import { Banknote, CreditCard, QrCode, WalletCards } from 'lucide-react'

// Formas de pagamento da venda. `valor` é o que vai para o banco
// (vendas.forma_pagamento, check na migration 20261111000000).
export const FORMAS_PAGAMENTO = [
  { valor: 'pix', rotulo: 'Pix', Icone: QrCode },
  { valor: 'credito', rotulo: 'Crédito', Icone: CreditCard },
  { valor: 'debito', rotulo: 'Débito', Icone: WalletCards },
  { valor: 'dinheiro', rotulo: 'Dinheiro', Icone: Banknote },
]

export const rotuloPagamento = (valor) => FORMAS_PAGAMENTO.find((f) => f.valor === valor)?.rotulo ?? null
