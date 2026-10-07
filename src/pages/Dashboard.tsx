import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { FinanceChart } from '../components/FinanceChart'
import { SignedAmount } from '../components/SignedAmount'
import { TransactionTable } from '../components/TransactionTable'
import { Card } from '../components/ui'
import { useFinance } from '../context/FinanceContext'
import { getArea } from '../data/areas'
import { areaBreakdown, recentTransactions } from '../lib/analytics'
import { estimateVatPosition } from '../lib/vat'
import type { AreaId } from '../types'

const DASHBOARD_AREAS: AreaId[] = ['clinica', 'quiron']

export function Dashboard() {
  const { transactions } = useFinance()

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
      resultKind: 'result' as const,
    }
  })

  const vatCard = {
    id: 'iva',
    label: 'IVA estimado',
    value: vat.net,
    primaryLabel: 'Devengado',
    primaryValue: vat.accrued,
    primaryKind: 'income' as const,
    secondaryLabel: 'Pagado',
    secondaryValue: vat.paid,
    secondaryKind: 'expense' as const,
    href: undefined as string | undefined,
    /** Positivo = a pagar → rojo; negativo = a favor → verde */
    resultKind: (vat.net > 0 ? 'expense' : 'income') as 'expense' | 'income',
  }

  const cards = [...areaCards, vatCard]

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((item, i) => {
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
                  <SignedAmount
                    value={item.value}
                    kind={item.resultKind}
                    size="lg"
                  />

                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                    <span className="inline-flex items-baseline gap-1.5">
                      <span className="text-ink-muted">{item.primaryLabel}</span>
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
