import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { FinanceChart } from '../components/FinanceChart'
import { SignedAmount } from '../components/SignedAmount'
import { TransactionTable } from '../components/TransactionTable'
import { Card, Modal } from '../components/ui'
import { useFinance } from '../context/FinanceContext'
import { getArea } from '../data/areas'
import { areaBreakdown, recentTransactions } from '../lib/analytics'
import { formatCurrencyPrecise } from '../lib/format'
import { estimateVatPosition } from '../lib/vat'
import type { AreaId } from '../types'

const DASHBOARD_AREAS: AreaId[] = ['clinica', 'quiron']

export function Dashboard() {
  const { transactions } = useFinance()
  const [vatOpen, setVatOpen] = useState(false)

  const groupStats = areaBreakdown(transactions)
  const recent = recentTransactions(transactions, 8)
  const vat = estimateVatPosition(transactions)

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
    <div className="space-y-8">
      <section className="grid grid-cols-3 gap-2 sm:gap-4">
        {cards.map((item, i) => {
          const interactive = Boolean(item.href || item.onOpen)
          const content = (
            <Card
              className={`h-full min-w-0 !p-3 sm:!p-5 md:!p-6 ${
                interactive
                  ? 'transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_40px_rgba(45,41,38,0.08)]'
                  : ''
              }`}
            >
              <div className="flex h-full flex-col text-left">
                <div className="mb-3 flex min-h-7 items-start justify-between gap-2 sm:mb-4 sm:min-h-8 sm:gap-3">
                  <p className="pt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-ink-muted sm:pt-1.5 sm:text-[10px] sm:tracking-[0.16em]">
                    {item.label}
                  </p>
                  {interactive ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink transition group-hover:bg-ink group-hover:text-cream sm:h-8 sm:w-8">
                      <ArrowUpRight size={14} />
                    </span>
                  ) : (
                    <span
                      className="h-7 w-7 shrink-0 sm:h-8 sm:w-8"
                      aria-hidden
                    />
                  )}
                </div>

                <div className="flex min-w-0 flex-col items-stretch gap-1.5 sm:gap-2">
                  <SignedAmount
                    value={item.value}
                    kind={item.resultKind}
                    size="lg"
                  />

                  <div className="flex min-w-0 flex-col gap-0.5 text-[10px] sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-4 sm:gap-y-1 sm:text-xs">
                    <span className="inline-flex min-w-0 items-baseline gap-1 sm:gap-1.5">
                      <span className="shrink-0 text-ink-muted">
                        {item.primaryLabel}
                      </span>
                      <SignedAmount
                        value={item.primaryValue}
                        kind={item.primaryKind}
                        forceSign="+"
                      />
                    </span>
                    <span className="inline-flex min-w-0 items-baseline gap-1 sm:gap-1.5">
                      <span className="shrink-0 text-ink-muted">
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

      <Modal
        open={vatOpen}
        onClose={() => setVatOpen(false)}
        eyebrow="Detalle IVA"
        title="Bases e impuestos"
        size="xl"
      >
        <p className="mb-5 max-w-2xl text-[12px] leading-relaxed text-ink-muted">
          Los balances de clínica usan bases sin IVA. El resultado estimado es
          repercutido menos soportado deducible (tipos provisionales).
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
      </Modal>

      <FinanceChart transactions={transactions} />

      <TransactionTable
        transactions={recent}
        title="Movimientos recientes"
        eyebrow="Última actividad"
        action={
          <Link
            to="/movimientos"
            className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            Ver todos
          </Link>
        }
      />
    </div>
  )
}
