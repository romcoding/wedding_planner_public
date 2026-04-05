import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
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
  Wand2
} from 'lucide-react'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isPlanner = user?.role === 'planner'

  const navItems = isPlanner
    ? [
        { path: '/admin/guests', icon: Users, label: 'Guest Management' },
        { path: '/admin/setup', icon: Wand2, label: 'Quick Setup' },
        { path: '/admin/moodboard', icon: Palette, label: 'Moodboard' },
        { path: '/admin/seating', icon: Grid3x3, label: 'Seating Chart' },
        { path: '/admin/events', icon: Calendar, label: 'Timeline' },
        { path: '/admin/venues', icon: MapPin, label: 'Venues' },
        { path: '/admin/tasks', icon: CheckSquare, label: 'Tasks' },
        { path: '/admin/billing', icon: DollarSign, label: 'Pricing & Billing' },
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
        { path: '/admin/images', icon: ImageIcon, label: 'Webpage Builder' },
        { path: '/admin/tasks', icon: CheckSquare, label: 'Tasks' },
        { path: '/admin/costs', icon: DollarSign, label: 'Costs' },
        { path: '/admin/content', icon: FileText, label: 'Content' },
        { path: '/admin/analytics', icon: BarChart3, label: 'Technical Analytics' },
        { path: '/admin/users', icon: Shield, label: 'User Management' },
        { path: '/admin/billing', icon: DollarSign, label: 'Pricing & Billing' },
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
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-gray-800">Wedding Planner</h1>
            <p className="text-sm text-gray-500 mt-1">Admin Dashboard</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="p-4 border-t">
            <div className="mb-4 px-4 py-2">
              <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <LogOut className="w-5 h-5" />
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
    </div>
  )
}
