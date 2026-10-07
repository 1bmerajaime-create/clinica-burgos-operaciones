import { useState, type ReactNode } from 'react'
import { Pencil, Paperclip, Trash2 } from 'lucide-react'
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

  function handleDelete(t: Transaction) {
    const ok = window.confirm(
      `¿Eliminar este movimiento?\n\n${t.description}`,
    )
    if (ok) removeTransaction(t.id)
  }

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-y border-sand/70 text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            <th className="px-4 py-3 font-medium sm:px-6">Fecha</th>
            <th className="px-4 py-3 font-medium">Concepto</th>
            {showArea && <th className="px-4 py-3 font-medium">Categoría</th>}
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 text-right font-medium sm:px-6">Importe</th>
            {editable && (
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
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
          {transactions.map((t) => {
            const area = getArea(t.areaId)
            const detail = t.specialtyId
              ? `${area?.shortName} · ${specialtyLabel(t.specialtyId)}`
              : area?.shortName

            return (
              <tr
                key={t.id}
                className="border-b border-sand/40 transition hover:bg-cream-dark/40"
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
                  <td className="px-4 py-3.5 text-sm text-ink-soft">{detail}</td>
                )}
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${
                      t.type === 'ingreso'
                        ? 'bg-olive/15 text-olive'
                        : 'bg-rose/15 text-rose'
                    }`}
                  >
                    {t.type}
                  </span>
                </td>
                <td
                  className={`px-4 py-3.5 text-right font-medium tabular-nums sm:px-6 ${
                    t.type === 'ingreso' ? 'text-olive' : 'text-rose'
                  }`}
                >
                  <div className="flex flex-col items-end gap-0.5">
                    <span>
                      {t.type === 'gasto' ? '−' : '+'}
                      {formatCurrencyPrecise(t.netAmount ?? t.amount)}
                      <span className="ml-1 text-[10px] font-normal uppercase tracking-[0.08em] text-ink-muted">
                        base
                      </span>
                    </span>
                    <span className="text-[11px] font-normal text-ink-muted">
                      {t.vatExempt || t.vatRate === 0
                        ? 'Exento'
                        : `IVA ${formatCurrencyPrecise(t.vatAmount ?? 0)}`}
                      {t.grossAmount != null &&
                        ` · Total ${formatCurrencyPrecise(t.grossAmount)}`}
                      {t.type === 'gasto' &&
                        t.vatAmount != null &&
                        t.vatAmount > 0 &&
                        t.vatDeductible === false &&
                        ' · No deducible'}
                    </span>
                  </div>
                </td>
                {editable && (
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(t)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/10 text-ink-soft transition hover:border-ink/30 hover:bg-cream hover:text-ink"
                        title="Editar"
                        aria-label="Editar movimiento"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t)}
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
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <>
      {bare ? (
        table
      ) : (
        <Card className="animate-fade-up-delay-3 overflow-hidden !p-0">
          <div className="p-6 pb-2">
            <SectionTitle eyebrow={eyebrow} title={title} action={action} />
          </div>
          {table}
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
