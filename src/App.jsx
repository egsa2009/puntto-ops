import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout        from './components/Layout'
import LoginPage     from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TenantsPage   from './pages/TenantsPage'
import TenantDetailPage from './pages/TenantDetailPage'
import PlansPage     from './pages/PlansPage'
import AlertsPage    from './pages/AlertsPage'
import ActivityLogPage from './pages/ActivityLogPage'

function ProtectedRoute({ children }) {
  const { operator, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    </div>
  )
  if (!operator) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { operator } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={operator ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index                  element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"       element={<DashboardPage />} />
        <Route path="tenants"         element={<TenantsPage />} />
        <Route path="tenants/:id"     element={<TenantDetailPage />} />
        <Route path="plans"           element={<PlansPage />} />
        <Route path="alerts"          element={<AlertsPage />} />
        <Route path="activity"        element={<ActivityLogPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
