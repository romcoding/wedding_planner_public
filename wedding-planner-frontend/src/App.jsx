import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { GuestAuthProvider, useGuestAuth } from './contexts/GuestAuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { trackRouteChange } from './utils/analytics'
import AdminLayout from './layouts/AdminLayout'
import GuestLayout from './layouts/GuestLayout'
import GuestThemeShell from './layouts/GuestThemeShell'
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
import SeatingChartPage from './pages/admin/SeatingChartPage'
import RSVPRemindersPage from './pages/admin/RSVPRemindersPage'
import UsersPage from './pages/admin/UsersPage'
import MoodboardPage from './pages/admin/MoodboardPage'
import GuestHome from './pages/guest/Home'
import GuestLogin from './pages/guest/GuestLogin'
import GuestInfo from './pages/guest/Info'
import GuestRegister from './pages/guest/Register'
import RSVP from './pages/guest/RSVP'

function AdminRouteGuard({ allowRoles, user, element, fallbackTo = '/admin/guests' }) {
  if (!user) return <Navigate to="/admin/login" replace />
  if (!allowRoles || allowRoles.length === 0) return element
  if (allowRoles.includes(user.role)) return element
  return <Navigate to={fallbackTo} replace />
}

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
        <Route element={<GuestThemeShell />}>
          <Route path="login" element={guest ? <Navigate to="/" replace /> : <GuestLogin />} />
          <Route path="register" element={<GuestRegister />} />
          <Route path="rsvp/:token" element={<RSVP />} />
          <Route element={<GuestLayout />}>
            <Route index element={guest ? <GuestInfo /> : <Navigate to="/login" replace />} />
            <Route path="home" element={guest ? <GuestHome /> : <Navigate to="/login" replace />} />
            <Route path="info" element={guest ? <GuestInfo /> : <Navigate to="/login" replace />} />
          </Route>
        </Route>
      </Routes>
    </LanguageProvider>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Track route changes
  useEffect(() => {
    trackRouteChange(location.pathname, document.title)
  }, [location.pathname])

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
        <Route
          index
          element={
            <Navigate to={user?.role === 'planner' ? '/admin/guests' : '/admin/wedding'} replace />
          }
        />

        {/* Planner-visible */}
        <Route path="guests" element={<AdminRouteGuard user={user} allowRoles={['admin', 'planner']} element={<GuestsPage />} />} />
        <Route path="tasks" element={<AdminRouteGuard user={user} allowRoles={['admin', 'planner']} element={<TasksPage />} />} />
        <Route path="events" element={<AdminRouteGuard user={user} allowRoles={['admin', 'planner']} element={<EventsPage />} />} />
        <Route path="venues" element={<AdminRouteGuard user={user} allowRoles={['admin', 'planner']} element={<VenuesPage />} />} />
        <Route path="seating" element={<AdminRouteGuard user={user} allowRoles={['admin', 'planner']} element={<SeatingChartPage />} />} />
        <Route path="moodboard" element={<AdminRouteGuard user={user} allowRoles={['admin', 'planner']} element={<MoodboardPage />} />} />

        {/* Admin-only */}
        <Route path="wedding" element={<AdminRouteGuard user={user} allowRoles={['admin', 'super_admin']} element={<WeddingManagement />} fallbackTo="/admin/guests" />} />
        <Route path="images" element={<AdminRouteGuard user={user} allowRoles={['admin', 'super_admin']} element={<ImagesPage />} fallbackTo="/admin/guests" />} />
        <Route path="invitations" element={<AdminRouteGuard user={user} allowRoles={['admin', 'super_admin']} element={<InvitationsPage />} fallbackTo="/admin/guests" />} />
        <Route path="rsvp-reminders" element={<AdminRouteGuard user={user} allowRoles={['admin', 'super_admin']} element={<RSVPRemindersPage />} fallbackTo="/admin/guests" />} />
        <Route path="costs" element={<AdminRouteGuard user={user} allowRoles={['admin', 'super_admin']} element={<CostsPage />} fallbackTo="/admin/guests" />} />
        <Route path="content" element={<AdminRouteGuard user={user} allowRoles={['admin', 'super_admin']} element={<ContentPage />} fallbackTo="/admin/guests" />} />
        <Route path="analytics" element={<AdminRouteGuard user={user} allowRoles={['admin', 'super_admin']} element={<AnalyticsPage />} fallbackTo="/admin/guests" />} />
        <Route path="users" element={<AdminRouteGuard user={user} allowRoles={['admin', 'super_admin']} element={<UsersPage />} fallbackTo="/admin/guests" />} />
      </Route>

      <Route
        path="/admin/login"
        element={user ? <Navigate to={user?.role === 'planner' ? '/admin/guests' : '/admin/wedding'} replace /> : <LoginPage />}
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
