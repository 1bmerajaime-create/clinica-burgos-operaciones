import type { AreaId, MonthlyPoint, SpecialtyId, Transaction } from '../types'
import { formatMonthLabel } from './format'

/** Total del movimiento con IVA incluido (fallback a amount). */
function grossOf(t: Transaction): number {
  return t.grossAmount ?? t.amount
}

export function sumByType(
  transactions: Transaction[],
  type: 'ingreso' | 'gasto' | 'devolucion',
  areaId?: AreaId,
  specialtyId?: SpecialtyId,
): number {
  return transactions
    .filter(
      (t) =>
        t.type === type &&
        (!areaId || t.areaId === areaId) &&
        (!specialtyId || t.specialtyId === specialtyId),
    )
    .reduce((acc, t) => acc + grossOf(t), 0)
}

/** Ingresos menos devoluciones (totales con IVA). */
export function sumNetIngresos(
  transactions: Transaction[],
  areaId?: AreaId,
  specialtyId?: SpecialtyId,
): number {
  return (
    sumByType(transactions, 'ingreso', areaId, specialtyId) -
    sumByType(transactions, 'devolucion', areaId, specialtyId)
  )
}

function accumulateBySide(
  t: Transaction,
  current: { ingresos: number; gastos: number },
) {
  const gross = grossOf(t)
  if (t.type === 'ingreso') current.ingresos += gross
  else if (t.type === 'devolucion') current.ingresos -= gross
  else current.gastos += gross
}

export function filterByArea(
  transactions: Transaction[],
  areaId?: AreaId,
): Transaction[] {
  if (!areaId) return transactions
  return transactions.filter((t) => t.areaId === areaId)
}

export function filterBySpecialty(
  transactions: Transaction[],
  specialtyId?: SpecialtyId,
): Transaction[] {
  if (!specialtyId) return transactions
  return transactions.filter((t) => t.specialtyId === specialtyId)
}

export type ChartGranularity = 'year' | 'semester' | 'quarter' | 'month'

function monthShort(yyyyMm: string): string {
  const raw = formatMonthLabel(yyyyMm).replace(/\.$/, '')
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function monthKeysBetween(startKey: string, endKey: string): string[] {
  const keys: string[] = []
  const [sy, sm] = startKey.split('-').map(Number)
  const [ey, em] = endKey.split('-').map(Number)
  let y = sy
  let m = sm
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return keys
}

export function monthRangeForPeriod(
  period: ChartGranularity,
  semester: 1 | 2,
  quarter: 1 | 2 | 3 | 4,
): { startMonth: number; endMonth: number } {
  if (period === 'semester') {
    return semester === 1
      ? { startMonth: 1, endMonth: 6 }
      : { startMonth: 7, endMonth: 12 }
  }
  if (period === 'quarter') {
    const startMonth = (quarter - 1) * 3 + 1
    return { startMonth, endMonth: startMonth + 2 }
  }
  // year → full year
  return { startMonth: 1, endMonth: 12 }
}

export interface PeriodFilterOptions {
  year: number
  period: ChartGranularity
  month?: number
  semester?: 1 | 2
  quarter?: 1 | 2 | 3 | 4
}

/** Filtra movimientos al año / semestre / trimestre / mes elegido. */
export function filterTransactionsByPeriod(
  transactions: Transaction[],
  options: PeriodFilterOptions,
): Transaction[] {
  const {
    year,
    period,
    month = 1,
    semester = 1,
    quarter = 1,
  } = options

  if (period === 'month') {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    return transactions.filter((t) => t.date.startsWith(prefix))
  }

  const { startMonth, endMonth } = monthRangeForPeriod(
    period,
    semester,
    quarter,
  )
  const startKey = `${year}-${String(startMonth).padStart(2, '0')}`
  const endKey = `${year}-${String(endMonth).padStart(2, '0')}`
  const lastDay = daysInMonth(year, endMonth)
  const start = `${startKey}-01`
  const end = `${endKey}-${String(lastDay).padStart(2, '0')}`

  return transactions.filter((t) => t.date >= start && t.date <= end)
}

/** Años presentes en los movimientos (desc). */
export function availableYears(transactions: Transaction[]): number[] {
  const years = new Set<number>()
  for (const t of transactions) {
    years.add(Number(t.date.slice(0, 4)))
  }
  return Array.from(years).sort((a, b) => b - a)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Serie para el gráfico de evolución.
 * - year: 12 meses del año
 * - semester: 6 meses del semestre elegido
 * - quarter: 3 meses del trimestre elegido
 * - month: días del mes elegido
 */
export function buildChartMonthSeries(
  transactions: Transaction[],
  options: {
    period: ChartGranularity
    year: number
    month?: number
    semester?: 1 | 2
    quarter?: 1 | 2 | 3 | 4
    areaId?: AreaId
    specialtyId?: SpecialtyId
  },
): MonthlyPoint[] {
  const {
    period,
    year,
    month = 1,
    semester = 1,
    quarter = 1,
    areaId,
    specialtyId,
  } = options
  const filtered = filterBySpecialty(filterByArea(transactions, areaId), specialtyId)

  if (period === 'month') {
    const dayTotals = new Map<string, { ingresos: number; gastos: number }>()
    const prefix = `${year}-${String(month).padStart(2, '0')}`

    for (const t of filtered) {
      if (!t.date.startsWith(prefix)) continue
      const key = t.date.slice(0, 10)
      const current = dayTotals.get(key) ?? { ingresos: 0, gastos: 0 }
      accumulateBySide(t, current)
      dayTotals.set(key, current)
    }

    const totalDays = daysInMonth(year, month)
    return Array.from({ length: totalDays }, (_, i) => {
      const day = i + 1
      const key = `${prefix}-${String(day).padStart(2, '0')}`
      const values = dayTotals.get(key) ?? { ingresos: 0, gastos: 0 }
      return {
        month: String(day),
        ingresos: values.ingresos,
        gastos: values.gastos,
        resultado: values.ingresos - values.gastos,
      }
    })
  }

  const totals = new Map<string, { ingresos: number; gastos: number }>()
  for (const t of filtered) {
    const key = t.date.slice(0, 7)
    const current = totals.get(key) ?? { ingresos: 0, gastos: 0 }
    accumulateBySide(t, current)
    totals.set(key, current)
  }

  const { startMonth, endMonth } = monthRangeForPeriod(period, semester, quarter)
  const startKey = `${year}-${String(startMonth).padStart(2, '0')}`
  const endKey = `${year}-${String(endMonth).padStart(2, '0')}`
  const keys = monthKeysBetween(startKey, endKey)

  return keys.map((key) => {
    const values = totals.get(key) ?? { ingresos: 0, gastos: 0 }
    return {
      month: monthShort(key),
      ingresos: values.ingresos,
      gastos: values.gastos,
      resultado: values.ingresos - values.gastos,
    }
  })
}

/** @deprecated use buildChartMonthSeries */
export function buildPeriodSeries(
  transactions: Transaction[],
  granularity: ChartGranularity = 'year',
  areaId?: AreaId,
): MonthlyPoint[] {
  const years = availableYears(transactions)
  const year = years[0] ?? new Date().getFullYear()
  return buildChartMonthSeries(transactions, {
    period: granularity === 'month' ? 'year' : granularity,
    year,
    semester: 1,
    quarter: 1,
    areaId,
  })
}

/** Evolución mes a mes (desde el primer movimiento al último). */
export function buildMonthlySeries(
  transactions: Transaction[],
  areaId?: AreaId,
  specialtyId?: SpecialtyId,
): MonthlyPoint[] {
  const filtered = filterBySpecialty(filterByArea(transactions, areaId), specialtyId)
  const totals = new Map<string, { ingresos: number; gastos: number }>()

  for (const t of filtered) {
    const key = t.date.slice(0, 7)
    const current = totals.get(key) ?? { ingresos: 0, gastos: 0 }
    accumulateBySide(t, current)
    totals.set(key, current)
  }

  const present = Array.from(totals.keys()).sort()
  if (present.length === 0) return []

  return monthKeysBetween(present[0], present[present.length - 1]).map((key) => {
    const values = totals.get(key) ?? { ingresos: 0, gastos: 0 }
    return {
      month: `${monthShort(key)} ’${key.slice(2, 4)}`,
      ingresos: values.ingresos,
      gastos: values.gastos,
      resultado: values.ingresos - values.gastos,
    }
  })
}

export function productSaleProfit(sale: {
  quantity: number
  unitCost: number
  unitSalePrice: number
}): number {
  return (sale.unitSalePrice - sale.unitCost) * sale.quantity
}

export function areaBreakdown(transactions: Transaction[]) {
  const areas: AreaId[] = ['clinica', 'quiron', 'cataratas', 'otros']

  return areas.map((id) => {
    const ingresos = sumNetIngresos(transactions, id)
    const gastos = sumByType(transactions, 'gasto', id)
    return {
      areaId: id,
      ingresos,
      gastos,
      resultado: ingresos - gastos,
    }
  })
}

export function toMonthKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function previousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return toMonthKey(d)
}

export function sumForMonth(
  transactions: Transaction[],
  monthKey: string,
  type?: 'ingreso' | 'gasto' | 'devolucion',
  areaId?: AreaId,
): number {
  return transactions
    .filter((t) => t.date.startsWith(monthKey))
    .filter((t) => (!type || t.type === type) && (!areaId || t.areaId === areaId))
    .reduce((acc, t) => acc + grossOf(t), 0)
}

export type CompareMode = 'month' | 'year'

function resultadoForMonth(
  transactions: Transaction[],
  monthKey: string,
  areaId: AreaId,
): number {
  return (
    sumForMonth(transactions, monthKey, 'ingreso', areaId) -
    sumForMonth(transactions, monthKey, 'devolucion', areaId) -
    sumForMonth(transactions, monthKey, 'gasto', areaId)
  )
}

/** Resultado acumulado de enero a `throughMonth` (1-12) del año dado */
export function resultadoYtd(
  transactions: Transaction[],
  year: number,
  throughMonth: number,
  areaId: AreaId,
): number {
  let total = 0
  for (let m = 1; m <= throughMonth; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    total += resultadoForMonth(transactions, key, areaId)
  }
  return total
}

export function areaPeriodComparison(
  transactions: Transaction[],
  mode: CompareMode = 'month',
  refDate: Date = new Date(),
) {
  const areas: AreaId[] = ['clinica', 'quiron', 'cataratas', 'otros']
  const currentMonth = toMonthKey(refDate)
  const year = refDate.getFullYear()
  const monthNum = refDate.getMonth() + 1

  const prevKey =
    mode === 'month'
      ? previousMonthKey(currentMonth)
      : `${year - 1}-${String(monthNum).padStart(2, '0')}`

  const currentLabelKey = currentMonth
  const prevLabelKey =
    mode === 'month' ? prevKey : `${year - 1}-01` /* YTD start hint */

  return {
    mode,
    currentMonth,
    prevMonth: mode === 'month' ? prevKey : `${year - 1}-${String(monthNum).padStart(2, '0')}`,
    currentLabelKey,
    prevLabelKey,
    year,
    prevYear: year - 1,
    throughMonth: monthNum,
    rows: areas.map((areaId) => {
      const resultadoNow =
        mode === 'month'
          ? resultadoForMonth(transactions, currentMonth, areaId)
          : resultadoYtd(transactions, year, monthNum, areaId)
      const resultadoPrev =
        mode === 'month'
          ? resultadoForMonth(transactions, prevKey, areaId)
          : resultadoYtd(transactions, year - 1, monthNum, areaId)
      const delta = resultadoNow - resultadoPrev
      const deltaPct =
        resultadoPrev === 0
          ? resultadoNow === 0
            ? 0
            : null
          : (delta / Math.abs(resultadoPrev)) * 100

      return {
        areaId,
        resultadoNow,
        resultadoPrev,
        delta,
        deltaPct,
      }
    }),
  }
}

/** @deprecated prefer areaPeriodComparison */
export function areaMonthOverMonth(
  transactions: Transaction[],
  currentMonth = toMonthKey(),
) {
  const [y, m] = currentMonth.split('-').map(Number)
  return areaPeriodComparison(transactions, 'month', new Date(y, m - 1, 1))
}

export function specialtyBreakdown(
  transactions: Transaction[],
  areaId: AreaId,
) {
  const specialties: SpecialtyId[] = ['oftalmologia', 'estetica', 'otros']
  const inArea = filterByArea(transactions, areaId)

  return specialties.map((id) => {
    const subset = filterBySpecialty(inArea, id)
    const ingresos = sumNetIngresos(subset)
    const gastos = sumByType(subset, 'gasto')
    return {
      specialtyId: id,
      ingresos,
      gastos,
      resultado: ingresos - gastos,
    }
  })
}

export function recentTransactions(
  transactions: Transaction[],
  limit = 8,
  areaId?: AreaId,
): Transaction[] {
  return filterByArea(transactions, areaId)
    .slice()
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, limit)
}
