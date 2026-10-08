import { ArrowLeft, ArrowUpRight, Plus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { FinanceChart } from '../components/FinanceChart'
import { MoneyBreakdown } from '../components/MoneyBreakdown'
import { SignedAmount } from '../components/SignedAmount'
import { TransactionFormModal } from '../components/TransactionFormModal'
import { TransactionTable } from '../components/TransactionTable'
import { Button, Card, Dialog, SectionTitle } from '../components/ui'
import { useFinance } from '../context/FinanceContext'
import { usePeriodFilter } from '../context/PeriodFilterContext'
import { SPECIALTIES, getArea } from '../data/areas'
import {
  filterByArea,
  specialtyBreakdown,
  sumByType,
  sumNetIngresos,
} from '../lib/analytics'
import { formatCurrency, formatSignedCurrency, sentimentClass } from '../lib/format'
import { sumAmountBreakdown } from '../lib/vat'
import type { AreaId, TransactionType } from '../types'

function StatCardShell({
  label,
  amount,
  onClick,
  interactive = false,
}: {
  label: string
  amount: ReactNode
  onClick?: () => void
  interactive?: boolean
}) {
  const inner = (
    <Card
      className={`h-full ${
        interactive
          ? 'transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_40px_rgba(45,41,38,0.08)]'
          : ''
      }`}
    >
      <div className="flex h-full flex-col text-left">
        <div className="mb-3 flex min-h-8 items-start justify-between gap-3">
          <p className="pt-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
            {label}
          </p>
          {interactive ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink transition group-hover:bg-ink group-hover:text-cream">
              <ArrowUpRight size={14} />
            </span>
          ) : (
            <span className="h-8 w-8 shrink-0" aria-hidden />
          )}
        </div>
        {amount}
      </div>
    </Card>
  )

  if (!interactive || !onClick) return inner

  return (
    <button type="button" onClick={onClick} className="group w-full text-left">
      {inner}
    </button>
  )
}

export function BranchDetail() {
  const { branchId } = useParams()
  const area = getArea(branchId ?? '')
  const { transactions } = useFinance()
  const [movementOpen, setMovementOpen] = useState(false)
  const [movementType, setMovementType] = useState<TransactionType>('ingreso')
  const [listType, setListType] = useState<TransactionType | null>(null)

  function openMovement(type: TransactionType = 'ingreso') {
    setMovementType(type)
    setMovementOpen(true)
  }

  const id = (area?.id ?? 'clinica') as AreaId
  const { state, filterPeriod } = usePeriodFilter()

  const scopedAll = useMemo(
    () => filterByArea(transactions, id),
    [transactions, id],
  )

  const areaTransactions = useMemo(
    () =>
      filterPeriod(scopedAll)
        .slice()
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [filterPeriod, scopedAll],
  )

  const ingresos = sumNetIngresos(areaTransactions, id)
  const gastos = sumByType(areaTransactions, 'gasto', id)
  const resultado = ingresos - gastos
  const bySpecialty = specialtyBreakdown(areaTransactions, id)

  const incomeBreakdown = useMemo(
    () => sumAmountBreakdown(areaTransactions, 'ingreso'),
    [areaTransactions],
  )
  const expenseBreakdown = useMemo(
    () => sumAmountBreakdown(areaTransactions, 'gasto'),
    [areaTransactions],
  )

  const listTransactions = useMemo(() => {
    if (!listType) return []
    return areaTransactions.filter((t) =>
      listType === 'ingreso'
        ? t.type === 'ingreso' || t.type === 'devolucion'
        : t.type === listType,
    )
  }, [areaTransactions, listType])

  if (!area) return <Navigate to="/" replace />

  return (
    <div className="space-y-8">
      <div className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted transition hover:text-ink"
          >
            <ArrowLeft size={14} />
            Volver al resumen
          </Link>
          <h1 className="font-display text-2xl font-medium tracking-tight text-ink md:text-3xl">
            {area.name}
          </h1>
        </div>

        <Button onClick={() => openMovement('ingreso')}>
          <Plus size={14} />
          Movimiento
        </Button>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCardShell
          label="Resultado"
          amount={<SignedAmount value={resultado} size="lg" />}
        />

        <StatCardShell
          label="Ingresos"
          interactive
          onClick={() => setListType('ingreso')}
          amount={
            <MoneyBreakdown
              kind="income"
              total={incomeBreakdown.total}
              vat={incomeBreakdown.vat}
              base={incomeBreakdown.base}
            />
          }
        />

        <StatCardShell
          label="Gastos"
          interactive
          onClick={() => setListType('gasto')}
          amount={
            <MoneyBreakdown
              kind="expense"
              total={expenseBreakdown.total}
              vat={expenseBreakdown.vat}
              base={expenseBreakdown.base}
            />
          }
        />
      </section>

      {area.hasSpecialty && (
        <Card className="animate-fade-up-delay-2">
          <SectionTitle eyebrow="Desglose" title="Por especialidad" />
          <div className="grid gap-4 sm:grid-cols-2">
            {SPECIALTIES.map((spec) => {
              const stats = bySpecialty.find((s) => s.specialtyId === spec.id)!
              return (
                <Link
                  key={spec.id}
                  to={`/rama/${id}/${spec.id}`}
                  className="group rounded-2xl border border-sand/60 bg-cream/40 p-5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-[0_12px_32px_rgba(45,41,38,0.06)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                      {spec.name}
                    </p>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink transition group-hover:bg-ink group-hover:text-cream">
                      <ArrowUpRight size={14} />
                    </span>
                  </div>
                  <p
                    className={`mt-2 font-display text-3xl ${sentimentClass(stats.resultado)}`}
                  >
                    {formatSignedCurrency(stats.resultado)}
                  </p>
                  <div className="mt-3 flex justify-between text-xs tabular-nums">
                    <span className={sentimentClass(stats.ingresos, 'income')}>
                      +{formatCurrency(stats.ingresos)}
                    </span>
                    <span className={sentimentClass(stats.gastos, 'expense')}>
                      −{formatCurrency(stats.gastos)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </Card>
      )}

      <FinanceChart transactions={scopedAll} period={state} areaId={id} />

      <TransactionTable
        transactions={areaTransactions.slice(0, 12)}
        showArea={false}
        title="Movimientos"
        eyebrow="Periodo seleccionado"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/movimientos?area=${id}`}
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              Ver más
            </Link>
            <Button
              type="button"
              className="!px-3.5"
              onClick={() => openMovement('ingreso')}
            >
              <Plus size={14} />
              Movimiento
            </Button>
          </div>
        }
      />

      <Dialog
        open={Boolean(listType)}
        onClose={() => setListType(null)}
        title={
          listType === 'ingreso'
            ? 'Ingresos y devoluciones'
            : 'Listado de gastos'
        }
        size="lg"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            {area.name} · {listTransactions.length} movimiento
            {listTransactions.length === 1 ? '' : 's'}
          </p>
          <Button onClick={() => openMovement(listType ?? 'ingreso')}>
            <Plus size={14} />
            Movimiento
          </Button>
        </div>
        <TransactionTable
          transactions={listTransactions}
          showArea={false}
          bare
        />
      </Dialog>

      <TransactionFormModal
        open={movementOpen}
        onClose={() => setMovementOpen(false)}
        type={movementType}
        defaultAreaId={id}
      />
    </div>
  )
}
