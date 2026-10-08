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
import { formatCurrencyPrecise } from '../lib/format'
import { estimateVatPosition } from '../lib/vat'
import type { AreaId, TransactionType } from '../types'

const DASHBOARD_AREAS: AreaId[] = ['clinica', 'quiron']

export function Dashboard() {
  const { transactions } = useFinance()
  const { state, filterPeriod } = usePeriodFilter()
  const [vatOpen, setVatOpen] = useState(false)
  const [movementOpen, setMovementOpen] = useState(false)
  const [movementType, setMovementType] = useState<TransactionType>('ingreso')

  const filtered = useMemo(
    () => filterPeriod(transactions),
    [filterPeriod, transactions],
  )

  const groupStats = useMemo(() => areaBreakdown(filtered), [filtered])
  const recent = useMemo(() => recentTransactions(filtered, 8), [filtered])
  const vat = useMemo(() => estimateVatPosition(filtered), [filtered])

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
      onOpen: undefined as (() => void) | undefined,
      resultKind: 'result' as const,
    }
  })

  const vatCard = {
    id: 'iva',
    label: 'IVA estimado',
    value: vat.resultado,
    primaryLabel: 'Repercutido',
    primaryValue: vat.repercutido,
    primaryKind: 'income' as const,
    secondaryLabel: 'Deducible',
    secondaryValue: vat.soportadoDeducible,
    secondaryKind: 'expense' as const,
    href: undefined as string | undefined,
    onOpen: () => setVatOpen(true),
    resultKind: 'result' as const,
  }

  const cards = [...areaCards, vatCard]

  const vatDetailRows = [
    {
      label: 'Ingresos sin IVA',
      value: vat.incomeBase,
      tone: 'text-ink',
    },
    {
      label: 'Gastos sin IVA',
      value: vat.expenseBase,
      tone: 'text-ink',
    },
    {
      label: 'IVA repercutido',
      value: vat.repercutido,
      tone: 'text-olive',
    },
    {
      label: 'IVA soportado',
      value: vat.soportado,
      tone: 'text-rose',
    },
    {
      label: 'IVA soportado deducible',
      value: vat.soportadoDeducible,
      tone: 'text-rose',
    },
  ] as const

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        {cards.map((item, i) => {
          const interactive = Boolean(item.href || item.onOpen)
          const content = (
            <Card
              className={`h-full min-w-0 !p-4 md:!p-6 ${
                interactive
                  ? 'transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_40px_rgba(45,41,38,0.08)]'
                  : ''
              }`}
            >
              <div className="flex items-center gap-3 text-left md:h-full md:flex-col md:items-stretch md:gap-0">
                <div className="min-w-0 flex-1 md:flex md:h-full md:flex-col">
                  <div className="mb-0 flex items-start justify-between gap-2 md:mb-4 md:min-h-8">
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted md:pt-1.5 md:tracking-[0.16em]">
                      {item.label}
                    </p>
                    {interactive ? (
                      <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink transition group-hover:bg-ink group-hover:text-cream md:flex">
                        <ArrowUpRight size={14} />
                      </span>
                    ) : (
                      <span
                        className="hidden h-8 w-8 shrink-0 md:block"
                        aria-hidden
                      />
                    )}
                  </div>

                  <div className="mt-2 hidden flex-col gap-2 md:flex">
                    <SignedAmount
                      value={item.value}
                      kind={item.resultKind}
                      size="lg"
                    />
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                      <span className="inline-flex items-baseline gap-1.5">
                        <span className="text-ink-muted">
                          {item.primaryLabel}
                        </span>
                        <SignedAmount
                          value={item.primaryValue}
                          kind={item.primaryKind}
                          forceSign="+"
                        />
                      </span>
                      <span className="inline-flex items-baseline gap-1.5">
                        <span className="text-ink-muted">
                          {item.secondaryLabel}
                        </span>
                        <SignedAmount
                          value={item.secondaryValue}
                          kind={item.secondaryKind}
                          forceSign="−"
                        />
                      </span>
                    </div>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] md:hidden">
                    <span className="inline-flex items-baseline gap-1">
                      <span className="text-ink-muted">{item.primaryLabel}</span>
                      <SignedAmount
                        value={item.primaryValue}
                        kind={item.primaryKind}
                        forceSign="+"
                      />
                    </span>
                    <span className="inline-flex items-baseline gap-1">
                      <span className="text-ink-muted">
                        {item.secondaryLabel}
                      </span>
                      <SignedAmount
                        value={item.secondaryValue}
                        kind={item.secondaryKind}
                        forceSign="−"
                      />
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 md:hidden">
                  <SignedAmount
                    value={item.value}
                    kind={item.resultKind}
                    size="lg"
                  />
                  {interactive && (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink">
                      <ArrowUpRight size={14} />
                    </span>
                  )}
                </div>
              </div>
            </Card>
          )

          const wrapClass = `animate-fade-up-delay-${Math.min(i + 1, 3)}`

          if (item.href) {
            return (
              <Link
                key={item.id}
                to={item.href}
                className={`group min-w-0 ${wrapClass}`}
              >
                {content}
              </Link>
            )
          }

          if (item.onOpen) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onOpen}
                className={`group min-w-0 text-left ${wrapClass}`}
              >
                {content}
              </button>
            )
          }

          return (
            <div key={item.id} className={`min-w-0 ${wrapClass}`}>
              {content}
            </div>
          )
        })}
      </section>

      <Dialog
        open={vatOpen}
        onClose={() => setVatOpen(false)}
        eyebrow="Detalle IVA"
        title="Bases e impuestos"
        size="xl"
      >
        <p className="mb-5 max-w-2xl text-[12px] leading-relaxed text-ink-muted">
          Los balances de clínica usan bases sin IVA. El resultado estimado es
          repercutido menos soportado deducible (tipos provisionales). Filtrado
          por el periodo seleccionado.
        </p>

        <div className="mb-5 rounded-2xl border border-sand/70 bg-cream-dark/40 px-4 py-3">
          <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-muted">
            Resultado estimado
          </p>
          <div className="mt-1.5">
            <SignedAmount value={vat.resultado} kind="result" size="lg" />
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-5">
          {vatDetailRows.map((row) => (
            <div
              key={row.label}
              className="rounded-2xl border border-sand/70 bg-cream-dark/40 px-3 py-3"
            >
              <dt className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                {row.label}
              </dt>
              <dd
                className={`mt-1.5 break-words font-display text-base font-medium tabular-nums tracking-tight sm:text-lg md:text-xl ${row.tone}`}
              >
                {formatCurrencyPrecise(row.value)}
              </dd>
            </div>
          ))}
        </dl>
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
