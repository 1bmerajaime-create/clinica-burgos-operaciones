import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { FinanceProvider } from './context/FinanceContext'
import { BranchDetail } from './pages/BranchDetail'
import { Dashboard } from './pages/Dashboard'
import { Movements } from './pages/Movements'
import { SpecialtyDetail } from './pages/SpecialtyDetail'

export default function App() {
  return (
    <FinanceProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="movimientos" element={<Movements />} />
            <Route path="rama/oftalmologia" element={<Navigate to="/rama/clinica" replace />} />
            <Route path="rama/estetica" element={<Navigate to="/rama/clinica" replace />} />
            <Route path="rama/:branchId/:specialtyId" element={<SpecialtyDetail />} />
            <Route path="rama/:branchId" element={<BranchDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </FinanceProvider>
  )
}
