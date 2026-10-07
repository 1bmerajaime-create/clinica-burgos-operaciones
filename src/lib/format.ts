export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCurrencyPrecise(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

/** Color de sentimiento: ingresos / positivo → verde; gastos / negativo → rojo */
export function sentimentClass(
  value: number,
  kind: 'income' | 'expense' | 'result' = 'result',
): string {
  if (kind === 'income') return 'text-olive'
  if (kind === 'expense') return 'text-rose'
  return value >= 0 ? 'text-olive' : 'text-rose'
}

export function formatSignedCurrency(value: number): string {
  const abs = formatCurrency(Math.abs(value))
  if (value > 0) return `+${abs}`
  if (value < 0) return `−${abs}`
  return abs
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function formatMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  const date = new Date(y, m - 1, 1)
  return new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date)
}

/** Ej. "octubre 2026" */
export function formatMonthLabelLong(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  const date = new Date(y, m - 1, 1)
  const label = new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
  }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}
