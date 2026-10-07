import { ArrowLeft, ArrowUpRight, FileUp, Plus, Wallet } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { FinanceChart } from '../components/FinanceChart'
import { InvoiceUploadModal } from '../components/InvoiceUploadModal'
import { ProductsSection } from '../components/ProductsSection'
import { SignedAmount } from '../components/SignedAmount'
import { TransactionFormModal } from '../components/TransactionFormModal'
import { TransactionTable } from '../components/TransactionTable'
import { Button, Card, Modal } from '../components/ui'
import { useFinance } from '../context/FinanceContext'
import { getArea, getSpecialty } from '../data/areas'
import {
  filterByArea,
  filterBySpecialty,
  sumByType,
} from '../lib/analytics'
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

export function SpecialtyDetail() {
  const { branchId, specialtyId } = useParams()
  const area = getArea(branchId ?? '')
  const specialty = getSpecialty(specialtyId as SpecialtyId | undefined)
  const { transactions } = useFinance()

  const [incomeOpen, setIncomeOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [listType, setListType] = useState<TransactionType | null>(null)

  const id = (area?.id ?? 'clinica') as AreaId
  const specId = (specialty?.id ?? 'oftalmologia') as SpecialtyId

  const ingresos = sumByType(transactions, 'ingreso', id, specId)
  const gastos = sumByType(transactions, 'gasto', id, specId)
  const resultado = ingresos - gastos
  const specialtyTransactions = useMemo(
    () =>
      filterBySpecialty(filterByArea(transactions, id), specId)
        .slice()
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [transactions, id, specId],
  )

  const listTransactions = useMemo(() => {
    if (!listType) return []
    return specialtyTransactions.filter((t) => t.type === listType)
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

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setInvoiceOpen(true)}>
            <FileUp size={14} />
            Factura
          </Button>
          <Button variant="secondary" onClick={() => setExpenseOpen(true)}>
            <Wallet size={14} />
            Gasto
          </Button>
          <Button onClick={() => setIncomeOpen(true)}>
            <Plus size={14} />
            Ingreso
          </Button>
        </div>
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
            <SignedAmount value={ingresos} kind="income" forceSign="+" size="lg" />
          }
        />
        <StatCardShell
          label="Gastos"
          interactive
          onClick={() => setListType('gasto')}
          amount={
            <SignedAmount value={gastos} kind="expense" forceSign="−" size="lg" />
          }
        />
      </section>

      <FinanceChart
        transactions={transactions}
        areaId={id}
        specialtyId={specId}
        eyebrow={specialty.name}
        title="Evolución"
      />

      {specId === 'estetica' && <ProductsSection areaId={id} />}

      <TransactionTable
        transactions={specialtyTransactions.slice(0, 12)}
        showArea={false}
        title="Movimientos"
        eyebrow="Histórico"
      />

      <Modal
        open={Boolean(listType)}
        onClose={() => setListType(null)}
        title={
          listType === 'ingreso' ? 'Listado de ingresos' : 'Listado de gastos'
        }
        size="lg"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            {area.name} · {specialty.name} · {listTransactions.length} movimiento
            {listTransactions.length === 1 ? '' : 's'}
          </p>
          <Button
            onClick={() =>
              listType === 'ingreso'
                ? setIncomeOpen(true)
                : setExpenseOpen(true)
            }
          >
            <Plus size={14} />
            {listType === 'ingreso' ? 'Añadir ingreso' : 'Añadir gasto'}
          </Button>
        </div>
        <TransactionTable
          transactions={listTransactions}
          showArea={false}
          bare
        />
      </Modal>

      <TransactionFormModal
        open={incomeOpen}
        onClose={() => setIncomeOpen(false)}
        type="ingreso"
        defaultAreaId={id}
        defaultSpecialtyId={specId}
      />
      <TransactionFormModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        type="gasto"
        defaultAreaId={id}
        defaultSpecialtyId={specId}
      />
      <InvoiceUploadModal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        defaultAreaId={id}
        defaultSpecialtyId={specId}
      />
    </div>
  )
}
