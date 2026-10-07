import type { Transaction, TransactionType } from '../types'

/** IVA sobre el neto en ingresos. */
export const INCOME_VAT_RATE = 0.15

/** IVA sobre el neto en gastos. */
export const EXPENSE_VAT_RATE = 0.21

export interface VatBreakdown {
  netAmount: number
  vatAmount: number
  grossAmount: number
}

export function vatRateFor(type: TransactionType): number {
  return type === 'ingreso' ? INCOME_VAT_RATE : EXPENSE_VAT_RATE
}

export function vatFromNet(
  net: number,
  type: TransactionType,
): VatBreakdown {
  const rate = vatRateFor(type)
  const netAmount = roundMoney(net)
  const vatAmount = roundMoney(netAmount * rate)
  const grossAmount = roundMoney(netAmount + vatAmount)
  return { netAmount, vatAmount, grossAmount }
}

/** @deprecated Prefer vatFromNet(net, 'ingreso') */
export function incomeVatFromNet(net: number): VatBreakdown {
  return vatFromNet(net, 'ingreso')
}

function vatOf(tx: Transaction): number {
  if (tx.vatAmount != null) return tx.vatAmount
  return vatFromNet(tx.netAmount ?? tx.amount, tx.type).vatAmount
}

/**
 * Estimación IVA: devengado (ingresos) − pagado/soportado (gastos).
 * Positivo → a pagar; negativo → a favor.
 */
export function estimateVatPosition(transactions: Transaction[]) {
  let accrued = 0
  let paid = 0
  for (const tx of transactions) {
    const vat = vatOf(tx)
    if (tx.type === 'ingreso') accrued += vat
    else paid += vat
  }
  accrued = roundMoney(accrued)
  paid = roundMoney(paid)
  return {
    accrued,
    paid,
    net: roundMoney(accrued - paid),
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
