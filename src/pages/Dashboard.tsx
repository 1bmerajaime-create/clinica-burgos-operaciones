import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { FinanceChart } from '../components/FinanceChart'
import { SignedAmount } from '../components/SignedAmount'
import { TransactionTable } from '../components/TransactionTable'
import { Card } from '../components/ui'
import { useFinance } from '../context/FinanceContext'
import { AREAS } from '../data/areas'
import { areaBreakdown, recentTransactions, sumByType } from '../lib/analytics'

export function Dashboard() {
  const { transactions } = useFinance()

  const ingresos = sumByType(transactions, 'ingreso')
  const gastos = sumByType(transactions, 'gasto')
  const balanceTotal = ingresos - gastos
  const groupStats = areaBreakdown(transactions)
  const recent = recentTransactions(transactions, 8)

  const balances = [
    {
      id: 'total' as const,
      label: 'Balance total',
      value: balanceTotal,
      ingresos,
      gastos,
      href: undefined as string | undefined,
    },
    ...AREAS.map((area) => {
      const stats = groupStats.find((g) => g.areaId === area.id)!
      return {
        id: area.id,
        label: area.name,
        value: stats.resultado,
        ingresos: stats.ingresos,
        gastos: stats.gastos,
        href: `/rama/${area.id}`,
      }
    }),
  ]

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {balances.map((item, i) => {
          const content = (
            <Card
              className={`h-full ${
                item.href
                  ? 'transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_40px_rgba(45,41,38,0.08)]'
                  : ''
              }`}
            >
              <div className="flex h-full flex-col text-left">
                <div className="mb-4 flex min-h-8 items-start justify-between gap-3">
                  <p className="pt-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                    {item.label}
                  </p>
                  {item.href ? (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink transition group-hover:bg-ink group-hover:text-cream">
                      <ArrowUpRight size={14} />
                    </span>
                  ) : (
                    <span className="h-8 w-8 shrink-0" aria-hidden />
                  )}
                </div>

                <div className="flex flex-col items-stretch gap-2">
                  <SignedAmount value={item.value} size="lg" />

                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                    <span className="inline-flex items-baseline gap-1.5">
                      <span className="text-ink-muted">Ingreso</span>
                      <SignedAmount value={item.ingresos} kind="income" forceSign="+" />
                    </span>
                    <span className="inline-flex items-baseline gap-1.5">
                      <span className="text-ink-muted">Gasto</span>
                      <SignedAmount value={item.gastos} kind="expense" forceSign="−" />
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )

          const wrapClass = `animate-fade-up-delay-${Math.min(i + 1, 3)}`

          return item.href ? (
            <Link key={item.id} to={item.href} className={`group ${wrapClass}`}>
              {content}
            </Link>
          ) : (
            <div key={item.id} className={wrapClass}>
              {content}
            </div>
          )
        })}
      </section>

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
