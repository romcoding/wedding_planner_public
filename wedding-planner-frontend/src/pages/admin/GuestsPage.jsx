import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { CheckCircle, XCircle, Clock, Search, Filter, PlusCircle, Copy, QrCode, Mail, Link as LinkIcon } from 'lucide-react'
import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

export default function GuestsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState(null)
  const [showQRCode, setShowQRCode] = useState(null)
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    number_of_guests: 1,
    rsvp_status: 'pending',
    language: 'en',
  })

  const { data: guests, isLoading } = useQuery({
    queryKey: ['guests'],
    queryFn: async () => {
      const response = await api.get('/guests')
      return response.data
    },
  })

  const createGuestMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/guests', data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['guests'])
      setShowForm(false)
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        number_of_guests: 1,
        rsvp_status: 'pending',
        language: 'en',
      })
      // Show the QR code for the newly created guest
      if (data.guest) {
        // Add rsvp_link to guest object if it's in the response
        const guestWithLink = {
          ...data.guest,
          rsvp_link: data.rsvp_link || data.guest.rsvp_link
        }
        setSelectedGuest(guestWithLink)
        setShowQRCode(data.guest.id)
      }
    },
  })

  const updateGuestMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/guests/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['guests'])
    },
  })

  const deleteGuestMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/guests/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['guests'])
    },
  })

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    alert('Link copied to clipboard!')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    createGuestMutation.mutate(formData)
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading guests...</div>
  }

  const filteredGuests = guests?.filter((guest) => {
    const matchesSearch = 
      guest.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guest.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guest.email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || guest.rsvp_status === statusFilter
    
    return matchesSearch && matchesStatus
  }) || []

  const getStatusBadge = (status) => {
    const styles = {
      confirmed: 'bg-green-100 text-green-800 border-green-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      declined: 'bg-red-100 text-red-800 border-red-200',
    }
    
    const icons = {
      confirmed: <CheckCircle className="w-4 h-4" />,
      pending: <Clock className="w-4 h-4" />,
      declined: <XCircle className="w-4 h-4" />,
    }

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>
        {icons[status] || icons.pending}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Guest Management</h1>
          <p className="text-gray-600 mt-1">Create guests and manage RSVPs</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="text-sm text-gray-500">
            Total: {guests?.length || 0} guests
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <PlusCircle className="w-5 h-5" />
            Add Guest
          </button>
        </div>
      </div>

      {/* Create Guest Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Guest</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Guests
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.number_of_guests}
                  onChange={(e) => setFormData({ ...formData, number_of_guests: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initial RSVP Status
                </label>
                <select
                  value={formData.rsvp_status}
                  onChange={(e) => setFormData({ ...formData, rsvp_status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="declined">Declined</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred Language
              </label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="en">English</option>
                <option value="de">Deutsch (German)</option>
                <option value="fr">Français (French)</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Guest
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setFormData({
                    first_name: '',
                    last_name: '',
                    email: '',
                    phone: '',
                    number_of_guests: 1,
                    rsvp_status: 'pending',
                    language: 'en',
                  })
                }}
                className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRCode && selectedGuest && (
        <div className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold mb-4">RSVP Link & QR Code</h3>
            <p className="text-gray-600 mb-4">
              Share this link with <strong>{selectedGuest.first_name} {selectedGuest.last_name}</strong>
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="flex items-center gap-2 mb-2">
                <LinkIcon className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">RSVP Link:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={selectedGuest.rsvp_link || 'Generating link...'}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <button
                  onClick={() => copyToClipboard(selectedGuest.rsvp_link)}
                  className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  title="Copy link"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            {selectedGuest.rsvp_link && (
              <div className="flex justify-center mb-4">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                  <QRCodeSVG value={selectedGuest.rsvp_link} size={200} />
                </div>
              </div>
            )}
            <p className="text-sm text-gray-500 text-center mb-4">
              Scan this QR code or share the link above
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (selectedGuest.email) {
                    window.location.href = `mailto:${selectedGuest.email}?subject=Your Wedding RSVP&body=Hi ${selectedGuest.first_name},%0D%0A%0D%0APlease use this link to RSVP: ${selectedGuest.rsvp_link}`
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Mail className="w-4 h-4" />
                Email Link
              </button>
              <button
                onClick={() => {
                  setShowQRCode(null)
                  setSelectedGuest(null)
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="all">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="declined">Declined</option>
            </select>
          </div>
        </div>
      </div>

      {/* Guests Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guest
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  RSVP Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attendance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guests
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  RSVP Link
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    No guests found. Click "Add Guest" to create one.
                  </td>
                </tr>
              ) : (
                filteredGuests.map((guest) => (
                  <tr key={guest.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {guest.first_name} {guest.last_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        Registered: {new Date(guest.registered_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{guest.email}</div>
                      {guest.phone && (
                        <div className="text-xs text-gray-500">{guest.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(guest.rsvp_status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {guest.attendance_type ? (
                        <span className="capitalize">{guest.attendance_type}</span>
                      ) : (
                        <span className="text-gray-400">Not specified</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {guest.number_of_guests || 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedGuest(guest)
                            setShowQRCode(guest.id)
                          }}
                          className="p-1 text-blue-600 hover:text-blue-800"
                          title="Show QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (guest.rsvp_link) {
                              copyToClipboard(guest.rsvp_link)
                            } else {
                              alert('RSVP link is not available. Please refresh the page.')
                            }
                          }}
                          className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                          title="Copy Link"
                          disabled={!guest.rsvp_link}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <select
                          value={guest.rsvp_status}
                          onChange={(e) => updateGuestMutation.mutate({
                            id: guest.id,
                            data: { rsvp_status: e.target.value }
                          })}
                          className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="declined">Declined</option>
                        </select>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this guest?')) {
                              deleteGuestMutation.mutate(guest.id)
                            }
                          }}
                          className="text-red-600 hover:text-red-900 text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Confirmed</div>
          <div className="text-3xl font-bold text-green-600">
            {guests?.filter(g => g.rsvp_status === 'confirmed').length || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Pending</div>
          <div className="text-3xl font-bold text-yellow-600">
            {guests?.filter(g => g.rsvp_status === 'pending').length || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Total Attendance</div>
          <div className="text-3xl font-bold text-gray-900">
            {guests?.filter(g => g.rsvp_status === 'confirmed').reduce((sum, g) => sum + (g.number_of_guests || 1), 0) || 0}
          </div>
        </div>
      </div>
    </div>
  )
}
