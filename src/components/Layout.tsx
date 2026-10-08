import { NavLink, Outlet } from 'react-router-dom'
import { CalendarRange, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useFinance } from '../context/FinanceContext'
import { usePeriodFilter } from '../context/PeriodFilterContext'
import { logout } from '../lib/auth'
import { PeriodFilterModal } from './PeriodFilterModal'
import { Button } from './ui'

interface Props {
  onLogout: () => void
}

export function Layout({ onLogout }: Props) {
  const { summary } = usePeriodFilter()
  const { cloudEnabled, syncError } = useFinance()
  const [filtersOpen, setFiltersOpen] = useState(false)

  async function handleLogout() {
    await logout()
    onLogout()
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-sand/70 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4 md:px-8">
          <NavLink to="/" className="group min-w-0 shrink">
            <img
              src="/logo-clinica-burgos.png"
              alt="Clínica Burgos"
              className="h-5 w-auto max-w-[140px] object-contain object-left transition duration-200 group-hover:opacity-80 sm:max-w-none md:h-6"
            />
          </NavLink>

          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              variant="secondary"
              className="max-w-[min(100%,14rem)] !px-3 sm:max-w-none sm:!px-4"
              onClick={() => setFiltersOpen(true)}
              title="Filtros de periodo"
            >
              <CalendarRange size={14} />
              <span className="min-w-0 truncate">{summary}</span>
            </Button>
            <Button
              variant="ghost"
              className="!px-2.5 sm:!px-3"
              onClick={() => void handleLogout()}
              title="Salir de la sesión"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-5 sm:py-8 md:px-8 md:py-10">
        {cloudEnabled && syncError && (
          <div className="mb-5 rounded-2xl border border-rose/25 bg-rose/5 px-4 py-3 text-[12px] leading-relaxed text-rose">
            <p className="font-medium">Sincronización en la nube no disponible</p>
            <p className="mt-1 text-rose/90">{syncError}</p>
          </div>
        )}
        <Outlet />
      </main>

      <footer className="mx-auto max-w-7xl px-5 pb-10 pt-2 md:px-8">
        <div className="border-t border-sand/70 pt-6 text-center text-[11px] tracking-wide text-ink-muted">
          CB Operaciones · Uso interno Clínica Burgos · Dra. de Teresa
        </div>
      </footer>

      <PeriodFilterModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
      />
    </div>
  )
}
