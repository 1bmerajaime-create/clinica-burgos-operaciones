import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { FileUp, Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui'
import { TransactionFormModal } from './TransactionFormModal'
import { InvoiceUploadModal } from './InvoiceUploadModal'

export function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-sand/70 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <NavLink to="/" className="group shrink-0">
            <img
              src="/logo-clinica-burgos.png"
              alt="Clínica Burgos"
              className="h-7 w-auto transition duration-200 group-hover:opacity-80 md:h-8"
            />
          </NavLink>

          {isHome && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="hidden !px-4 sm:inline-flex"
                onClick={() => setInvoiceOpen(true)}
              >
                <FileUp size={14} />
                Factura
              </Button>
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
            </div>
          )}
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
      <InvoiceUploadModal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} />
    </div>
  )
}
