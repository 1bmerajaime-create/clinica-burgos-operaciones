import type {
  AreaId,
  SpecialtyId,
  Transaction,
  TransactionType,
} from '../types'

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
  return type === 'gasto'
    ? DEFAULT_EXPENSE_VAT_RATE
    : DEFAULT_INCOME_VAT_RATE
}

/**
 * Defaults de IVA al crear un movimiento.
 * - Ingreso/devolución Clínica + Oftalmología → exento
 * - Ingreso/devolución Clínica + Medicina estética → 21 %
 * - Resto igual que antes (ingreso/devolución 15 %, gasto 21 %)
 */
export function defaultVatSettings(input: {
  type: TransactionType
  areaId?: AreaId
  specialtyId?: SpecialtyId | '' | null
}): { vatExempt: boolean; vatRate: number } {
  if (input.type === 'gasto') {
    return { vatExempt: false, vatRate: DEFAULT_EXPENSE_VAT_RATE }
  }

  if (input.areaId === 'clinica' && input.specialtyId === 'oftalmologia') {
    return { vatExempt: true, vatRate: DEFAULT_INCOME_VAT_RATE }
  }

  if (input.areaId === 'clinica' && input.specialtyId === 'estetica') {
    return { vatExempt: false, vatRate: DEFAULT_EXPENSE_VAT_RATE }
  }

  return { vatExempt: false, vatRate: DEFAULT_INCOME_VAT_RATE }
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
 * Resuelve base / IVA / bruto.
 *
 * Modo total (por defecto): IVA = total × tipo · Base = total − IVA.
 *   (p.ej. 389,01 × 21 % = 81,69 · base 307,32)
 * Modo base: IVA = base × tipo · Total = base + IVA.
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
    const vatAmount = roundMoney(amount * vatRate)
    const netAmount = roundMoney(amount - vatAmount)
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
 * Recalcula tomando el importe del movimiento como TOTAL.
 * Conserva el total; IVA = total × tipo · Base = total − IVA.
 */
export function reinterpretAsVatFromTotal(tx: Transaction): Transaction {
  const exempt = Boolean(tx.vatExempt) || tx.vatRate === 0
  const vatRate = exempt
    ? 0
    : normalizeVatRateFraction(tx.vatRate ?? defaultVatRateFor(tx.type))

  // Preferir el total bruto guardado; si no, el importe introducido.
  const totalFigure =
    tx.grossAmount ??
    (tx.amountIncludesVat === false
      ? roundMoney(
          (tx.netAmount ?? tx.amount) *
            (1 + (vatRate || 0)),
        )
      : tx.amount)

  const breakdown = resolveVatAmounts({
    amount: totalFigure,
    vatRate,
    amountIncludesVat: true,
  })

  return {
    ...tx,
    ...breakdown,
    amount: breakdown.netAmount,
    vatExempt: exempt,
    vatRate,
    amountIncludesVat: true,
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
  // Por defecto el importe es el total con IVA incluido
  const includesVat = tx.amountIncludesVat !== false
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
    const sign =
      type === 'ingreso'
        ? tx.type === 'ingreso'
          ? 1
          : tx.type === 'devolucion'
            ? -1
            : 0
        : tx.type === type
          ? 1
          : 0
    if (sign === 0) continue
    const b = txBreakdown(tx)
    base += sign * b.netAmount
    vat += sign * b.vatAmount
    total += sign * b.grossAmount
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
    } else if (tx.type === 'devolucion') {
      incomeBase -= b.netAmount
      repercutido -= b.vatAmount
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

  // Por defecto el importe introducido es el total con IVA incluido
  const amountIncludesVat = tx.amountIncludesVat !== false

  const breakdown = resolveVatAmounts({
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
