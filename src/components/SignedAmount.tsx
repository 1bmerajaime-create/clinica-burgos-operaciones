import { formatCurrency } from '../lib/format'

type Kind = 'income' | 'expense' | 'result' | 'neutral'

interface Props {
  value: number
  kind?: Kind
  /** Forzar signo + / − aunque el valor sea absoluto tipado (p.ej. gastos) */
  forceSign?: '+' | '−'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function colorClass(value: number, kind: Kind): string {
  if (kind === 'neutral') return 'text-ink'
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

  if (size === 'lg' || size === 'md') {
    const figure =
      size === 'md'
        ? 'text-[1.25rem] sm:text-2xl'
        : 'text-[1.35rem] sm:text-3xl md:text-4xl'
    return (
      <span
        className={`grid grid-cols-[0.7em_minmax(0,1fr)] items-baseline gap-0 text-left tabular-nums ${color} ${className}`}
      >
        <span className="font-sans text-[0.85em] font-medium leading-none">
          {sign}
        </span>
        <span
          className={`font-display font-medium leading-none tracking-tight ${figure}`}
        >
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
