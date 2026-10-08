import { SignedAmount } from './SignedAmount'

/** Desglose Total / IVA / Base (sin IVA) para cards de ingresos o gastos. */
export function MoneyBreakdown({
  base,
  vat,
  total,
  kind,
}: {
  base: number
  vat: number
  total: number
  kind: 'income' | 'expense'
}) {
  const sign = kind === 'income' ? '+' : '−'

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-muted">
          Total
        </p>
        <SignedAmount
          value={total}
          kind={kind}
          forceSign={sign}
          size="lg"
        />
      </div>
      <dl className="space-y-1 text-xs">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-muted">IVA</dt>
          <dd>
            <SignedAmount value={vat} kind={kind} forceSign={sign} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-muted">Base (sin IVA)</dt>
          <dd>
            <SignedAmount value={base} kind={kind} forceSign={sign} />
          </dd>
        </div>
      </dl>
    </div>
  )
}
