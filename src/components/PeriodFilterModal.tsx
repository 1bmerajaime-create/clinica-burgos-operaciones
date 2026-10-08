import { useId } from 'react'
import type { ChartGranularity } from '../lib/analytics'
import { usePeriodFilter } from '../context/PeriodFilterContext'
import type { Quarter, Semester } from '../hooks/usePeriodFilters'
import { Button, Dialog, Label, Select } from './ui'

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

interface Props {
  open: boolean
  onClose: () => void
}

export function PeriodFilterModal({ open, onClose }: Props) {
  const uid = useId().replace(/:/g, '')
  const {
    state,
    years,
    defaultYear,
    setYear,
    setPeriod,
    setSemester,
    setQuarter,
    setMonth,
  } = usePeriodFilter()

  const { year, period, semester, quarter, month } = state

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Vista temporal"
      title="Filtros de periodo"
      footer={
        <Button type="button" className="w-full" onClick={onClose}>
          Aplicar
        </Button>
      }
    >
      <p className="mb-4 text-[12px] leading-relaxed text-ink-muted">
        Estos filtros se aplican a todas las pantallas: resumen, ramas,
        especialidades y movimientos.
      </p>

      <div className="space-y-3">
        <div>
          <Label htmlFor={`global-year-${uid}`}>Año</Label>
          <Select
            id={`global-year-${uid}`}
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
          <Label htmlFor={`global-period-${uid}`}>Periodo</Label>
          <Select
            id={`global-period-${uid}`}
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

        {period === 'semester' && (
          <div>
            <Label htmlFor={`global-semester-${uid}`}>Semestre</Label>
            <Select
              id={`global-semester-${uid}`}
              value={semester}
              onChange={(e) =>
                setSemester(Number(e.target.value) as Semester)
              }
            >
              {SEMESTERS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        )}

        {period === 'quarter' && (
          <div>
            <Label htmlFor={`global-quarter-${uid}`}>Trimestre</Label>
            <Select
              id={`global-quarter-${uid}`}
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

        {period === 'month' && (
          <div>
            <Label htmlFor={`global-month-${uid}`}>Mes</Label>
            <Select
              id={`global-month-${uid}`}
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
      </div>
    </Dialog>
  )
}
