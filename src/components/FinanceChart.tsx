import { useEffect, useId, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  availableYears,
  buildChartMonthSeries,
  type ChartGranularity,
} from '../lib/analytics'
import { formatCurrencyPrecise } from '../lib/format'
import type { AreaId, SpecialtyId, Transaction } from '../types'
import { Card, Label, Select } from './ui'

const INCOME_COLOR = '#5F8F5A'
const EXPENSE_COLOR = '#C45C5C'

type ChartType = 'bar' | 'line'
type AreaFilter = 'total' | AreaId
type Semester = 1 | 2
type Quarter = 1 | 2 | 3 | 4

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: 'bar', label: 'Barras' },
  { id: 'line', label: 'Línea' },
]

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
  { id: 'total', label: 'Total' },
  { id: 'clinica', label: 'Clínica Burgos' },
  { id: 'quiron', label: 'Quirón' },
  { id: 'cataratas', label: 'Cataratas' },
]

interface Props {
  transactions: Transaction[]
  /** Fija el área (detalle de rama) y oculta el filtro de área */
  areaId?: AreaId
  /** Filtra por especialidad (detalle de especialidad) */
  specialtyId?: SpecialtyId
}

export function FinanceChart({
  transactions,
  areaId,
  specialtyId,
}: Props) {
  const uid = useId().replace(/:/g, '')
  const fillIngresosId = `fillIngresos-${uid}`
  const fillGastosId = `fillGastos-${uid}`

  const scopedTx = useMemo(() => {
    if (!areaId && !specialtyId) return transactions
    return transactions.filter(
      (t) =>
        (!areaId || t.areaId === areaId) &&
        (!specialtyId || t.specialtyId === specialtyId),
    )
  }, [transactions, areaId, specialtyId])

  const years = useMemo(() => availableYears(scopedTx), [scopedTx])
  const defaultYear = years[0] ?? new Date().getFullYear()
  const showAreaFilter = !areaId

  const [chartType, setChartType] = useState<ChartType>('line')
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('total')
  const [year, setYear] = useState(defaultYear)
  const [period, setPeriod] = useState<ChartGranularity>('year')
  const [semester, setSemester] = useState<Semester>(1)
  const [quarter, setQuarter] = useState<Quarter>(1)
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)

  useEffect(() => {
    if (years.length > 0 && !years.includes(year)) {
      setYear(years[0])
    }
  }, [years, year])

  const resolvedAreaId = areaId ?? (areaFilter === 'total' ? undefined : areaFilter)

  const data = useMemo(
    () =>
      buildChartMonthSeries(transactions, {
        period,
        year,
        month,
        semester,
        quarter,
        areaId: resolvedAreaId,
        specialtyId,
      }),
    [
      transactions,
      period,
      year,
      month,
      semester,
      quarter,
      resolvedAreaId,
      specialtyId,
    ],
  )

  const showSemester = period === 'semester'
  const showQuarter = period === 'quarter'
  const showMonth = period === 'month'

  const commonAxis = (
    <>
      <CartesianGrid stroke="#E8E0D4" strokeDasharray="3 6" vertical={false} />
      <XAxis
        dataKey="month"
        tick={{ fill: '#8A847C', fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        interval={period === 'month' ? 2 : 0}
        angle={period === 'month' ? 0 : data.length > 6 ? -30 : 0}
        textAnchor={
          period === 'month' ? 'middle' : data.length > 6 ? 'end' : 'middle'
        }
        height={period === 'month' ? 30 : data.length > 6 ? 56 : 30}
        minTickGap={period === 'month' ? 2 : 4}
      />
      <YAxis
        tickFormatter={(v) => {
          const n = Number(v)
          if (Math.abs(n) >= 10_000) {
            return `${(n / 1000).toLocaleString('es-ES', {
              maximumFractionDigits: 1,
            })}k`
          }
          return n.toLocaleString('es-ES', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })
        }}
        tick={{ fill: '#8A847C', fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        width={52}
      />
      <Tooltip
        labelFormatter={(label) =>
          period === 'month' ? `Día ${label}` : String(label)
        }
        formatter={(value, name) => {
          const n = String(name)
          const color = n === 'ingresos' ? INCOME_COLOR : EXPENSE_COLOR
          const label = n === 'ingresos' ? 'Ingresos' : 'Gastos'
          return [
            <span key={n} style={{ color, fontWeight: 600 }}>
              {formatCurrencyPrecise(Number(value))}
            </span>,
            label,
          ]
        }}
        contentStyle={{
          borderRadius: 12,
          border: '1px solid #E8E0D4',
          background: '#FFFCFA',
          fontSize: 12,
        }}
      />
      <Legend
        wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
        formatter={(value) => {
          const isIncome = value === 'ingresos'
          return (
            <span
              style={{
                color: isIncome ? INCOME_COLOR : EXPENSE_COLOR,
                fontWeight: 500,
              }}
            >
              {isIncome ? 'Ingresos' : 'Gastos'}
            </span>
          )
        }}
      />
    </>
  )

  return (
    <Card className="animate-fade-up-delay-2">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <h2 className="font-display text-xl font-medium tracking-tight text-ink md:text-2xl">
          Evolución
        </h2>

        <div className="flex w-full max-w-3xl flex-wrap gap-2 sm:gap-2.5">
          <div className="min-w-[7.5rem] flex-1">
            <Label htmlFor={`chart-type-${uid}`}>Tipo</Label>
            <Select
              id={`chart-type-${uid}`}
              value={chartType}
              onChange={(e) => setChartType(e.target.value as ChartType)}
            >
              {CHART_TYPES.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          {showAreaFilter && (
            <div className="min-w-[8rem] flex-1">
              <Label htmlFor={`chart-area-${uid}`}>Área</Label>
              <Select
                id={`chart-area-${uid}`}
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
          <div className="min-w-[6.5rem] flex-1">
            <Label htmlFor={`chart-year-${uid}`}>Año</Label>
            <Select
              id={`chart-year-${uid}`}
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
          <div className="min-w-[7.5rem] flex-1">
            <Label htmlFor={`chart-period-${uid}`}>Periodo</Label>
            <Select
              id={`chart-period-${uid}`}
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
            <div className="min-w-[8.5rem] flex-1">
              <Label htmlFor={`chart-semester-${uid}`}>Semestre</Label>
              <Select
                id={`chart-semester-${uid}`}
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
          {showQuarter && (
            <div className="min-w-[8.5rem] flex-1">
              <Label htmlFor={`chart-quarter-${uid}`}>Trimestre</Label>
              <Select
                id={`chart-quarter-${uid}`}
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
            <div className="min-w-[8rem] flex-1">
              <Label htmlFor={`chart-month-${uid}`}>Mes</Label>
              <Select
                id={`chart-month-${uid}`}
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
      </div>

      <div className="h-[360px] w-full md:h-[400px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-muted">
            No hay datos para estos filtros.
          </div>
        ) : chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {commonAxis}
              <Bar
                dataKey="ingresos"
                name="ingresos"
                fill={INCOME_COLOR}
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
              />
              <Bar
                dataKey="gastos"
                name="gastos"
                fill={EXPENSE_COLOR}
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={fillIngresosId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={INCOME_COLOR} stopOpacity={0.4} />
                  <stop
                    offset="100%"
                    stopColor={INCOME_COLOR}
                    stopOpacity={0.04}
                  />
                </linearGradient>
                <linearGradient id={fillGastosId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={EXPENSE_COLOR} stopOpacity={0.35} />
                  <stop
                    offset="100%"
                    stopColor={EXPENSE_COLOR}
                    stopOpacity={0.04}
                  />
                </linearGradient>
              </defs>
              {commonAxis}
              <Area
                type="monotone"
                dataKey="ingresos"
                name="ingresos"
                stroke={INCOME_COLOR}
                strokeWidth={2.5}
                fill={`url(#${fillIngresosId})`}
                activeDot={{
                  r: 5,
                  fill: INCOME_COLOR,
                  stroke: '#FFFCFA',
                  strokeWidth: 2,
                }}
              />
              <Area
                type="monotone"
                dataKey="gastos"
                name="gastos"
                stroke={EXPENSE_COLOR}
                strokeWidth={2.5}
                fill={`url(#${fillGastosId})`}
                activeDot={{
                  r: 5,
                  fill: EXPENSE_COLOR,
                  stroke: '#FFFCFA',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
