import { formatCurrencyPrecise } from '../lib/format'
import { describeVatPosition } from '../lib/vat'

interface Props {
  resultado: number
  /** compact = una línea bajo Resultado; stack = importe + pie (card Impuestos) */
  variant?: 'compact' | 'stack'
  className?: string
}

/** Deja claro si hay IVA a pagar al Estado, saldo a favor, o nada. */
export function VatPositionNote({
  resultado,
  variant = 'compact',
  className = '',
}: Props) {
  const pos = describeVatPosition(resultado)
  const amount = formatCurrencyPrecise(pos.absolute)

  if (variant === 'stack') {
    return (
      <div className={className}>
        <p
          className={`font-display text-[1.15rem] font-medium leading-none tracking-tight sm:text-xl md:text-2xl ${pos.colorClass}`}
        >
          {amount}
        </p>
        <p className="mt-1 text-[10px] leading-snug text-ink-muted sm:text-[11px]">
          {pos.caption}
        </p>
      </div>
    )
  }

  // Misma fila que «Base (sin IVA)» en Ingresos/Gastos: etiqueta + importe.
  const rowLabel =
    pos.kind === 'pay'
      ? 'IVA a pagar'
      : pos.kind === 'credit'
        ? 'IVA a tu favor'
        : 'IVA a Hacienda'

  return (
    <div
      className={`mt-auto flex items-baseline justify-between gap-3 text-xs ${className}`}
    >
      <span className="text-ink-muted">{rowLabel}</span>
      <span className={`tabular-nums ${pos.colorClass}`}>
        {pos.kind === 'none' ? '0 €' : amount}
      </span>
    </div>
  )
}
