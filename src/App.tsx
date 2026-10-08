import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'
import { Layout } from './components/Layout'
import { FinanceProvider } from './context/FinanceContext'
import { PeriodFilterProvider } from './context/PeriodFilterContext'
import { ensureCloudSession, isAuthenticated } from './lib/auth'
import { isCloudConfigured } from './lib/firebase'
import { BranchDetail } from './pages/BranchDetail'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'
import { Movements } from './pages/Movements'
import { SpecialtyDetail } from './pages/SpecialtyDetail'

function AuthenticatedApp({ onLogout }: { onLogout: () => void }) {
  return (
    <FinanceProvider>
      <PeriodFilterProvider>
        <Routes>
          <Route element={<Layout onLogout={onLogout} />}>
            <Route index element={<Dashboard />} />
            <Route path="movimientos" element={<Movements />} />
            <Route
              path="rama/oftalmologia"
              element={<Navigate to="/rama/clinica" replace />}
            />
            <Route
              path="rama/estetica"
              element={<Navigate to="/rama/clinica" replace />}
            />
            <Route
              path="rama/:branchId/:specialtyId"
              element={<SpecialtyDetail />}
            />
            <Route path="rama/:branchId" element={<BranchDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </PeriodFilterProvider>
    </FinanceProvider>
  )
}

function AppRoutes() {
  const [authed, setAuthed] = useState(() => isAuthenticated())
  const [checking, setChecking] = useState(() => isCloudConfigured())
  const navigate = useNavigate()

  useEffect(() => {
    if (!isCloudConfigured()) {
      setChecking(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        if (!isAuthenticated()) {
          setChecking(false)
          return
        }
        const sessionOk = await ensureCloudSession()
        if (cancelled) return
        if (!sessionOk) {
          // Mantén acceso local; la sync mostrará el error.
          console.warn('[auth] Sin sesión Firebase; se sigue con datos locales')
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-muted">
        Comprobando sesión…
      </div>
    )
  }

  if (!authed) {
    return (
      <Login
        onSuccess={() => {
          setAuthed(true)
          navigate('/', { replace: true })
        }}
      />
    )
  }

  return (
    <AuthenticatedApp
      onLogout={() => {
        setAuthed(false)
        navigate('/', { replace: true })
      }}
    />
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
