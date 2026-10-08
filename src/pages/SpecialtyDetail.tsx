import { ArrowLeft, ArrowUpRight, Plus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { FinanceChart } from '../components/FinanceChart'
import { ProductsSection } from '../components/ProductsSection'
import { MoneyBreakdown } from '../components/MoneyBreakdown'
import { SignedAmount } from '../components/SignedAmount'
import { TransactionFormModal } from '../components/TransactionFormModal'
import { TransactionTable } from '../components/TransactionTable'
import { VatPositionNote } from '../components/VatPositionNote'
import { Button, Card, Dialog } from '../components/ui'
import { useFinance } from '../context/FinanceContext'
import { usePeriodFilter } from '../context/PeriodFilterContext'
import { getArea, getSpecialty } from '../data/areas'
import {
  filterByArea,
  filterBySpecialty,
  sumByType,
  sumNetIngresos,
} from '../lib/analytics'
import { estimateVatPosition, sumAmountBreakdown } from '../lib/vat'
import type { AreaId, SpecialtyId, TransactionType } from '../types'

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
        <div className="flex min-h-0 flex-1 flex-col">{amount}</div>
      </div>
    </Card>
  )

  if (!interactive || !onClick) return (
    <div className="h-full min-w-0">{inner}</div>
  )

  return (
    <button
      type="button"
      onClick={onClick}
      className="group block h-full w-full min-w-0 text-left"
    >
      {inner}
    </button>
  )
}

export function SpecialtyDetail() {
  const { branchId, specialtyId } = useParams()
  const area = getArea(branchId ?? '')
  const specialty = getSpecialty(specialtyId as SpecialtyId | undefined)
  const { transactions } = useFinance()

  const [movementOpen, setMovementOpen] = useState(false)
  const [movementType, setMovementType] = useState<TransactionType>('ingreso')
  const [listType, setListType] = useState<TransactionType | null>(null)

  function openMovement(type: TransactionType = 'ingreso') {
    setMovementType(type)
    setMovementOpen(true)
  }

  const id = (area?.id ?? 'clinica') as AreaId
  const specId = (specialty?.id ?? 'oftalmologia') as SpecialtyId
  const { state, filterPeriod } = usePeriodFilter()

  const scopedAll = useMemo(
    () => filterBySpecialty(filterByArea(transactions, id), specId),
    [transactions, id, specId],
  )

  const specialtyTransactions = useMemo(
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

  const ingresos = sumNetIngresos(specialtyTransactions, id, specId)
  const gastos = sumByType(specialtyTransactions, 'gasto', id, specId)
  const resultado = ingresos - gastos
  const specialtyVat = useMemo(
    () => estimateVatPosition(specialtyTransactions),
    [specialtyTransactions],
  )

  const incomeBreakdown = useMemo(
    () => sumAmountBreakdown(specialtyTransactions, 'ingreso'),
    [specialtyTransactions],
  )
  const expenseBreakdown = useMemo(
    () => sumAmountBreakdown(specialtyTransactions, 'gasto'),
    [specialtyTransactions],
  )

  const listTransactions = useMemo(() => {
    if (!listType) return []
    return specialtyTransactions.filter((t) =>
      listType === 'ingreso'
        ? t.type === 'ingreso' || t.type === 'devolucion'
        : t.type === listType,
    )
  }, [specialtyTransactions, listType])

  if (!area || !area.hasSpecialty || !specialty) {
    return <Navigate to={area ? `/rama/${area.id}` : '/'} replace />
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to={`/rama/${id}`}
            className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted transition hover:text-ink"
          >
            <ArrowLeft size={14} />
            Volver a {area.name}
          </Link>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-muted">
            {area.name}
          </p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-ink md:text-3xl">
            {specialty.name}
          </h1>
        </div>

        <Button onClick={() => openMovement('ingreso')}>
          <Plus size={14} />
          Movimiento
        </Button>
      </div>

      <section className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-3">
        <StatCardShell
          label="Resultado"
          amount={
            <div className="flex h-full min-h-0 flex-col gap-2.5">
              <SignedAmount value={resultado} size="lg" />
              <VatPositionNote resultado={specialtyVat.resultado} />
            </div>
          }
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

      <FinanceChart
        transactions={scopedAll}
        period={state}
        areaId={id}
        specialtyId={specId}
      />

      {specId === 'estetica' && <ProductsSection areaId={id} />}

      <TransactionTable
        transactions={specialtyTransactions.slice(0, 12)}
        showArea={false}
        title="Movimientos"
        eyebrow="Periodo seleccionado"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/movimientos?area=${id}&specialty=${specId}`}
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
            {area.name} · {specialty.name} · {listTransactions.length} movimiento
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
        defaultSpecialtyId={specId}
      />
    </div>
  )
}
