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
  const defaultYear = years[0] ?? new Date().getFullYear()

  const [year, setYear] = useState(defaultYear)
  const [period, setPeriod] = useState<ChartGranularity>('year')
  const [semester, setSemester] = useState<Semester>(1)
  const [quarter, setQuarter] = useState<Quarter>(1)
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('total')

  useEffect(() => {
    if (years.length > 0 && !years.includes(year)) {
      setYear(years[0])
    }
  }, [years, year])

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
