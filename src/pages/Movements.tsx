import { useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { TransactionTable } from '../components/TransactionTable'
import { Button, Dialog, Select } from '../components/ui'
import { useFinance } from '../context/FinanceContext'
import { AREAS, SPECIALTIES } from '../data/areas'
import type { AreaId, SpecialtyId, TransactionType } from '../types'

export function Movements() {
  const { transactions } = useFinance()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [area, setArea] = useState<'all' | AreaId>('all')
  const [specialty, setSpecialty] = useState<'all' | SpecialtyId>('all')
  const [type, setType] = useState<'all' | TransactionType>('all')

  const showSpecialtyFilter = area === 'clinica' || area === 'quiron'

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => (area === 'all' ? true : t.areaId === area))
      .filter((t) =>
        specialty === 'all' || !showSpecialtyFilter
          ? true
          : t.specialtyId === specialty,
      )
      .filter((t) => (type === 'all' ? true : t.type === type))
      .slice()
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      )
  }, [transactions, area, specialty, type, showSpecialtyFilter])

  const filterSummary = useMemo(() => {
    const parts = [
      area === 'all'
        ? 'Todas'
        : AREAS.find((a) => a.id === area)?.shortName,
      showSpecialtyFilter && specialty !== 'all'
        ? SPECIALTIES.find((s) => s.id === specialty)?.name
        : null,
      type === 'all'
        ? 'Ingresos y gastos'
        : type === 'ingreso'
          ? 'Ingresos'
          : 'Gastos',
    ].filter(Boolean)
    return parts.join(' · ')
  }, [area, specialty, type, showSpecialtyFilter])

  const filterFields = (
    <>
      <div>
        <Select
          value={area}
          onChange={(e) => {
            const next = e.target.value as 'all' | AreaId
            setArea(next)
            if (next !== 'clinica' && next !== 'quiron') setSpecialty('all')
          }}
          aria-label="Filtrar por categoría"
        >
          <option value="all">Todas las categorías</option>
          {AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
      {showSpecialtyFilter && (
        <div>
          <Select
            value={specialty}
            onChange={(e) =>
              setSpecialty(e.target.value as 'all' | SpecialtyId)
            }
            aria-label="Filtrar por especialidad"
          >
            <option value="all">Todas las especialidades</option>
            {SPECIALTIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div>
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as 'all' | TransactionType)}
          aria-label="Filtrar por tipo"
        >
          <option value="all">Ingresos y gastos</option>
          <option value="ingreso">Solo ingresos</option>
          <option value="gasto">Solo gastos</option>
        </Select>
      </div>
    </>
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="animate-fade-up flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-medium tracking-tight text-ink md:text-3xl">
            Todos los movimientos
          </h1>
          <p className="mt-1 text-[11px] text-ink-muted md:hidden">
            {filterSummary}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 !px-3.5 md:hidden"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal size={14} />
          Filtros
        </Button>
      </section>

      <div className="hidden animate-fade-up-delay-1 md:flex md:flex-nowrap md:items-center md:gap-3">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-3 [&>div]:min-w-0 [&>div]:flex-1">
          {filterFields}
        </div>
        <p className="shrink-0 text-xs text-ink-muted">
          {filtered.length} resultado{filtered.length === 1 ? '' : 's'}
        </p>
      </div>

      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        footer={
          <Button
            type="button"
            className="w-full"
            onClick={() => setFiltersOpen(false)}
          >
            Ver {filtered.length} resultado
            {filtered.length === 1 ? '' : 's'}
          </Button>
        }
      >
        <div className="space-y-4">{filterFields}</div>
      </Dialog>

      <TransactionTable
        transactions={filtered}
        title="Listado completo"
        eyebrow="Filtros activos"
      />
    </div>
  )
}
