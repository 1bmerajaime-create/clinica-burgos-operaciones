import { formatCurrency } from '../lib/format'

type Kind = 'income' | 'expense' | 'result'

interface Props {
  value: number
  kind?: Kind
  /** Forzar signo + / − aunque el valor sea absoluto tipado (p.ej. gastos) */
  forceSign?: '+' | '−'
  size?: 'sm' | 'lg'
  className?: string
}

function colorClass(value: number, kind: Kind): string {
  if (kind === 'income') return 'text-olive'
  if (kind === 'expense') return 'text-rose'
  return value >= 0 ? 'text-olive' : 'text-rose'
}

export function SignedAmount({
  value,
  kind = 'result',
  forceSign,
  size = 'sm',
  className = '',
}: Props) {
  const sign =
    forceSign ?? (value > 0 ? '+' : value < 0 ? '−' : '\u00A0')
  const amount = formatCurrency(Math.abs(value))
  const color = colorClass(value, kind)

  if (size === 'lg') {
    return (
      <span
        className={`grid grid-cols-[0.7em_minmax(0,1fr)] items-baseline gap-0 text-left tabular-nums ${color} ${className}`}
      >
        <span className="font-sans text-[0.85em] font-medium leading-none">
          {sign}
        </span>
        <span className="font-display text-4xl font-medium leading-none tracking-tight">
          {amount}
        </span>
      </span>
    )
  }

  return (
    <span
      className={`inline-grid grid-cols-[0.7em_auto] items-baseline text-left text-xs tabular-nums ${color} ${className}`}
    >
      <span className="font-sans leading-none">{sign}</span>
      <span className="leading-none">{amount}</span>
    </span>
  )
}
