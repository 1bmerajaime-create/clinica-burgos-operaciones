import { useId, useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import type { ChartGranularity } from '../lib/analytics'
import type {
  AreaFilter,
  PeriodFilterState,
  Quarter,
  Semester,
} from '../hooks/usePeriodFilters'
import { Button, Card, Dialog, Label, Select } from './ui'

const PERIODS: { id: ChartGranularity; label: string }[] = [
  { id: 'year', label: 'Año' },
  { id: 'semester', label: 'Semestre' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'month', label: 'Mensual' },
]

const SEMESTERS: { id: Semester; label: string }[] = [
  { id: 1, label: '1º semestre' },
  { id: 2, label: '2º semestre' },
]

const QUARTERS: { id: Quarter; label: string }[] = [
  { id: 1, label: '1º trimestre' },
  { id: 2, label: '2º trimestre' },
  { id: 3, label: '3º trimestre' },
  { id: 4, label: '4º trimestre' },
]

const MONTHS: { id: number; label: string }[] = [
  { id: 1, label: 'Enero' },
  { id: 2, label: 'Febrero' },
  { id: 3, label: 'Marzo' },
  { id: 4, label: 'Abril' },
  { id: 5, label: 'Mayo' },
  { id: 6, label: 'Junio' },
  { id: 7, label: 'Julio' },
  { id: 8, label: 'Agosto' },
  { id: 9, label: 'Septiembre' },
  { id: 10, label: 'Octubre' },
  { id: 11, label: 'Noviembre' },
  { id: 12, label: 'Diciembre' },
]

const AREA_FILTERS: { id: AreaFilter; label: string }[] = [
  { id: 'total', label: 'Todas las áreas' },
  { id: 'clinica', label: 'Clínica Burgos' },
  { id: 'quiron', label: 'Quirón' },
  { id: 'cataratas', label: 'Cataratas' },
]

interface Props {
  state: PeriodFilterState
  years: number[]
  defaultYear: number
  showArea?: boolean
  setYear: (year: number) => void
  setPeriod: (period: ChartGranularity) => void
  setSemester: (semester: Semester) => void
  setQuarter: (quarter: Quarter) => void
  setMonth: (month: number) => void
  setAreaFilter?: (area: AreaFilter) => void
  resultCount?: number
}

export function PeriodFilterBar({
  state,
  years,
  defaultYear,
  showArea = false,
  setYear,
  setPeriod,
  setSemester,
  setQuarter,
  setMonth,
  setAreaFilter,
  resultCount,
}: Props) {
  const uid = useId().replace(/:/g, '')
  const [open, setOpen] = useState(false)

  const { year, period, semester, quarter, month, areaFilter } = state
  const showSemester = period === 'semester'
  const showQuarter = period === 'quarter'
  const showMonth = period === 'month'

  const summary = useMemo(() => {
    const parts = [
      showArea
        ? AREA_FILTERS.find((o) => o.id === areaFilter)?.label
        : null,
      String(year),
      PERIODS.find((o) => o.id === period)?.label,
      showSemester
        ? SEMESTERS.find((o) => o.id === semester)?.label
        : null,
      showQuarter ? QUARTERS.find((o) => o.id === quarter)?.label : null,
      showMonth ? MONTHS.find((o) => o.id === month)?.label : null,
    ].filter(Boolean)
    return parts.join(' · ')
  }, [
    showArea,
    areaFilter,
    year,
    period,
    showSemester,
    semester,
    showQuarter,
    quarter,
    showMonth,
    month,
  ])

  const fields = (
    <>
      {showArea && setAreaFilter && (
        <div>
          <Label htmlFor={`period-area-${uid}`}>Área</Label>
          <Select
            id={`period-area-${uid}`}
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value as AreaFilter)}
          >
            {AREA_FILTERS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div>
        <Label htmlFor={`period-year-${uid}`}>Año</Label>
        <Select
          id={`period-year-${uid}`}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {(years.length > 0 ? years : [defaultYear]).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`period-granularity-${uid}`}>Periodo</Label>
        <Select
          id={`period-granularity-${uid}`}
          value={period}
          onChange={(e) => setPeriod(e.target.value as ChartGranularity)}
        >
          {PERIODS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>
      {showSemester && (
        <div>
          <Label htmlFor={`period-semester-${uid}`}>Semestre</Label>
          <Select
            id={`period-semester-${uid}`}
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value) as Semester)}
          >
            {SEMESTERS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      )}
      {showQuarter && (
        <div>
          <Label htmlFor={`period-quarter-${uid}`}>Trimestre</Label>
          <Select
            id={`period-quarter-${uid}`}
            value={quarter}
            onChange={(e) => setQuarter(Number(e.target.value) as Quarter)}
          >
            {QUARTERS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      )}
      {showMonth && (
        <div>
          <Label htmlFor={`period-month-${uid}`}>Mes</Label>
          <Select
            id={`period-month-${uid}`}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      )}
    </>
  )

  return (
    <Card className="animate-fade-up !p-4 sm:!p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
            Periodo
          </p>
          <h2 className="mt-1 font-display text-xl font-medium tracking-tight text-ink md:text-2xl">
            Filtros
          </h2>
          <p className="mt-1 text-[11px] text-ink-muted md:hidden">{summary}</p>
          {typeof resultCount === 'number' && (
            <p className="mt-1 hidden text-xs text-ink-muted md:block">
              {resultCount} movimiento{resultCount === 1 ? '' : 's'} en este
              periodo
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 !px-3.5 md:hidden"
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontal size={14} />
          Filtros
        </Button>
      </div>

      <div className="mt-4 hidden grid-cols-2 gap-2.5 md:grid lg:flex lg:flex-nowrap lg:items-end lg:gap-2 lg:[&>div]:min-w-0 lg:[&>div]:flex-1">
        {fields}
      </div>

      {typeof resultCount === 'number' && (
        <p className="mt-2 text-xs text-ink-muted md:hidden">
          {resultCount} movimiento{resultCount === 1 ? '' : 's'}
        </p>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Filtros de periodo"
        footer={
          <Button
            type="button"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            Ver resultados
          </Button>
        }
      >
        <div className="space-y-4">{fields}</div>
      </Dialog>
    </Card>
  )
}
