import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { GuestAuthProvider, useGuestAuth } from './contexts/GuestAuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
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
import EventsPage from './pages/admin/EventsPage'
import VenuesPage from './pages/admin/VenuesPage'
import GuestHome from './pages/guest/Home'
import GuestLogin from './pages/guest/GuestLogin'
import GuestInfo from './pages/guest/Info'
import GuestRegister from './pages/guest/Register'
import RSVP from './pages/guest/RSVP'

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
    <LanguageProvider initialLanguage={guest?.language || 'en'}>
      <Routes>
        <Route path="/login" element={guest ? <Navigate to="/" replace /> : <GuestLogin />} />
        <Route path="/register" element={<GuestRegister />} />
        <Route path="/rsvp/:token" element={<RSVP />} />
        <Route path="/" element={<GuestLayout />}>
          <Route index element={guest ? <GuestHome /> : <Navigate to="/login" replace />} />
          <Route path="info" element={guest ? <GuestInfo /> : <Navigate to="/login" replace />} />
        </Route>
      </Routes>
    </LanguageProvider>
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
        <Route index element={<Navigate to="/admin/wedding" replace />} />
        <Route path="guests" element={<GuestsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="costs" element={<CostsPage />} />
        <Route path="content" element={<ContentPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="wedding" element={<WeddingManagement />} />
        <Route path="images" element={<ImagesPage />} />
        <Route path="invitations" element={<InvitationsPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="venues" element={<VenuesPage />} />
      </Route>

      <Route
        path="/admin/login"
        element={user ? <Navigate to="/admin/wedding" replace /> : <LoginPage />}
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
