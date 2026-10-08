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
/** Fallback ingresos cuando no hay regla de área/especialidad. */
export const DEFAULT_INCOME_VAT_RATE = 0.21
export const DEFAULT_EXPENSE_VAT_RATE = 0.21
/** Retención habitual en facturas al hospital (Quirón). Es IRPF, no IVA. */
export const DEFAULT_HOSPITAL_IRPF_RATE = 0.15

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
 * - Ingreso/devolución Hospital Quirón → exento (el 15 % es IRPF)
 * - Ingreso/devolución Clínica + Oftalmología → exento
 * - Ingreso/devolución Clínica + Medicina estética → 21 %
 * - Gasto → 21 %
 */
export function defaultVatSettings(input: {
  type: TransactionType
  areaId?: AreaId
  specialtyId?: SpecialtyId | '' | null
}): { vatExempt: boolean; vatRate: number } {
  if (input.type === 'gasto') {
    return { vatExempt: false, vatRate: DEFAULT_EXPENSE_VAT_RATE }
  }

  if (input.areaId === 'quiron') {
    return { vatExempt: true, vatRate: 0 }
  }

  if (input.areaId === 'clinica' && input.specialtyId === 'oftalmologia') {
    return { vatExempt: true, vatRate: 0 }
  }

  if (input.areaId === 'clinica' && input.specialtyId === 'estetica') {
    return { vatExempt: false, vatRate: DEFAULT_EXPENSE_VAT_RATE }
  }

  return { vatExempt: true, vatRate: 0 }
}

/** Defaults de IRPF (retención). Solo ingresos/devoluciones al hospital. */
export function defaultIrpfSettings(input: {
  type: TransactionType
  areaId?: AreaId
}): { irpfRate: number } {
  if (input.type === 'gasto') return { irpfRate: 0 }
  if (input.areaId === 'quiron') {
    return { irpfRate: DEFAULT_HOSPITAL_IRPF_RATE }
  }
  return { irpfRate: 0 }
}

/** IRPF = base × tipo. La base es el importe de la factura (sin IVA). */
export function resolveIrpfAmount(input: {
  baseAmount: number
  irpfRate: number
}): number {
  const base = roundMoney(Math.abs(input.baseAmount))
  const rate = normalizeVatRateFraction(Math.max(0, input.irpfRate))
  if (rate === 0 || base === 0) return 0
  return roundMoney(base * rate)
}

/**
 * Corrige facturas al hospital donde la retención se guardó como IVA.
 * Deja la operación exenta de IVA y registra IRPF 15 %.
 */
export function migrateHospitalVatToIrpf(tx: Transaction): Transaction {
  if (tx.areaId !== 'quiron' || tx.type === 'gasto') return tx

  // Si ya hay campos IRPF (aunque sea 0), no tocar.
  if (tx.irpfAmount != null || tx.irpfRate != null) return tx

  const rate =
    tx.vatRate != null ? normalizeVatRateFraction(tx.vatRate) : undefined
  const isFifteen =
    rate == null || Math.abs(rate - DEFAULT_HOSPITAL_IRPF_RATE) < 0.001

  const gross = roundMoney(
    tx.grossAmount ??
      (tx.vatAmount != null && tx.netAmount != null
        ? tx.netAmount + tx.vatAmount
        : tx.amount),
  )
  const irpfAmount =
    !tx.vatExempt &&
    tx.vatAmount != null &&
    tx.vatAmount > 0 &&
    isFifteen
      ? roundMoney(tx.vatAmount)
      : resolveIrpfAmount({
          baseAmount: gross,
          irpfRate: DEFAULT_HOSPITAL_IRPF_RATE,
        })

  return {
    ...tx,
    vatExempt: true,
    vatRate: 0,
    vatAmount: 0,
    netAmount: gross,
    grossAmount: gross,
    amount: gross,
    amountIncludesVat: true,
    irpfRate: DEFAULT_HOSPITAL_IRPF_RATE,
    irpfAmount,
  }
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

export interface TaxBreakdownLine {
  transactionId: string
  date: string
  description: string
  areaId: AreaId
  type: TransactionType
  /** Importe que aporta al cálculo (con signo) */
  amount: number
  role: 'repercutido' | 'deducible' | 'soportado' | 'irpf'
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
  /** Operaciones que forman el cálculo IVA */
  lines: TaxBreakdownLine[]
}

export interface IrpfEstimate {
  /** Suma de retenciones IRPF (ya retenidos) */
  retenido: number
  /** Operaciones con retención (facturas al hospital) */
  lines: TaxBreakdownLine[]
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
 * Posición IVA estimada (repercutido − soportado deducible).
 * Usa el IVA real de cada factura; no mezcla retenciones IRPF.
 */
export function estimateVatPosition(transactions: Transaction[]): VatEstimate {
  let incomeBase = 0
  let expenseBase = 0
  let repercutido = 0
  let soportado = 0
  let soportadoDeducible = 0
  const lines: TaxBreakdownLine[] = []

  for (const tx of transactions) {
    const b = txBreakdown(tx)
    if (tx.type === 'ingreso') {
      incomeBase += b.netAmount
      repercutido += b.vatAmount
      if (b.vatAmount !== 0) {
        lines.push({
          transactionId: tx.id,
          date: tx.date,
          description: tx.description,
          areaId: tx.areaId,
          type: tx.type,
          amount: b.vatAmount,
          role: 'repercutido',
        })
      }
    } else if (tx.type === 'devolucion') {
      incomeBase -= b.netAmount
      repercutido -= b.vatAmount
      if (b.vatAmount !== 0) {
        lines.push({
          transactionId: tx.id,
          date: tx.date,
          description: tx.description,
          areaId: tx.areaId,
          type: tx.type,
          amount: -b.vatAmount,
          role: 'repercutido',
        })
      }
    } else {
      expenseBase += b.netAmount
      soportado += b.vatAmount
      const deducible = deductibleVatOf(tx)
      soportadoDeducible += deducible
      if (deducible !== 0) {
        lines.push({
          transactionId: tx.id,
          date: tx.date,
          description: tx.description,
          areaId: tx.areaId,
          type: tx.type,
          amount: deducible,
          role: 'deducible',
        })
      } else if (b.vatAmount !== 0) {
        lines.push({
          transactionId: tx.id,
          date: tx.date,
          description: tx.description,
          areaId: tx.areaId,
          type: tx.type,
          amount: b.vatAmount,
          role: 'soportado',
        })
      }
    }
  }

  lines.sort((a, b) => b.date.localeCompare(a.date))

  return {
    incomeBase: roundMoney(incomeBase),
    expenseBase: roundMoney(expenseBase),
    repercutido: roundMoney(repercutido),
    soportado: roundMoney(soportado),
    soportadoDeducible: roundMoney(soportadoDeducible),
    resultado: roundMoney(repercutido - soportadoDeducible),
    lines,
  }
}

function txIrpfAmount(tx: Transaction): number {
  if (tx.irpfAmount != null) return roundMoney(Math.abs(tx.irpfAmount))
  const rate =
    tx.irpfRate != null ? normalizeVatRateFraction(tx.irpfRate) : 0
  if (rate <= 0) return 0
  const base = tx.netAmount ?? tx.grossAmount ?? tx.amount
  return resolveIrpfAmount({ baseAmount: base, irpfRate: rate })
}

/**
 * Retenciones IRPF ya practicadas (facturas al hospital).
 * Independiente del IVA: no se suma ni se resta de la posición IVA.
 */
export function estimateIrpfWithheld(transactions: Transaction[]): IrpfEstimate {
  let retenido = 0
  const lines: TaxBreakdownLine[] = []

  for (const tx of transactions) {
    if (tx.areaId !== 'quiron') continue
    if (tx.type !== 'ingreso' && tx.type !== 'devolucion') continue
    const amount = txIrpfAmount(tx)
    if (amount === 0) continue
    const signed = tx.type === 'devolucion' ? -amount : amount
    retenido += signed
    lines.push({
      transactionId: tx.id,
      date: tx.date,
      description: tx.description,
      areaId: tx.areaId,
      type: tx.type,
      amount: signed,
      role: 'irpf',
    })
  }

  lines.sort((a, b) => b.date.localeCompare(a.date))

  return {
    retenido: roundMoney(retenido),
    lines,
  }
}

/** Normaliza un movimiento con campos IVA (e IRPF si vienen) coherentes. */
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
  irpfRate?: number
  irpfAmount?: number
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

  const irpfRateRaw =
    tx.irpfRate != null
      ? normalizeVatRateFraction(Math.max(0, tx.irpfRate))
      : undefined
  let irpfAmount: number | undefined
  let irpfRate: number | undefined
  if (tx.irpfAmount != null && tx.irpfAmount > 0) {
    irpfAmount = roundMoney(Math.abs(tx.irpfAmount))
    irpfRate = irpfRateRaw != null && irpfRateRaw > 0 ? irpfRateRaw : undefined
  } else if (irpfRateRaw != null && irpfRateRaw > 0) {
    irpfRate = irpfRateRaw
    irpfAmount = resolveIrpfAmount({
      baseAmount: breakdown.netAmount,
      irpfRate: irpfRateRaw,
    })
  }

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
    irpfRate,
    irpfAmount,
  }
}
