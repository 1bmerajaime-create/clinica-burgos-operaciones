import type { Transaction, TransactionType } from '../types'

/**
 * Tipos configurables (provisionales, pendientes de validación fiscal).
 * No representan un tipo legal validado.
 */
export const DEFAULT_INCOME_VAT_RATE = 0.15
export const DEFAULT_EXPENSE_VAT_RATE = 0.21

/** @deprecated usar DEFAULT_INCOME_VAT_RATE */
export const INCOME_VAT_RATE = DEFAULT_INCOME_VAT_RATE
/** @deprecated usar DEFAULT_EXPENSE_VAT_RATE */
export const EXPENSE_VAT_RATE = DEFAULT_EXPENSE_VAT_RATE

export type AmountVatMode = 'base' | 'gross'

export interface VatBreakdown {
  /** Base imponible (sin IVA) */
  netAmount: number
  vatAmount: number
  /** Total con IVA */
  grossAmount: number
  vatRate: number
}

export function defaultVatRateFor(type: TransactionType): number {
  return type === 'ingreso'
    ? DEFAULT_INCOME_VAT_RATE
    : DEFAULT_EXPENSE_VAT_RATE
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Normaliza el tipo a fracción (0.15). Si vino como porcentaje (15), lo convierte.
 */
export function normalizeVatRateFraction(rate: number): number {
  if (!Number.isFinite(rate) || rate < 0) return 0
  if (rate > 1) return rate / 100
  return rate
}

/**
 * Resuelve base / IVA / bruto según si el importe introducido
 * incluye IVA o es base, y el tipo aplicado (0 = exento).
 *
 * Con IVA incluido (total): base = total / (1 + tipo), IVA = total − base.
 * Sobre base: IVA = base × tipo, total = base + IVA.
 */
export function resolveVatAmounts(input: {
  amount: number
  vatRate: number
  amountIncludesVat: boolean
}): VatBreakdown {
  const amount = roundMoney(Math.abs(input.amount))
  const vatRate = normalizeVatRateFraction(Math.max(0, input.vatRate))

  if (vatRate === 0 || amount === 0) {
    return {
      netAmount: amount,
      vatAmount: 0,
      grossAmount: amount,
      vatRate: 0,
    }
  }

  if (input.amountIncludesVat) {
    const netAmount = roundMoney(amount / (1 + vatRate))
    const vatAmount = roundMoney(amount - netAmount)
    return {
      netAmount,
      vatAmount,
      grossAmount: amount,
      vatRate,
    }
  }

  const netAmount = amount
  const vatAmount = roundMoney(netAmount * vatRate)
  const grossAmount = roundMoney(netAmount + vatAmount)
  return { netAmount, vatAmount, grossAmount, vatRate }
}

/**
 * Recalcula el desglose aplicando el % sobre el importe (base):
 * IVA = importe × tipo · Total = importe + IVA.
 * Si venía en modo «total con IVA», toma ese total como el importe base.
 */
export function reinterpretAsNetBase(tx: Transaction): Transaction {
  const exempt = Boolean(tx.vatExempt) || tx.vatRate === 0
  const vatRate = exempt
    ? 0
    : normalizeVatRateFraction(tx.vatRate ?? defaultVatRateFor(tx.type))

  const baseFigure =
    tx.amountIncludesVat === true
      ? (tx.grossAmount ?? tx.amount)
      : (tx.netAmount ?? tx.amount)

  const breakdown = resolveVatAmounts({
    amount: baseFigure,
    vatRate,
    amountIncludesVat: false,
  })

  return {
    ...tx,
    ...breakdown,
    amount: breakdown.netAmount,
    vatExempt: exempt,
    vatRate,
    amountIncludesVat: false,
  }
}

/** Compat: calcula IVA sobre base con el tipo por defecto del movimiento. */
export function vatFromNet(
  net: number,
  type: TransactionType,
  vatRate = defaultVatRateFor(type),
): VatBreakdown {
  return resolveVatAmounts({
    amount: net,
    vatRate,
    amountIncludesVat: false,
  })
}

export function vatRateFor(type: TransactionType): number {
  return defaultVatRateFor(type)
}

export function formatVatPercent(rate: number): string {
  const pct = rate * 100
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, '')
}

function txVatRate(tx: Transaction): number {
  if (tx.vatExempt) return 0
  if (tx.vatRate != null) return normalizeVatRateFraction(tx.vatRate)
  return defaultVatRateFor(tx.type)
}

function txBreakdown(tx: Transaction): VatBreakdown {
  if (
    tx.netAmount != null &&
    tx.vatAmount != null &&
    tx.grossAmount != null
  ) {
    return {
      netAmount: tx.netAmount,
      vatAmount: tx.vatAmount,
      grossAmount: tx.grossAmount,
      vatRate: txVatRate(tx),
    }
  }
  // Por defecto el importe es la base: IVA = importe × tipo
  const includesVat = tx.amountIncludesVat === true
  return resolveVatAmounts({
    amount: includesVat
      ? (tx.grossAmount ?? tx.amount)
      : (tx.netAmount ?? tx.amount),
    vatRate: txVatRate(tx),
    amountIncludesVat: includesVat,
  })
}

/** Parte deducible del IVA soportado (gastos). Por defecto 100 % si no se indica. */
export function deductibleVatOf(tx: Transaction): number {
  if (tx.type !== 'gasto') return 0
  const { vatAmount } = txBreakdown(tx)
  if (vatAmount <= 0) return 0
  if (tx.vatDeductible === false) return 0
  const share =
    tx.vatDeductibleShare != null
      ? Math.min(1, Math.max(0, tx.vatDeductibleShare))
      : 1
  return roundMoney(vatAmount * share)
}

export interface VatEstimate {
  /** Ingresos sin IVA (bases) */
  incomeBase: number
  /** Gastos sin IVA (bases) */
  expenseBase: number
  /** IVA incluido en ingresos */
  repercutido: number
  /** IVA incluido en gastos (total) */
  soportado: number
  /** Parte del IVA de gastos que se puede descontar */
  soportadoDeducible: number
  /** Repercutido − soportado deducible (+ a pagar / − a favor) */
  resultado: number
}

/** Suma base / IVA / total de un conjunto de movimientos (un tipo). */
export function sumAmountBreakdown(
  transactions: Transaction[],
  type: TransactionType,
): { base: number; vat: number; total: number } {
  let base = 0
  let vat = 0
  let total = 0
  for (const tx of transactions) {
    if (tx.type !== type) continue
    const b = txBreakdown(tx)
    base += b.netAmount
    vat += b.vatAmount
    total += b.grossAmount
  }
  return {
    base: roundMoney(base),
    vat: roundMoney(vat),
    total: roundMoney(total),
  }
}

/**
 * Posición IVA estimada.
 * Los balances de resultado usan bases sin IVA; el IVA no se trata como beneficio.
 */
export function estimateVatPosition(transactions: Transaction[]): VatEstimate {
  let incomeBase = 0
  let expenseBase = 0
  let repercutido = 0
  let soportado = 0
  let soportadoDeducible = 0

  for (const tx of transactions) {
    const b = txBreakdown(tx)
    if (tx.type === 'ingreso') {
      incomeBase += b.netAmount
      repercutido += b.vatAmount
    } else {
      expenseBase += b.netAmount
      soportado += b.vatAmount
      soportadoDeducible += deductibleVatOf(tx)
    }
  }

  return {
    incomeBase: roundMoney(incomeBase),
    expenseBase: roundMoney(expenseBase),
    repercutido: roundMoney(repercutido),
    soportado: roundMoney(soportado),
    soportadoDeducible: roundMoney(soportadoDeducible),
    resultado: roundMoney(repercutido - soportadoDeducible),
  }
}

/** Normaliza un movimiento con campos IVA coherentes. */
export function normalizeVatTransaction<T extends {
  type: TransactionType
  amount: number
  netAmount?: number
  vatAmount?: number
  grossAmount?: number
  vatRate?: number
  vatExempt?: boolean
  amountIncludesVat?: boolean
  vatDeductible?: boolean
  vatDeductibleShare?: number
}>(tx: T): T & VatBreakdown {
  const exempt = Boolean(tx.vatExempt) || tx.vatRate === 0
  const vatRate = exempt
    ? 0
    : normalizeVatRateFraction(tx.vatRate ?? defaultVatRateFor(tx.type))

  // Por defecto el importe introducido es la base (IVA = importe × tipo)
  const amountIncludesVat = tx.amountIncludesVat === true

  const hasComplete =
    tx.netAmount != null && tx.vatAmount != null && tx.grossAmount != null

  const breakdown = hasComplete
    ? {
        netAmount: roundMoney(tx.netAmount!),
        vatAmount: roundMoney(tx.vatAmount!),
        grossAmount: roundMoney(tx.grossAmount!),
        vatRate,
      }
    : resolveVatAmounts({
        amount: amountIncludesVat
          ? (tx.grossAmount ?? tx.amount)
          : (tx.netAmount ?? tx.amount),
        vatRate,
        amountIncludesVat,
      })

  const deductible =
    tx.type === 'gasto'
      ? tx.vatDeductible !== false && !exempt
      : undefined

  return {
    ...tx,
    amount: breakdown.netAmount,
    ...breakdown,
    vatExempt: exempt,
    vatRate,
    amountIncludesVat,
    vatDeductible: deductible,
    vatDeductibleShare:
      tx.type === 'gasto'
        ? tx.vatDeductibleShare != null
          ? Math.min(1, Math.max(0, tx.vatDeductibleShare))
          : deductible
            ? 1
            : 0
        : undefined,
  }
}
