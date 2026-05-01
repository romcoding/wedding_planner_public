import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useWedding } from '../contexts/WeddingContext'
import AIPanel from '../components/AIPanel'
import {
  Users,
  CheckSquare,
  DollarSign,
  FileText,
  BarChart3,
  Heart,
  Image as ImageIcon,
  Mail,
  Calendar,
  LogOut,
  MapPin,
  Grid3x3,
  Bell,
  Shield,
  Palette,
  Menu,
  X,
  Wand2,
  Sparkles,
  CreditCard,
  ExternalLink,
  Zap,
  Crown,
} from 'lucide-react'

const PLAN_BADGE = {
  free: { label: 'Free', className: 'bg-gray-100 text-gray-600' },
  starter: { label: 'Starter', className: 'bg-blue-100 text-blue-700', icon: Zap },
  premium: { label: 'Premium', className: 'bg-amber-100 text-amber-700', icon: Crown },
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { wedding, needsOnboarding } = useWedding()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)

  // If user has no wedding yet, nudge them to onboarding
  useEffect(() => {
    if (needsOnboarding && location.pathname !== '/onboarding') {
      navigate('/onboarding', { replace: true })
    }
  }, [needsOnboarding, location.pathname, navigate])

  const isPlanner = user?.role === 'planner'

  const planBadge = PLAN_BADGE[wedding?.plan] || PLAN_BADGE.free
  const PlanIcon = planBadge.icon

  const navItems = isPlanner
    ? [
        { path: '/admin/guests', icon: Users, label: 'Guest Management' },
        { path: '/admin/setup', icon: Wand2, label: 'Quick Setup' },
        { path: '/admin/moodboard', icon: Palette, label: 'Moodboard' },
        { path: '/admin/seating', icon: Grid3x3, label: 'Seating Chart' },
        { path: '/admin/events', icon: Calendar, label: 'Timeline' },
        { path: '/admin/venues', icon: MapPin, label: 'Venues' },
        { path: '/admin/tasks', icon: CheckSquare, label: 'Tasks' },
        { path: '/admin/webpage', icon: ImageIcon, label: 'Guest Website Builder' },
        { path: '/admin/billing', icon: CreditCard, label: 'Billing' },
      ]
    : [
        { path: '/admin/wedding', icon: Heart, label: 'Wedding Management' },
        { path: '/admin/setup', icon: Wand2, label: 'Quick Setup' },
        { path: '/admin/guests', icon: Users, label: 'Guest Management' },
        { path: '/admin/moodboard', icon: Palette, label: 'Moodboard' },
        { path: '/admin/seating', icon: Grid3x3, label: 'Seating Chart' },
        { path: '/admin/rsvp-reminders', icon: Bell, label: 'RSVP Reminders' },
        { path: '/admin/invitations', icon: Mail, label: 'Invitations' },
        { path: '/admin/events', icon: Calendar, label: 'Timeline' },
        { path: '/admin/venues', icon: MapPin, label: 'Venues' },
        { path: '/admin/webpage', icon: ImageIcon, label: 'Webpage Builder' },
        { path: '/admin/tasks', icon: CheckSquare, label: 'Tasks' },
        { path: '/admin/costs', icon: DollarSign, label: 'Costs' },
        { path: '/admin/content', icon: FileText, label: 'Content' },
        { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
        { path: '/admin/users', icon: Shield, label: 'User Management' },
        { path: '/admin/billing', icon: CreditCard, label: 'Billing' },
      ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md text-gray-700 hover:bg-gray-100"
        aria-label="Toggle menu"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-40
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Brand + wedding info */}
          <div className="p-5 border-b">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
              <h1 className="text-lg font-bold text-gray-900">Wedding Planner</h1>
            </div>
            {wedding ? (
              <div>
                <p className="text-sm font-medium text-gray-700 truncate">
                  {wedding.partner_one_name} & {wedding.partner_two_name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${planBadge.className}`}>
                    {PlanIcon && <PlanIcon className="w-3 h-3" />}
                    {planBadge.label}
                  </span>
                  {wedding.slug && (
                    <a
                      href={`/w/${wedding.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
                      title="View guest portal"
                    >
                      /w/{wedding.slug}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Admin Dashboard</p>
            )}
          </div>

          {/* AI Assistant Button */}
          <div className="px-4 pt-3">
            <button
              onClick={() => { setAiPanelOpen(true); setSidebarOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white text-sm font-medium hover:from-rose-600 hover:to-amber-600 transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              AI Wedding Assistant
              {wedding?.plan === 'free' && (
                <span className="ml-auto text-xs bg-white/20 px-1.5 py-0.5 rounded-full">Upgrade</span>
              )}
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto mt-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-rose-50 text-rose-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate text-sm">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="p-4 border-t">
            <div className="mb-3 px-3">
              <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="lg:ml-64">
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </div>

      {/* AI Side Panel */}
      <AIPanel isOpen={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
    </div>
  )
}
