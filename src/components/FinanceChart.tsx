import { useId, useMemo, useState } from 'react'
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
import { buildChartMonthSeries } from '../lib/analytics'
import { formatCurrencyPrecise } from '../lib/format'
import type { PeriodFilterState } from '../hooks/usePeriodFilters'
import type { AreaId, SpecialtyId, Transaction } from '../types'
import { Card, Label, Select } from './ui'

const INCOME_COLOR = '#5F8F5A'
const EXPENSE_COLOR = '#C45C5C'

type ChartType = 'bar' | 'line'

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: 'bar', label: 'Barras' },
  { id: 'line', label: 'Línea' },
]

interface Props {
  transactions: Transaction[]
  period: PeriodFilterState
  /** Fija el área (detalle de rama) */
  areaId?: AreaId
  /** Filtra por especialidad (detalle de especialidad) */
  specialtyId?: SpecialtyId
}

export function FinanceChart({
  transactions,
  period,
  areaId,
  specialtyId,
}: Props) {
  const uid = useId().replace(/:/g, '')
  const fillIngresosId = `fillIngresos-${uid}`
  const fillGastosId = `fillGastos-${uid}`

  const [chartType, setChartType] = useState<ChartType>('line')

  const resolvedAreaId =
    areaId ?? (period.areaFilter === 'total' ? undefined : period.areaFilter)

  const data = useMemo(
    () =>
      buildChartMonthSeries(transactions, {
        period: period.period,
        year: period.year,
        month: period.month,
        semester: period.semester,
        quarter: period.quarter,
        areaId: resolvedAreaId,
        specialtyId,
      }),
    [transactions, period, resolvedAreaId, specialtyId],
  )

  const commonAxis = (
    <>
      <CartesianGrid stroke="#E8E0D4" strokeDasharray="3 6" vertical={false} />
      <XAxis
        dataKey="month"
        tick={{ fill: '#8A847C', fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        interval={period.period === 'month' ? 2 : 0}
        angle={period.period === 'month' ? 0 : data.length > 6 ? -30 : 0}
        textAnchor={
          period.period === 'month'
            ? 'middle'
            : data.length > 6
              ? 'end'
              : 'middle'
        }
        height={period.period === 'month' ? 30 : data.length > 6 ? 56 : 30}
        minTickGap={period.period === 'month' ? 2 : 4}
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
          period.period === 'month' ? `Día ${label}` : String(label)
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
    <Card className="animate-fade-up-delay-2 !p-4 sm:!p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
        <h2 className="font-display text-xl font-medium tracking-tight text-ink md:text-2xl">
          Evolución
        </h2>
        <div className="w-full min-w-[8rem] sm:w-40">
          <Label htmlFor={`chart-type-${uid}`}>Tipo de gráfico</Label>
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
      </div>

      <div className="h-[260px] w-full min-w-0 sm:h-[320px] md:h-[400px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-muted">
            No hay datos para estos filtros.
          </div>
        ) : chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 4, left: -12, bottom: 0 }}
            >
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
            <AreaChart
              data={data}
              margin={{ top: 8, right: 4, left: -12, bottom: 0 }}
            >
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
                  <stop
                    offset="0%"
                    stopColor={EXPENSE_COLOR}
                    stopOpacity={0.35}
                  />
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
