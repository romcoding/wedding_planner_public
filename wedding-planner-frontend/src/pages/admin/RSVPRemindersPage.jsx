import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { PlusCircle, Trash, Edit, Mail, X, Clock, Send, CheckCircle, AlertCircle } from 'lucide-react'

const RSVPRemindersPage = () => {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    days_before_event: 14,
    subject: '',
    message: '',
    target_status: 'pending',
    only_unassigned: false,
    is_active: true,
  })

  const { data: reminders, isLoading } = useQuery({
    queryKey: ['rsvp-reminders'],
    queryFn: () => api.get('/rsvp-reminders').then((res) => res.data),
  })

  const { data: history } = useQuery({
    queryKey: ['reminder-history'],
    queryFn: () => api.get('/rsvp-reminders/history').then((res) => res.data),
  })

  const createReminder = useMutation({
    mutationFn: (data) => api.post('/rsvp-reminders', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['rsvp-reminders'])
      resetForm()
      setShowForm(false)
    },
  })

  const updateReminder = useMutation({
    mutationFn: ({ id, data }) => api.put(`/rsvp-reminders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['rsvp-reminders'])
      resetForm()
      setShowForm(false)
    },
  })

  const deleteReminder = useMutation({
    mutationFn: (id) => api.delete(`/rsvp-reminders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['rsvp-reminders'])
    },
  })

  const sendReminder = useMutation({
    mutationFn: (id) => api.post(`/rsvp-reminders/${id}/send`),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['rsvp-reminders'])
      queryClient.invalidateQueries(['reminder-history'])
      alert(`Reminder sent to ${data.data.sent} guests. ${data.data.skipped} skipped.`)
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      days_before_event: 14,
      subject: '',
      message: '',
      target_status: 'pending',
      only_unassigned: false,
      is_active: true,
    })
    setEditingId(null)
  }

  const handleEdit = (reminder) => {
    setEditingId(reminder.id)
    setFormData({
      name: reminder.name,
      days_before_event: reminder.days_before_event,
      subject: reminder.subject,
      message: reminder.message,
      target_status: reminder.target_status,
      only_unassigned: reminder.only_unassigned,
      is_active: reminder.is_active,
    })
    setShowForm(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editingId) {
      updateReminder.mutate({ id: editingId, data: formData })
    } else {
      createReminder.mutate(formData)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) || 0 : value,
    }))
  }

  if (isLoading) {
    return <div className="p-6">Loading reminders...</div>
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">RSVP Reminders</h1>
          <p className="text-gray-600 mt-1">Automatically remind guests to RSVP</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <PlusCircle className="w-5 h-5" />
          Add Reminder
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">
                  {editingId ? 'Edit Reminder' : 'Create New Reminder'}
                </h2>
                <button
                  onClick={() => {
                    resetForm()
                    setShowForm(false)
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Reminder Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., 2 weeks before wedding"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Days Before Event *</label>
                  <input
                    type="number"
                    name="days_before_event"
                    value={formData.days_before_event}
                    onChange={handleChange}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Reminder will be sent this many days before the main event</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Email Subject *</label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="e.g., Reminder: Please RSVP for our wedding"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Use {'{guest_name}'} to personalize</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Email Message *</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows="8"
                    placeholder="Dear {guest_name},&#10;&#10;This is a friendly reminder to RSVP for our wedding..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {'{guest_name}'} for name and {'{rsvp_link}'} for RSVP link
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Target Status</label>
                    <select
                      name="target_status"
                      value={formData.target_status}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    >
                      <option value="pending">Pending Only</option>
                      <option value="confirmed">Confirmed Only</option>
                      <option value="declined">Declined Only</option>
                      <option value="all">All Guests</option>
                    </select>
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="only_unassigned"
                        checked={formData.only_unassigned}
                        onChange={handleChange}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">Only unassigned guests</span>
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                    className="w-4 h-4"
                  />
                  <label className="text-sm text-gray-700">Active (will be sent automatically)</label>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm()
                      setShowForm(false)
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingId ? 'Update' : 'Create'} Reminder
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Reminders List */}
      <div className="space-y-4">
        {reminders && reminders.length > 0 ? (
          reminders.map((reminder) => (
            <div
              key={reminder.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="w-5 h-5 text-blue-500" />
                    <h3 className="text-xl font-bold text-gray-900">{reminder.name}</h3>
                    {!reminder.is_active && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Inactive</span>
                    )}
                    {reminder.next_send_at && new Date(reminder.next_send_at) > new Date() && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                        Scheduled: {new Date(reminder.next_send_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                    <div>
                      <span className="font-medium">Days Before Event:</span> {reminder.days_before_event}
                    </div>
                    <div>
                      <span className="font-medium">Target:</span> {reminder.target_status}
                      {reminder.only_unassigned && ' (unassigned only)'}
                    </div>
                    <div>
                      <span className="font-medium">Subject:</span> {reminder.subject}
                    </div>
                    {reminder.last_sent_at && (
                      <div>
                        <span className="font-medium">Last Sent:</span> {new Date(reminder.last_sent_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-gray-50 rounded p-3 mb-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{reminder.message}</p>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => {
                      if (window.confirm(`Send reminder "${reminder.name}" to eligible guests now?`)) {
                        sendReminder.mutate(reminder.id)
                      }
                    }}
                    className="p-2 text-green-600 hover:bg-green-50 rounded"
                    title="Send now"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleEdit(reminder)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit reminder"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this reminder?')) {
                        deleteReminder.mutate(reminder.id)
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Delete reminder"
                  >
                    <Trash className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg">
            No reminders yet. Click "Add Reminder" to create your first automatic reminder.
          </div>
        )}
      </div>

      {/* History Section */}
      {history && history.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Reminder History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Reminder</th>
                  <th className="px-4 py-2 text-left">Guest</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.slice(0, 20).map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{item.reminder_name}</td>
                    <td className="px-4 py-2">{item.guest_name}</td>
                    <td className="px-4 py-2">{item.guest_email}</td>
                    <td className="px-4 py-2">{new Date(item.sent_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default RSVPRemindersPage
