import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut, Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { logout } from '../lib/auth'
import { Button } from './ui'
import { TransactionFormModal } from './TransactionFormModal'

interface Props {
  onLogout: () => void
}

export function Layout({ onLogout }: Props) {
  const location = useLocation()
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)

  // Dentro de detalle de rama/especialidad ya hay botones propios
  const showHeaderActions = !location.pathname.startsWith('/rama/')

  function handleLogout() {
    logout()
    onLogout()
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-sand/70 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <NavLink to="/" className="group shrink-0">
            <img
              src="/logo-clinica-burgos.png"
              alt="Clínica Burgos"
              className="h-5 w-auto transition duration-200 group-hover:opacity-80 md:h-6"
            />
          </NavLink>

          <div className="flex items-center gap-2">
            {showHeaderActions && (
              <>
                <Button
                  variant="secondary"
                  className="!px-4"
                  onClick={() => setExpenseOpen(true)}
                >
                  <Wallet size={14} />
                  Gasto
                </Button>
                <Button className="!px-4" onClick={() => setIncomeOpen(true)}>
                  <Plus size={14} />
                  Ingreso
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              className="!px-3"
              onClick={handleLogout}
              title="Salir de la sesión"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-7xl px-5 pb-10 pt-2 md:px-8">
        <div className="border-t border-sand/70 pt-6 text-center text-[11px] tracking-wide text-ink-muted">
          CB Operaciones · Uso interno Clínica Burgos · Dra. de Teresa
        </div>
      </footer>

      <TransactionFormModal
        open={incomeOpen}
        onClose={() => setIncomeOpen(false)}
        type="ingreso"
      />
      <TransactionFormModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        type="gasto"
      />
    </div>
  )
}
