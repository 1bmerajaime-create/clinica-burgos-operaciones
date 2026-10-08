import { useMemo, useState } from 'react'
import { ArrowUpRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { FinanceChart } from '../components/FinanceChart'
import { SignedAmount } from '../components/SignedAmount'
import { TransactionFormModal } from '../components/TransactionFormModal'
import { TransactionTable } from '../components/TransactionTable'
import { Button, Card, Dialog } from '../components/ui'
import { useFinance } from '../context/FinanceContext'
import { usePeriodFilter } from '../context/PeriodFilterContext'
import { getArea } from '../data/areas'
import { areaBreakdown, recentTransactions } from '../lib/analytics'
import { formatCurrencyPrecise, formatDate } from '../lib/format'
import {
  estimateIrpfWithheld,
  estimateVatPosition,
  type TaxBreakdownLine,
} from '../lib/vat'
import type { AreaId, TransactionType } from '../types'

const DASHBOARD_AREAS: AreaId[] = ['clinica', 'quiron']

function vatLineRoleLabel(role: TaxBreakdownLine['role']): string {
  if (role === 'repercutido') return 'IVA repercutido'
  if (role === 'deducible') return 'IVA deducible'
  if (role === 'soportado') return 'IVA soportado (no deducible)'
  return 'IRPF retenido'
}

function TaxLinesTable({
  lines,
  emptyLabel,
}: {
  lines: TaxBreakdownLine[]
  emptyLabel: string
}) {
  if (lines.length === 0) {
    return (
      <p className="rounded-2xl border border-sand/70 bg-cream-dark/40 px-4 py-3 text-[12px] text-ink-muted">
        {emptyLabel}
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-sand/70">
      <table className="w-full text-left text-[12px]">
        <thead className="bg-cream-dark/50 text-[9px] font-medium uppercase tracking-[0.12em] text-ink-muted">
          <tr>
            <th className="px-3 py-2.5 font-medium">Fecha</th>
            <th className="px-3 py-2.5 font-medium">Concepto</th>
            <th className="px-3 py-2.5 font-medium">Tipo</th>
            <th className="px-3 py-2.5 text-right font-medium">Importe</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand/60 bg-white-soft/40">
          {lines.map((line) => (
            <tr key={`${line.transactionId}-${line.role}`}>
              <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">
                {formatDate(line.date)}
              </td>
              <td className="max-w-[14rem] truncate px-3 py-2.5 text-ink">
                {line.description}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">
                {vatLineRoleLabel(line.role)}
              </td>
              <td
                className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${
                  line.role === 'repercutido' || line.role === 'irpf'
                    ? 'text-olive'
                    : 'text-rose'
                }`}
              >
                {line.role === 'deducible' || line.role === 'soportado'
                  ? '−'
                  : line.amount < 0
                    ? '−'
                    : '+'}
                {formatCurrencyPrecise(Math.abs(line.amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Dashboard() {
  const { transactions } = useFinance()
  const { state, filterPeriod } = usePeriodFilter()
  const [taxOpen, setTaxOpen] = useState(false)
  const [movementOpen, setMovementOpen] = useState(false)
  const [movementType, setMovementType] = useState<TransactionType>('ingreso')

  const filtered = useMemo(
    () => filterPeriod(transactions),
    [filterPeriod, transactions],
  )

  const groupStats = useMemo(() => areaBreakdown(filtered), [filtered])
  const recent = useMemo(() => recentTransactions(filtered, 8), [filtered])
  const vat = useMemo(() => estimateVatPosition(filtered), [filtered])
  const irpf = useMemo(() => estimateIrpfWithheld(filtered), [filtered])

  const areaCards = DASHBOARD_AREAS.map((areaId) => {
    const area = getArea(areaId)!
    const stats = groupStats.find((g) => g.areaId === areaId)!
    return {
      id: areaId,
      label: area.name,
      value: stats.resultado,
      primaryLabel: 'Ingreso',
      primaryValue: stats.ingresos,
      primaryKind: 'income' as const,
      secondaryLabel: 'Gasto',
      secondaryValue: stats.gastos,
      secondaryKind: 'expense' as const,
      href: `/rama/${areaId}` as string | undefined,
      resultKind: 'result' as const,
    }
  })

  const vatPayable = vat.resultado >= 0
  const vatAmountLabel = formatCurrencyPrecise(Math.abs(vat.resultado))
  const vatCaption = vatPayable
    ? 'a pagar a Hacienda'
    : 'de saldo a tu favor'
  const irpfAmountLabel = formatCurrencyPrecise(irpf.retenido)
  const irpfCaption = 'ya retenidos'
  const vatSummary = `${vatAmountLabel} ${vatCaption}`
  const irpfSummary = `${irpfAmountLabel} ${irpfCaption}`

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-stretch">
        {areaCards.map((item, i) => {
          const delayClass =
            i === 0
              ? 'animate-fade-up-delay-1'
              : i === 1
                ? 'animate-fade-up-delay-2'
                : 'animate-fade-up-delay-3'
          const content = (
            <Card className="h-full min-w-0 !p-4 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_40px_rgba(45,41,38,0.08)] sm:!p-5">
              <div className="flex h-full flex-col text-left">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="pt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                    {item.label}
                  </p>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink transition group-hover:bg-ink group-hover:text-cream">
                    <ArrowUpRight size={13} />
                  </span>
                </div>

                <SignedAmount
                  value={item.value}
                  kind={item.resultKind}
                  size="md"
                />

                <dl className="mt-auto space-y-0.5 pt-3 text-xs">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-ink-muted">{item.primaryLabel}</dt>
                    <dd>
                      <SignedAmount
                        value={item.primaryValue}
                        kind={item.primaryKind}
                        forceSign="+"
                      />
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-ink-muted">{item.secondaryLabel}</dt>
                    <dd>
                      <SignedAmount
                        value={item.secondaryValue}
                        kind={item.secondaryKind}
                        forceSign="−"
                      />
                    </dd>
                  </div>
                </dl>
              </div>
            </Card>
          )

          return (
            <Link
              key={item.id}
              to={item.href!}
              className={`group block h-full w-full min-w-0 ${delayClass}`}
            >
              {content}
            </Link>
          )
        })}

        <button
          type="button"
          onClick={() => setTaxOpen(true)}
          className="group block h-full w-full min-w-0 animate-fade-up-delay-3 text-left"
        >
          <Card className="h-full min-w-0 w-full !p-4 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_40px_rgba(45,41,38,0.08)] sm:!p-5">
            <div className="flex h-full flex-col text-left">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="pt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                  Impuestos
                </p>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink transition group-hover:bg-ink group-hover:text-cream">
                  <ArrowUpRight size={13} />
                </span>
              </div>

              <div className="mt-auto grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                    IVA estimado
                  </p>
                  <p
                    className={`mt-1 font-display text-[1.15rem] font-medium leading-none tracking-tight sm:text-xl md:text-2xl ${
                      vatPayable ? 'text-rose' : 'text-olive'
                    }`}
                  >
                    {vatAmountLabel}
                  </p>
                  <p className="mt-1 text-[10px] leading-snug text-ink-muted sm:text-[11px]">
                    {vatCaption}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                    IRPF
                  </p>
                  <p className="mt-1 font-display text-[1.15rem] font-medium leading-none tracking-tight text-ink sm:text-xl md:text-2xl">
                    {irpfAmountLabel}
                  </p>
                  <p className="mt-1 text-[10px] leading-snug text-ink-muted sm:text-[11px]">
                    {irpfCaption}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </button>
      </section>

      <Dialog
        open={taxOpen}
        onClose={() => setTaxOpen(false)}
        eyebrow="Impuestos"
        title="Desglose IVA e IRPF"
        size="xl"
      >
        <p className="mb-5 max-w-2xl text-[12px] leading-relaxed text-ink-muted">
          El IVA y el IRPF se calculan por separado. El IVA usa la cuota real y
          la deducibilidad de cada factura; el IRPF suma las retenciones de las
          facturas al hospital. Filtrado por el periodo seleccionado.
        </p>

        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                  Desglose del IVA
                </p>
                <p
                  className={`mt-1 font-display text-lg font-medium tracking-tight ${
                    vatPayable ? 'text-rose' : 'text-olive'
                  }`}
                >
                  {vatSummary}
                </p>
              </div>
              <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
                <div>
                  Repercutido{' '}
                  <span className="tabular-nums text-olive">
                    {formatCurrencyPrecise(vat.repercutido)}
                  </span>
                </div>
                <div>
                  Deducible{' '}
                  <span className="tabular-nums text-rose">
                    {formatCurrencyPrecise(vat.soportadoDeducible)}
                  </span>
                </div>
              </dl>
            </div>
            <TaxLinesTable
              lines={vat.lines}
              emptyLabel="No hay cuotas de IVA en el periodo seleccionado."
            />
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                  Desglose del IRPF
                </p>
                <p className="mt-1 font-display text-lg font-medium tracking-tight text-ink">
                  {irpfSummary}
                </p>
              </div>
              <p className="text-[11px] text-ink-muted">
                Retenciones en facturas a Hospital Quirón
              </p>
            </div>
            <TaxLinesTable
              lines={irpf.lines}
              emptyLabel="No hay retenciones IRPF de hospital en el periodo seleccionado."
            />
          </section>
        </div>
      </Dialog>

      <FinanceChart transactions={transactions} period={state} />

      <TransactionTable
        transactions={recent}
        title="Movimientos recientes"
        eyebrow="Última actividad"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/movimientos"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              Ver todos
            </Link>
            <Button
              type="button"
              className="!px-3.5"
              onClick={() => {
                setMovementType('ingreso')
                setMovementOpen(true)
              }}
            >
              <Plus size={14} />
              Movimiento
            </Button>
          </div>
        }
      />

      <TransactionFormModal
        open={movementOpen}
        onClose={() => setMovementOpen(false)}
        type={movementType}
      />
    </div>
  )
}
