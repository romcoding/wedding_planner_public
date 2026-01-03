import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { GuestAuthProvider, useGuestAuth } from './contexts/GuestAuthContext'
import AdminLayout from './layouts/AdminLayout'
import GuestLayout from './layouts/GuestLayout'
import LoginPage from './pages/admin/LoginPage'
import AdminDashboard from './pages/admin/Dashboard'
import GuestsPage from './pages/admin/GuestsPage'
import TasksPage from './pages/admin/TasksPage'
import CostsPage from './pages/admin/CostsPage'
import ContentPage from './pages/admin/ContentPage'
import AnalyticsPage from './pages/admin/AnalyticsPage'
import WeddingManagement from './pages/admin/WeddingManagement'
import ImagesPage from './pages/admin/ImagesPage'
import InvitationsPage from './pages/admin/InvitationsPage'
import GuestHome from './pages/guest/Home'
import GuestLogin from './pages/guest/GuestLogin'
import GuestInfo from './pages/guest/Info'
import GuestRegister from './pages/guest/Register'

function GuestRoutes() {
  const { guest, loading } = useGuestAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={guest ? <Navigate to="/" replace /> : <GuestLogin />} />
      <Route path="/register" element={<GuestRegister />} />
      <Route path="/" element={<GuestLayout />}>
        <Route index element={guest ? <GuestHome /> : <Navigate to="/login" replace />} />
        <Route path="info" element={guest ? <GuestInfo /> : <Navigate to="/login" replace />} />
      </Route>
    </Routes>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Guest Routes (Protected) */}
      <Route path="/*" element={<GuestRoutes />} />

      {/* Admin Routes (Protected) */}
      <Route
        path="/admin"
        element={user ? <AdminLayout /> : <Navigate to="/admin/login" replace />}
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="guests" element={<GuestsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="costs" element={<CostsPage />} />
        <Route path="content" element={<ContentPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="wedding" element={<WeddingManagement />} />
        <Route path="images" element={<ImagesPage />} />
        <Route path="invitations" element={<InvitationsPage />} />
      </Route>

      <Route
        path="/admin/login"
        element={user ? <Navigate to="/admin/dashboard" replace /> : <LoginPage />}
      />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <GuestAuthProvider>
        <AppRoutes />
      </GuestAuthProvider>
    </AuthProvider>
  )
}

export default App
