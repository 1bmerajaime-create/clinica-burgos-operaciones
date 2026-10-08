import { useEffect, useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { TransactionTable } from '../components/TransactionTable'
import { Button, Dialog, Select } from '../components/ui'
import { useFinance } from '../context/FinanceContext'
import { usePeriodFilter } from '../context/PeriodFilterContext'
import { AREAS, SPECIALTIES } from '../data/areas'
import type { AreaId, SpecialtyId, TransactionType } from '../types'

function parseArea(value: string | null): 'all' | AreaId {
  if (
    value === 'clinica' ||
    value === 'quiron' ||
    value === 'cataratas' ||
    value === 'otros'
  ) {
    return value
  }
  return 'all'
}

function parseSpecialty(value: string | null): 'all' | SpecialtyId {
  if (
    value === 'oftalmologia' ||
    value === 'estetica' ||
    value === 'otros'
  ) {
    return value
  }
  return 'all'
}

function parseType(value: string | null): 'all' | TransactionType {
  if (value === 'ingreso' || value === 'gasto' || value === 'devolucion') {
    return value
  }
  return 'all'
}

export function Movements() {
  const { transactions } = useFinance()
  const { filterPeriod, summary: periodSummary } = usePeriodFilter()
  const [searchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [area, setArea] = useState<'all' | AreaId>(() =>
    parseArea(searchParams.get('area')),
  )
  const [specialty, setSpecialty] = useState<'all' | SpecialtyId>(() =>
    parseSpecialty(searchParams.get('specialty')),
  )
  const [type, setType] = useState<'all' | TransactionType>(() =>
    parseType(searchParams.get('type')),
  )

  useEffect(() => {
    setArea(parseArea(searchParams.get('area')))
    setSpecialty(parseSpecialty(searchParams.get('specialty')))
    setType(parseType(searchParams.get('type')))
  }, [searchParams])

  const showSpecialtyFilter =
    area === 'all' || area === 'clinica' || area === 'quiron'

  const filtered = useMemo(() => {
    return filterPeriod(transactions)
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
  }, [
    filterPeriod,
    transactions,
    area,
    specialty,
    type,
    showSpecialtyFilter,
  ])

  const filterSummary = useMemo(() => {
    const parts = [
      periodSummary,
      area === 'all'
        ? 'Todas'
        : AREAS.find((a) => a.id === area)?.shortName,
      showSpecialtyFilter && specialty !== 'all'
        ? SPECIALTIES.find((s) => s.id === specialty)?.name
        : null,
      type === 'all'
        ? 'Todos los tipos'
        : type === 'ingreso'
          ? 'Ingresos'
          : type === 'gasto'
            ? 'Gastos'
            : 'Devoluciones',
    ].filter(Boolean)
    return parts.join(' · ')
  }, [periodSummary, area, specialty, type, showSpecialtyFilter])

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
          <option value="all">Todos los tipos</option>
          <option value="ingreso">Solo ingresos</option>
          <option value="gasto">Solo gastos</option>
          <option value="devolucion">Solo devoluciones</option>
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
