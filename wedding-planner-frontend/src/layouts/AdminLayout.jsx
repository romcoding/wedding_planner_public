import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  LayoutDashboard, 
  Users, 
  CheckSquare, 
  DollarSign, 
  FileText, 
  BarChart3,
  Heart,
  Image as ImageIcon,
  Mail,
  Calendar,
  LogOut
} from 'lucide-react'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()

  const navItems = [
    { path: '/admin/wedding', icon: Heart, label: 'Wedding Management' },
    { path: '/admin/guests', icon: Users, label: 'RSVP Requests' },
    { path: '/admin/invitations', icon: Mail, label: 'Invitations' },
    { path: '/admin/events', icon: Calendar, label: 'Timeline' },
    { path: '/admin/images', icon: ImageIcon, label: 'Images' },
    { path: '/admin/tasks', icon: CheckSquare, label: 'Tasks' },
    { path: '/admin/costs', icon: DollarSign, label: 'Costs' },
    { path: '/admin/content', icon: FileText, label: 'Content' },
    { path: '/admin/analytics', icon: BarChart3, label: 'Technical Analytics' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-gray-800">Wedding Planner</h1>
            <p className="text-sm text-gray-500 mt-1">Admin Dashboard</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="p-4 border-t">
            <div className="mb-4 px-4 py-2">
              <p className="text-sm font-medium text-gray-800">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
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

      {/* Main Content */}
      <div className="ml-64">
        <div className="p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

