import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { PlusCircle, Trash } from 'lucide-react'

const TasksPage = () => {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
    due_date: '',
    category: '',
    assigned_to: '',
    estimated_cost: '',
    actual_cost: '',
  })

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get('/tasks').then((res) => res.data),
  })

  const createTask = useMutation({
    mutationFn: (payload) => api.post('/tasks', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks'])
      setShowForm(false)
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        status: 'todo',
        due_date: '',
        category: '',
        assigned_to: '',
        estimated_cost: '',
        actual_cost: '',
      })
    },
  })

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => api.put(`/tasks/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries(['tasks']),
  })

  const deleteTask = useMutation({
    mutationFn: (id) => api.delete(`/tasks/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['tasks']),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      ...formData,
      estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
      actual_cost: formData.actual_cost ? parseFloat(formData.actual_cost) : null,
    }
    createTask.mutate(payload)
  }

  const handleUpdate = (id, field, value) => {
    const data = field === 'estimated_cost' || field === 'actual_cost' 
      ? { [field]: value ? parseFloat(value) : null }
      : { [field]: value }
    updateTask.mutate({ id, data })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600 mt-1">Manage your wedding planning tasks</p>
        </div>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusCircle className="h-5 w-5" />
          <span>Add Task</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Due Date</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1 text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                placeholder="e.g., Venue, Catering"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Assigned To</label>
              <input
                type="text"
                value={formData.assigned_to}
                onChange={(e) =>
                  setFormData({ ...formData, assigned_to: e.target.value })
                }
                placeholder="Name or email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Estimated Cost
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.estimated_cost}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    estimated_cost: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Actual Cost
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.actual_cost}
                onChange={(e) =>
                  setFormData({ ...formData, actual_cost: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Create Task
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estimated</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tasks?.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                      No tasks yet. Create your first task!
                    </td>
                  </tr>
                ) : (
                  tasks?.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{task.title}</div>
                        {task.description && (
                          <div className="text-xs text-gray-500 mt-1">{task.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={task.priority}
                          onChange={(e) =>
                            handleUpdate(task.id, 'priority', e.target.value)
                          }
                          className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={task.status}
                          onChange={(e) =>
                            handleUpdate(task.id, 'status', e.target.value)
                          }
                          className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {task.category || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {task.assigned_to || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {task.estimated_cost ? `$${parseFloat(task.estimated_cost).toFixed(2)}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {task.actual_cost ? `$${parseFloat(task.actual_cost).toFixed(2)}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => deleteTask.mutate(task.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default TasksPage
