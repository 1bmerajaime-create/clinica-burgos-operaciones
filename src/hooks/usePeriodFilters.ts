import { useEffect, useMemo, useState } from 'react'
import {
  availableYears,
  filterTransactionsByPeriod,
  type ChartGranularity,
} from '../lib/analytics'
import type { AreaId, Transaction } from '../types'

export type AreaFilter = 'total' | AreaId
export type Semester = 1 | 2
export type Quarter = 1 | 2 | 3 | 4

export interface PeriodFilterState {
  year: number
  period: ChartGranularity
  semester: Semester
  quarter: Quarter
  month: number
  areaFilter: AreaFilter
}

export function usePeriodFilters(
  transactions: Transaction[],
  options?: { withArea?: boolean },
) {
  const withArea = options?.withArea ?? false
  const years = useMemo(() => availableYears(transactions), [transactions])
  const now = new Date()
  const currentYear = now.getFullYear()
  const defaultYear = years.includes(currentYear)
    ? currentYear
    : (years[0] ?? currentYear)

  const [year, setYear] = useState(defaultYear)
  // Por defecto año completo: los movimientos publicados suelen repartirse
  // en varios meses y un filtro mensual vacío parece “sin datos”.
  const [period, setPeriod] = useState<ChartGranularity>('year')
  const [semester, setSemester] = useState<Semester>(() =>
    now.getMonth() < 6 ? 1 : 2,
  )
  const [quarter, setQuarter] = useState<Quarter>(
    () => (Math.floor(now.getMonth() / 3) + 1) as Quarter,
  )
  const [month, setMonth] = useState(() => {
    const latest = [...transactions]
      .map((t) => t.date)
      .filter(Boolean)
      .sort()
      .at(-1)
    if (latest) {
      const m = Number(latest.slice(5, 7))
      if (m >= 1 && m <= 12) return m
    }
    return now.getMonth() + 1
  })
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('total')

  useEffect(() => {
    if (years.length > 0 && !years.includes(year)) {
      setYear(years.includes(currentYear) ? currentYear : years[0])
    }
  }, [years, year, currentYear])

  const state: PeriodFilterState = {
    year,
    period,
    semester,
    quarter,
    month,
    areaFilter,
  }

  const periodFiltered = useMemo(
    () =>
      filterTransactionsByPeriod(transactions, {
        year,
        period,
        semester,
        quarter,
        month,
      }),
    [transactions, year, period, semester, quarter, month],
  )

  const filtered = useMemo(() => {
    if (!withArea || areaFilter === 'total') return periodFiltered
    return periodFiltered.filter((t) => t.areaId === areaFilter)
  }, [periodFiltered, withArea, areaFilter])

  const resolvedAreaId =
    withArea && areaFilter !== 'total' ? areaFilter : undefined

  return {
    state,
    years,
    defaultYear,
    withArea,
    setYear,
    setPeriod,
    setSemester,
    setQuarter,
    setMonth,
    setAreaFilter,
    /** Movimientos del periodo (y área si aplica en dashboard). */
    filtered,
    /** Solo periodo, sin filtro de área (para cards por rama). */
    periodFiltered,
    resolvedAreaId,
  }
}
