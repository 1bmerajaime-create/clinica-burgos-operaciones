import { useMemo, useState } from 'react'
import { TransactionTable } from '../components/TransactionTable'
import { Select } from '../components/ui'
import { useFinance } from '../context/FinanceContext'
import { AREAS, SPECIALTIES } from '../data/areas'
import type { AreaId, SpecialtyId, TransactionType } from '../types'

export function Movements() {
  const { transactions } = useFinance()
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

  return (
    <div className="space-y-8">
      <section className="animate-fade-up">
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink md:text-3xl">
          Todos los movimientos
        </h1>
      </section>

      <div className="flex flex-wrap gap-3 animate-fade-up-delay-1">
        <div className="min-w-[180px]">
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
          <div className="min-w-[180px]">
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
        <div className="min-w-[160px]">
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
        <p className="flex items-center text-xs text-ink-muted">
          {filtered.length} resultado{filtered.length === 1 ? '' : 's'}
        </p>
      </div>

      <TransactionTable
        transactions={filtered}
        title="Listado completo"
        eyebrow="Filtros activos"
      />
    </div>
  )
}
