import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import api from '../../lib/api'
import { PlusCircle, Trash, Edit, Users, X, Save } from 'lucide-react'

const SeatingChartPage = () => {
  const queryClient = useQueryClient()
  const [showTableForm, setShowTableForm] = useState(false)
  const [editingTable, setEditingTable] = useState(null)
  const [selectedTable, setSelectedTable] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    capacity: 8,
    shape: 'round',
    position_x: 0,
    position_y: 0,
    notes: ''
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ['seating-tables'],
    queryFn: () => api.get('/seating/tables?include_assignments=true').then(res => res.data),
  })

  const { data: unassignedGuests } = useQuery({
    queryKey: ['unassigned-guests'],
    queryFn: () => api.get('/seating/guests/unassigned').then(res => res.data),
  })

  const createTable = useMutation({
    mutationFn: (data) => api.post('/seating/tables', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['seating-tables'])
      resetForm()
      setShowTableForm(false)
    },
  })

  const updateTable = useMutation({
    mutationFn: ({ id, data }) => api.put(`/seating/tables/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['seating-tables'])
      resetForm()
      setShowTableForm(false)
    },
  })

  const deleteTable = useMutation({
    mutationFn: (id) => api.delete(`/seating/tables/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['seating-tables'])
      if (selectedTable === id) setSelectedTable(null)
    },
  })

  const assignGuest = useMutation({
    mutationFn: (data) => api.post('/seating/assignments', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['seating-tables'])
      queryClient.invalidateQueries(['unassigned-guests'])
    },
  })

  const unassignGuest = useMutation({
    mutationFn: (id) => api.delete(`/seating/assignments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['seating-tables'])
      queryClient.invalidateQueries(['unassigned-guests'])
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      capacity: 8,
      shape: 'round',
      position_x: 0,
      position_y: 0,
      notes: ''
    })
    setEditingTable(null)
  }

  const handleEditTable = (table) => {
    setEditingTable(table.id)
    setFormData({
      name: table.name,
      capacity: table.capacity,
      shape: table.shape,
      position_x: table.position_x,
      position_y: table.position_y,
      notes: table.notes || ''
    })
    setShowTableForm(true)
  }

  const handleSubmitTable = (e) => {
    e.preventDefault()
    if (editingTable) {
      updateTable.mutate({ id: editingTable, data: formData })
    } else {
      createTable.mutate(formData)
    }
  }

  const handleDragStart = (event) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current

    // If dragging a guest to a seat
    if (activeData?.type === 'guest' && overData?.type === 'seat') {
      const guestId = activeData.guestId
      const tableId = overData.tableId
      const seatNumber = overData.seatNumber

      // Check if seat is already taken
      const table = tables?.find(t => t.id === tableId)
      const seat = table?.assignments?.find(a => a.seat_number === seatNumber)
      
      if (seat?.guest_id) {
        // Unassign current guest first
        if (seat.id) {
          unassignGuest.mutate(seat.id)
        }
      }

      assignGuest.mutate({
        table_id: tableId,
        seat_number: seatNumber,
        guest_id: guestId
      })
    }

    // If dragging a guest from a seat to another seat
    if (activeData?.type === 'seat' && overData?.type === 'seat') {
      const activeGuestId = activeData.guestId
      const activeTableId = activeData.tableId
      const activeSeatNumber = activeData.seatNumber
      const overTableId = overData.tableId
      const overSeatNumber = overData.seatNumber

      if (activeTableId === overTableId && activeSeatNumber === overSeatNumber) return

      // Unassign from old seat
      const activeTable = tables?.find(t => t.id === activeTableId)
      const activeSeat = activeTable?.assignments?.find(a => a.seat_number === activeSeatNumber)
      if (activeSeat?.id) {
        unassignGuest.mutate(activeSeat.id)
      }

      // Assign to new seat
      assignGuest.mutate({
        table_id: overTableId,
        seat_number: overSeatNumber,
        guest_id: activeGuestId
      })
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  if (tablesLoading) {
    return <div className="p-6">Loading seating chart...</div>
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Seating Chart</h1>
          <p className="text-gray-600 mt-1">Drag and drop guests to assign seats</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowTableForm(true)
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <PlusCircle className="w-5 h-5" />
          Add Table
        </button>
      </div>

      {/* Table Form Modal */}
      {showTableForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  {editingTable ? 'Edit Table' : 'Add New Table'}
                </h2>
                <button
                  onClick={() => {
                    resetForm()
                    setShowTableForm(false)
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmitTable} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Table Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Capacity *</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Shape</label>
                    <select
                      value={formData.shape}
                      onChange={(e) => setFormData({ ...formData, shape: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    >
                      <option value="round">Round</option>
                      <option value="rectangular">Rectangular</option>
                      <option value="square">Square</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm()
                      setShowTableForm(false)
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingTable ? 'Update' : 'Create'} Table
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Unassigned Guests Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Unassigned Guests ({unassignedGuests?.length || 0})
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {unassignedGuests?.map((guest) => (
                <GuestCard
                  key={guest.id}
                  guest={guest}
                  isDragging={activeId === `guest-${guest.id}`}
                />
              ))}
              {(!unassignedGuests || unassignedGuests.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">All guests assigned!</p>
              )}
            </div>
          </div>
        </div>

        {/* Seating Chart Canvas */}
        <div className="lg:col-span-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="bg-gray-50 rounded-lg p-6 min-h-[600px] relative" style={{ position: 'relative' }}>
              {tables?.map((table) => (
                <TableComponent
                  key={table.id}
                  table={table}
                  onEdit={handleEditTable}
                  onDelete={deleteTable.mutate}
                  onSelect={setSelectedTable}
                  isSelected={selectedTable === table.id}
                />
              ))}
              {(!tables || tables.length === 0) && (
                <div className="text-center py-12 text-gray-500">
                  No tables yet. Click "Add Table" to create your seating chart.
                </div>
              )}
            </div>
            <DragOverlay>
              {activeId ? (
                activeId.startsWith('guest-') ? (
                  <div className="bg-blue-100 border-2 border-blue-500 rounded-lg p-3 shadow-lg">
                    <p className="font-medium text-sm">
                      {unassignedGuests?.find(g => g.id === parseInt(activeId.split('-')[1]))?.first_name} {unassignedGuests?.find(g => g.id === parseInt(activeId.split('-')[1]))?.last_name}
                    </p>
                  </div>
                ) : null
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  )
}

// Guest Card Component (Draggable)
function GuestCard({ guest, isDragging }) {
  const { attributes, listeners, setNodeRef, transform, isDragging: isSortableDragging } = useSortable({
    id: `guest-${guest.id}`,
    data: {
      type: 'guest',
      guestId: guest.id,
      guest: guest
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isSortableDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-blue-50 border-2 border-blue-300 rounded-lg p-3 cursor-move hover:bg-blue-100 transition-colors ${isDragging ? 'opacity-50' : ''}`}
    >
      <p className="font-medium text-sm text-gray-900">
        {guest.first_name} {guest.last_name}
      </p>
      {guest.number_of_guests > 1 && (
        <p className="text-xs text-gray-600">+{guest.number_of_guests - 1} guest(s)</p>
      )}
    </div>
  )
}

// Table Component
function TableComponent({ table, onEdit, onDelete, onSelect, isSelected }) {
  const assignments = table.assignments || []
  const occupiedSeats = assignments.filter(a => a.guest_id).length

  return (
    <div
      className={`absolute bg-white border-2 ${isSelected ? 'border-blue-500' : 'border-gray-300'} rounded-lg p-4 shadow-lg cursor-pointer`}
      style={{
        left: `${table.position_x}px`,
        top: `${table.position_y}px`,
        minWidth: '200px'
      }}
      onClick={() => onSelect(table.id)}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{table.name}</h4>
          <p className="text-xs text-gray-600">
            {occupiedSeats} / {table.capacity} seats
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(table)
            }}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (window.confirm(`Delete ${table.name}?`)) {
                onDelete(table.id)
              }
            }}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
          >
            <Trash className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className={`grid gap-2 ${table.shape === 'round' ? 'grid-cols-4' : 'grid-cols-4'}`}>
        {assignments.map((assignment) => (
          <SeatComponent
            key={assignment.id || `seat-${assignment.seat_number}`}
            assignment={assignment}
            tableId={table.id}
          />
        ))}
      </div>
    </div>
  )
}

// Seat Component (Drop Target)
function SeatComponent({ assignment, tableId }) {
  const { setNodeRef, isOver } = useSortable({
    id: `seat-${tableId}-${assignment.seat_number}`,
    data: {
      type: 'seat',
      tableId: tableId,
      seatNumber: assignment.seat_number,
      assignmentId: assignment.id,
      guestId: assignment.guest_id
    },
    disabled: false
  })

  return (
    <div
      ref={setNodeRef}
      className={`w-12 h-12 rounded border-2 flex items-center justify-center text-xs font-medium transition-colors ${
        assignment.guest_id
          ? 'bg-green-100 border-green-400 text-green-800'
          : isOver
          ? 'bg-blue-100 border-blue-400'
          : 'bg-gray-50 border-gray-300 text-gray-500'
      }`}
    >
      {assignment.guest_id ? (
        <div className="text-center">
          <div className="text-[10px] font-bold">
            {assignment.guest?.first_name?.charAt(0) || 'G'}
          </div>
        </div>
      ) : (
        assignment.seat_number
      )}
    </div>
  )
}

export default SeatingChartPage
