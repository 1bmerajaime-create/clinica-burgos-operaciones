import { useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'
import { Layout } from './components/Layout'
import { FinanceProvider } from './context/FinanceContext'
import { isAuthenticated } from './lib/auth'
import { BranchDetail } from './pages/BranchDetail'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'
import { Movements } from './pages/Movements'
import { SpecialtyDetail } from './pages/SpecialtyDetail'

function AuthenticatedApp() {
  return (
    <FinanceProvider>
      <Routes>
        <Route element={<Layout />}>
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
    </FinanceProvider>
  )
}

function AppRoutes() {
  const [authed, setAuthed] = useState(() => isAuthenticated())
  const navigate = useNavigate()

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

  return <AuthenticatedApp />
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
