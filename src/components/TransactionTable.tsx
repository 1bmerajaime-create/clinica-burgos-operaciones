import { useState, type MouseEvent, type ReactNode } from 'react'
import { Paperclip, Trash2 } from 'lucide-react'
import { getArea, specialtyLabel } from '../data/areas'
import { useFinance } from '../context/FinanceContext'
import { formatCurrencyPrecise, formatDate } from '../lib/format'
import type { Transaction } from '../types'
import { Card, SectionTitle } from './ui'
import { TransactionFormModal } from './TransactionFormModal'

interface Props {
  transactions: Transaction[]
  title?: string
  eyebrow?: string
  showArea?: boolean
  action?: ReactNode
  editable?: boolean
  /** Sin card envolvente (p.ej. dentro de modal) */
  bare?: boolean
}

function AmountBlock({ t }: { t: Transaction }) {
  const total = t.grossAmount ?? t.amount
  const base = t.netAmount ?? t.amount
  const exempt = Boolean(t.vatExempt) || t.vatRate === 0

  return (
    <div
      className={`flex flex-col gap-0.5 font-medium tabular-nums ${
        t.type === 'ingreso' ? 'text-olive' : 'text-rose'
      }`}
    >
      <span>
        {t.type === 'gasto' ? '−' : '+'}
        {formatCurrencyPrecise(total)}
        <span className="ml-1 text-[10px] font-normal uppercase tracking-[0.08em] text-ink-muted">
          total
        </span>
      </span>
      <div className="flex flex-col gap-0.5 text-[11px] font-normal text-ink-muted">
        <span className="whitespace-nowrap">
          Base {formatCurrencyPrecise(base)}
        </span>
        {exempt ? (
          <span>Exento</span>
        ) : (
          <span className="whitespace-nowrap">
            IVA {formatCurrencyPrecise(t.vatAmount ?? 0)}
            {t.type === 'gasto' &&
              t.vatAmount != null &&
              t.vatAmount > 0 &&
              t.vatDeductible === false &&
              ' · No deducible'}
          </span>
        )}
      </div>
    </div>
  )
}

function TypeBadge({ type }: { type: Transaction['type'] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${
        type === 'ingreso' ? 'bg-olive/15 text-olive' : 'bg-rose/15 text-rose'
      }`}
    >
      {type}
    </span>
  )
}

export function TransactionTable({
  transactions,
  title = 'Movimientos recientes',
  eyebrow = 'Detalle',
  showArea = true,
  action,
  editable = true,
  bare = false,
}: Props) {
  const { removeTransaction } = useFinance()
  const [editing, setEditing] = useState<Transaction | null>(null)

  const colCount = (showArea ? 5 : 4) + (editable ? 1 : 0)

  function handleDelete(e: MouseEvent, t: Transaction) {
    e.stopPropagation()
    const ok = window.confirm(
      `¿Eliminar este movimiento?\n\n${t.description}`,
    )
    if (ok) void removeTransaction(t.id)
  }

  function openTransaction(t: Transaction) {
    if (!editable) return
    setEditing(t)
  }

  function rowMeta(t: Transaction) {
    const area = getArea(t.areaId)
    return t.specialtyId
      ? `${area?.shortName} · ${specialtyLabel(t.specialtyId)}`
      : area?.shortName
  }

  const empty = (
    <p className="px-4 py-10 text-center text-sm text-ink-muted sm:px-6">
      No hay movimientos todavía.
    </p>
  )

  const mobileList = (
    <div className="space-y-3 px-3 pb-4 md:hidden">
      {transactions.length === 0 && empty}
      {transactions.map((t) => (
        <article
          key={t.id}
          role={editable ? 'button' : undefined}
          tabIndex={editable ? 0 : undefined}
          onClick={() => openTransaction(t)}
          onKeyDown={(e) => {
            if (editable && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              openTransaction(t)
            }
          }}
          className={`rounded-2xl border border-sand/70 bg-cream-dark/30 px-3.5 py-3 ${
            editable
              ? 'cursor-pointer transition hover:border-ink/20 hover:bg-cream-dark/55'
              : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TypeBadge type={t.type} />
              <span className="truncate text-xs text-ink-muted">
                {formatDate(t.date)}
              </span>
              {t.invoiceFileName && (
                <span title={t.invoiceFileName} className="shrink-0 text-brass">
                  <Paperclip size={14} />
                </span>
              )}
            </div>
            {editable && (
              <button
                type="button"
                onClick={(e) => handleDelete(e, t)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink/10 text-ink-soft transition hover:border-rose/40 hover:bg-rose/10 hover:text-rose"
                title="Eliminar"
                aria-label="Eliminar movimiento"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <p className="mt-2 text-sm leading-snug text-ink">{t.description}</p>
          {showArea && (
            <p className="mt-1 text-[11px] text-ink-muted">{rowMeta(t)}</p>
          )}

          <div className="mt-3 border-t border-sand/60 pt-2.5">
            <AmountBlock t={t} />
          </div>
        </article>
      ))}
    </div>
  )

  const desktopTable = (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-y border-sand/70 text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            <th className="px-4 py-3 font-medium sm:px-6">Fecha</th>
            <th className="px-4 py-3 font-medium">Concepto</th>
            {showArea && <th className="px-4 py-3 font-medium">Categoría</th>}
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 text-right font-medium sm:px-6">Importe</th>
            {editable && (
              <th className="px-4 py-3 text-right font-medium">
                <span className="sr-only">Eliminar</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 && (
            <tr>
              <td
                colSpan={colCount}
                className="px-6 py-10 text-center text-sm text-ink-muted"
              >
                No hay movimientos todavía.
              </td>
            </tr>
          )}
          {transactions.map((t) => (
            <tr
              key={t.id}
              onClick={() => openTransaction(t)}
              className={`border-b border-sand/40 transition ${
                editable
                  ? 'cursor-pointer hover:bg-cream-dark/55'
                  : 'hover:bg-cream-dark/40'
              }`}
            >
              <td className="px-4 py-3.5 text-sm text-ink-soft sm:px-6">
                {formatDate(t.date)}
              </td>
              <td className="px-4 py-3.5">
                <div className="flex items-start gap-2">
                  <div>
                    <p className="text-sm text-ink">{t.description}</p>
                    {t.specialtyId && (
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        {specialtyLabel(t.specialtyId)}
                      </p>
                    )}
                  </div>
                  {t.invoiceFileName && (
                    <span
                      title={t.invoiceFileName}
                      className="mt-0.5 text-brass"
                    >
                      <Paperclip size={14} />
                    </span>
                  )}
                </div>
              </td>
              {showArea && (
                <td className="px-4 py-3.5 text-sm text-ink-soft">
                  {rowMeta(t)}
                </td>
              )}
              <td className="px-4 py-3.5">
                <TypeBadge type={t.type} />
              </td>
              <td className="px-4 py-3.5 text-right sm:px-6">
                <div className="flex flex-col items-end">
                  <AmountBlock t={t} />
                </div>
              </td>
              {editable && (
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, t)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/10 text-ink-soft transition hover:border-rose/40 hover:bg-rose/10 hover:text-rose"
                      title="Eliminar"
                      aria-label="Eliminar movimiento"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const body = (
    <>
      {mobileList}
      {desktopTable}
    </>
  )

  return (
    <>
      {bare ? (
        body
      ) : (
        <Card className="animate-fade-up-delay-3 overflow-hidden !p-0">
          <div className="p-4 pb-2 sm:p-6 sm:pb-2">
            <SectionTitle eyebrow={eyebrow} title={title} action={action} />
          </div>
          {body}
        </Card>
      )}

      <TransactionFormModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        transaction={editing}
      />
    </>
  )
}
