import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import {
  usePeriodFilters,
  type PeriodFilterState,
  type Quarter,
  type Semester,
} from '../hooks/usePeriodFilters'
import {
  filterTransactionsByPeriod,
  type ChartGranularity,
} from '../lib/analytics'
import type { Transaction } from '../types'
import { useFinance } from './FinanceContext'

interface PeriodFilterContextValue {
  state: PeriodFilterState
  years: number[]
  defaultYear: number
  setYear: (year: number) => void
  setPeriod: (period: ChartGranularity) => void
  setSemester: (semester: Semester) => void
  setQuarter: (quarter: Quarter) => void
  setMonth: (month: number) => void
  /** Aplica el periodo global a cualquier lista de movimientos. */
  filterPeriod: (transactions: Transaction[]) => Transaction[]
  /** Resumen corto para el header (p.ej. «2026 · Año»). */
  summary: string
}

const PeriodFilterContext = createContext<PeriodFilterContextValue | null>(
  null,
)

const PERIOD_LABELS: Record<ChartGranularity, string> = {
  year: 'Año',
  semester: 'Semestre',
  quarter: 'Trimestre',
  month: 'Mensual',
}

const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]

export function PeriodFilterProvider({ children }: { children: ReactNode }) {
  const { transactions } = useFinance()
  const filters = usePeriodFilters(transactions)

  const filterPeriod = useCallback(
    (txs: Transaction[]) =>
      filterTransactionsByPeriod(txs, {
        year: filters.state.year,
        period: filters.state.period,
        semester: filters.state.semester,
        quarter: filters.state.quarter,
        month: filters.state.month,
      }),
    [filters.state],
  )

  const summary = useMemo(() => {
    const { year, period, semester, quarter, month } = filters.state
    const parts = [String(year), PERIOD_LABELS[period]]
    if (period === 'semester') parts.push(`${semester}º sem.`)
    if (period === 'quarter') parts.push(`${quarter}º trim.`)
    if (period === 'month') parts.push(MONTH_LABELS[month - 1] ?? String(month))
    return parts.join(' · ')
  }, [filters.state])

  const value = useMemo(
    () => ({
      state: filters.state,
      years: filters.years,
      defaultYear: filters.defaultYear,
      setYear: filters.setYear,
      setPeriod: filters.setPeriod,
      setSemester: filters.setSemester,
      setQuarter: filters.setQuarter,
      setMonth: filters.setMonth,
      filterPeriod,
      summary,
    }),
    [filters, filterPeriod, summary],
  )

  return (
    <PeriodFilterContext.Provider value={value}>
      {children}
    </PeriodFilterContext.Provider>
  )
}

export function usePeriodFilter() {
  const ctx = useContext(PeriodFilterContext)
  if (!ctx) {
    throw new Error('usePeriodFilter must be used within PeriodFilterProvider')
  }
  return ctx
}
