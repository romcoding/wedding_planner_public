import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { PlusCircle, Trash, Edit, FileText, X, GripVertical } from 'lucide-react'
import taskTemplates from '../../data/taskTemplates.json'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Task Card Component (Draggable)
function TaskCard({ task, onEdit, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const priorityColors = {
    urgent: 'bg-red-100 text-red-800 border-red-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-green-100 text-green-800 border-green-300',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-4 mb-3 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2 flex-1">
          <div {...attributes} {...listeners} className="mt-1 cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">{task.title}</h3>
            {task.description && (
              <p className="text-xs text-gray-600 line-clamp-2 mb-2">{task.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded border ${priorityColors[task.priority] || priorityColors.medium}`}>
          {task.priority}
        </span>
        {task.category && (
          <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
            {task.category}
          </span>
        )}
      </div>

      {task.due_date && (
        <div className="text-xs text-gray-600 mb-2">
          Due: {new Date(task.due_date).toLocaleDateString()}
        </div>
      )}

      {(task.estimated_cost || task.actual_cost) && (
        <div className="text-xs text-gray-600 mb-2">
          {task.estimated_cost && `Est: $${parseFloat(task.estimated_cost).toFixed(2)}`}
          {task.estimated_cost && task.actual_cost && ' • '}
          {task.actual_cost && `Act: $${parseFloat(task.actual_cost).toFixed(2)}`}
        </div>
      )}

      {task.assigned_to && (
        <div className="text-xs text-gray-600 mb-2">
          Assigned: {task.assigned_to}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-gray-100">
        <button
          onClick={() => onEdit(task)}
          className="text-blue-600 hover:text-blue-800 p-1"
          title="Edit task"
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to delete this task?')) {
              onDelete(task.id)
            }
          }}
          className="text-red-600 hover:text-red-800 p-1"
          title="Delete task"
        >
          <Trash className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// Kanban Column Component
function KanbanColumn({ id, title, tasks, onEdit, onDelete }) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[280px] bg-gray-50 rounded-lg p-4 ${
        isOver ? 'bg-blue-50 ring-2 ring-blue-400' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 text-lg">{title}</h2>
        <span className="bg-gray-200 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">
          {tasks.length}
        </span>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[200px]">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No tasks
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}

const TasksPage = () => {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [activeId, setActiveId] = useState(null)
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
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
    event_id: '',
    reminder_date: '',
  })

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get('/tasks').then((res) => res.data),
  })

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/events').then((res) => res.data),
  })

  const [fieldErrors, setFieldErrors] = useState({})

  const createTask = useMutation({
    mutationFn: (payload) => api.post('/tasks', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks'])
      setShowForm(false)
      setEditingTaskId(null)
      resetForm()
      setFieldErrors({})
      alert('Task created successfully!')
    },
    onError: (error) => {
      console.error('Error creating task:', error)
      const errorData = error.response?.data
      if (errorData?.errors) {
        setFieldErrors(errorData.errors)
      } else {
        setFieldErrors({ general: errorData?.error || 'Failed to create task. Please try again.' })
      }
    },
  })

  const editTask = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/tasks/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks'])
      setShowForm(false)
      setEditingTaskId(null)
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
        event_id: '',
        reminder_date: '',
      })
    },
    onError: (error) => {
      console.error('Error updating task:', error)
      alert(error.response?.data?.error || 'Failed to update task. Please try again.')
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

  const handleEdit = (task) => {
    setEditingTaskId(task.id)
    setFormData({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'medium',
      status: task.status || 'todo',
      due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
      category: task.category || '',
      assigned_to: task.assigned_to || '',
      estimated_cost: task.estimated_cost || '',
      actual_cost: task.actual_cost || '',
      event_id: task.event_id || '',
      reminder_date: task.reminder_date ? new Date(task.reminder_date).toISOString().slice(0, 16) : '',
    })
    setShowForm(true)
  }

  const resetForm = () => {
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
      event_id: '',
      reminder_date: '',
    })
    setEditingTaskId(null)
    setFieldErrors({})
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setFieldErrors({})
    
    // Validate required fields
    const errors = {}
    if (!formData.title || !formData.title.trim()) {
      errors.title = 'Task title is required'
    }
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    
    const payload = {
      ...formData,
      title: formData.title.trim(),  // Trim whitespace
      description: formData.description?.trim() || '',
      category: formData.category?.trim() || '',
      assigned_to: formData.assigned_to?.trim() || '',
      estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
      actual_cost: formData.actual_cost ? parseFloat(formData.actual_cost) : null,
      due_date: formData.due_date || null,
      event_id: formData.event_id ? parseInt(formData.event_id) : null,
      reminder_date: formData.reminder_date ? new Date(formData.reminder_date).toISOString() : null,
    }
    if (editingTaskId) {
      editTask.mutate({ id: editingTaskId, payload })
    } else {
      createTask.mutate(payload)
    }
  }

  const handleUpdate = (id, field, value) => {
    const data = field === 'estimated_cost' || field === 'actual_cost' 
      ? { [field]: value ? parseFloat(value) : null }
      : { [field]: value }
    updateTask.mutate({ id, data })
  }

  const handleDragStart = (event) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const taskId = active.id
    const newStatus = over.id // The column ID is the status

    // Only update if moving to a different status column
    if (['todo', 'in_progress', 'completed', 'cancelled'].includes(newStatus)) {
      handleUpdate(taskId, 'status', newStatus)
    }
  }

  // Group tasks by status
  const tasksByStatus = {
    todo: (tasks || []).filter(t => t.status === 'todo'),
    in_progress: (tasks || []).filter(t => t.status === 'in_progress'),
    completed: (tasks || []).filter(t => t.status === 'completed'),
    cancelled: (tasks || []).filter(t => t.status === 'cancelled'),
  }

  const allTaskIds = tasks?.map(t => t.id) || []

  const handleAddFromTemplate = (template) => {
    const weddingDate = prompt('Enter your wedding date (YYYY-MM-DD) to calculate due dates:')
    if (!weddingDate) return

    const baseDate = new Date(weddingDate)
    let successCount = 0
    let errorCount = 0

    template.tasks.forEach((taskTemplate) => {
      const dueDate = new Date(baseDate)
      dueDate.setDate(dueDate.getDate() + taskTemplate.due_date_offset_days)
      
      const taskData = {
        title: taskTemplate.title,
        description: taskTemplate.description || '',
        priority: taskTemplate.priority || 'medium',
        status: 'todo',
        due_date: dueDate.toISOString().split('T')[0],
        category: taskTemplate.category || '',
      }

      createTask.mutate(taskData, {
        onSuccess: () => successCount++,
        onError: () => errorCount++
      })
    })

    setTimeout(() => {
      alert(`Added ${successCount} tasks from template. ${errorCount > 0 ? `${errorCount} failed.` : ''}`)
      setShowTemplates(false)
    }, 1000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600 mt-1">Manage your wedding planning tasks</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <FileText className="h-5 w-5" />
            <span>Add from Template</span>
          </button>
          <button
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusCircle className="h-5 w-5" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Template Selection Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Task Templates</h2>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-4">
                {taskTemplates.templates.map((template, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-2">{template.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      {template.tasks.length} tasks
                    </p>
                    <ul className="text-sm text-gray-700 mb-4 space-y-1">
                      {template.tasks.slice(0, 3).map((task, i) => (
                        <li key={i}>• {task.title}</li>
                      ))}
                      {template.tasks.length > 3 && (
                        <li className="text-gray-500">... and {template.tasks.length - 3} more</li>
                      )}
                    </ul>
                    <button
                      onClick={() => handleAddFromTemplate(template)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Add All Tasks
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingTaskId ? 'Edit Task' : 'Create New Task'}
          </h2>
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
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Linked Event
              </label>
              <select
                value={formData.event_id}
                onChange={(e) =>
                  setFormData({ ...formData, event_id: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">None</option>
                {events?.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Reminder Date & Time
              </label>
              <input
                type="datetime-local"
                value={formData.reminder_date}
                onChange={(e) =>
                  setFormData({ ...formData, reminder_date: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setEditingTaskId(null)
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
              }}
              className="px-4 py-2 border-2 border-gray-400 text-gray-900 rounded-lg hover:bg-gray-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              disabled={createTask.isPending || editTask.isPending}
            >
              {editingTaskId ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            <KanbanColumn
              id="todo"
              title="To Do"
              tasks={tasksByStatus.todo}
              onEdit={handleEdit}
              onDelete={(id) => deleteTask.mutate(id)}
            />
            <KanbanColumn
              id="in_progress"
              title="In Progress"
              tasks={tasksByStatus.in_progress}
              onEdit={handleEdit}
              onDelete={(id) => deleteTask.mutate(id)}
            />
            <KanbanColumn
              id="completed"
              title="Completed"
              tasks={tasksByStatus.completed}
              onEdit={handleEdit}
              onDelete={(id) => deleteTask.mutate(id)}
            />
            <KanbanColumn
              id="cancelled"
              title="Cancelled"
              tasks={tasksByStatus.cancelled}
              onEdit={handleEdit}
              onDelete={(id) => deleteTask.mutate(id)}
            />
          </div>
          <DragOverlay>
            {activeId ? (
              <div className="bg-white rounded-lg shadow-lg border-2 border-blue-400 p-4 w-64 opacity-90">
                {(() => {
                  const task = tasks?.find(t => t.id === activeId)
                  return task ? (
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm mb-1">{task.title}</h3>
                      <span className="text-xs text-gray-600">{task.priority}</span>
                    </div>
                  ) : null
                })()}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}

export default TasksPage
