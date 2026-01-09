import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  DndContext, 
  DragOverlay, 
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  useDraggable,
  useDroppable
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import api from '../../lib/api'
import { PlusCircle, Trash, Edit, Users, X, Move, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

const ROOM_WIDTH = 2000
const ROOM_HEIGHT = 1500

const SeatingChartPage = () => {
  const queryClient = useQueryClient()
  const [showTableForm, setShowTableForm] = useState(false)
  const [editingTable, setEditingTable] = useState(null)
  const [selectedTable, setSelectedTable] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [draggedTableId, setDraggedTableId] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const roomRef = useRef(null)
  const [formData, setFormData] = useState({
    name: '',
    capacity: 8,
    shape: 'round',
    position_x: 100,
    position_y: 100,
    notes: ''
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
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
      position_x: 100,
      position_y: 100,
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
    const activeData = event.active.data.current
    if (activeData?.type === 'table') {
      setDraggedTableId(activeData.tableId)
    }
  }

  const handleDragEnd = (event) => {
    const { active, over, delta } = event
    const activeData = active.data.current

    // Handle table dragging - must check this first to prevent seat assignment
    if (activeData?.type === 'table') {
      const tableId = activeData.tableId
      const table = tables?.find(t => t.id === tableId)
      if (table && delta) {
        // Calculate new position based on delta (already in screen coordinates, need to convert to room coordinates)
        const newX = Math.max(0, Math.min(ROOM_WIDTH - 200, table.position_x + delta.x / zoom))
        const newY = Math.max(0, Math.min(ROOM_HEIGHT - 200, table.position_y + delta.y / zoom))
        
        updateTable.mutate({
          id: tableId,
          data: {
            ...table,
            position_x: newX,
            position_y: newY
          }
        })
      }
      setActiveId(null)
      setDraggedTableId(null)
      return
    }

    // If no drop target, reset and return
    if (!over) {
      setActiveId(null)
      setDraggedTableId(null)
      return
    }

    setActiveId(null)
    setDraggedTableId(null)

    if (!over) return

    const overData = over.data.current

    // If dragging a guest to a seat
    if (activeData?.type === 'guest' && overData?.type === 'seat') {
      const guestId = activeData.guestId
      const tableId = overData.tableId
      const seatNumber = overData.seatNumber

      // Check if seat is already taken
      const table = tables?.find(t => t.id === tableId)
      const seat = table?.assignments?.find(a => a.seat_number === seatNumber)
      
      // If seat is already taken by a different guest, unassign first
      if (seat?.guest_id && seat.guest_id !== guestId) {
        // Unassign current guest first, then assign new one
        unassignGuest.mutate(seat.id, {
          onSuccess: () => {
            assignGuest.mutate({
              table_id: tableId,
              seat_number: seatNumber,
              guest_id: guestId
            }, {
              onError: (error) => {
                console.error('Error assigning guest:', error)
                alert(error.response?.data?.error || 'Failed to assign guest to seat. Please try again.')
              }
            })
          },
          onError: (error) => {
            console.error('Error unassigning guest:', error)
            alert('Failed to unassign current guest. Please try again.')
          }
        })
      } else {
        // Seat is empty or same guest, just assign
        assignGuest.mutate({
          table_id: tableId,
          seat_number: seatNumber,
          guest_id: guestId
        }, {
          onError: (error) => {
            console.error('Error assigning guest:', error)
            alert(error.response?.data?.error || 'Failed to assign guest to seat. Please try again.')
          }
        })
      }
    }

    // If dragging a guest from a seat to another seat
    if (activeData?.type === 'seat' && overData?.type === 'seat') {
      const activeGuestId = activeData.guestId
      const activeTableId = activeData.tableId
      const activeSeatNumber = activeData.seatNumber
      const overTableId = overData.tableId
      const overSeatNumber = overData.seatNumber

      if (activeTableId === overTableId && activeSeatNumber === overSeatNumber) {
        setActiveId(null)
        setDraggedTableId(null)
        return
      }

      // Check if target seat is already taken
      const overTable = tables?.find(t => t.id === overTableId)
      const overSeat = overTable?.assignments?.find(a => a.seat_number === overSeatNumber)
      
      // Unassign from old seat
      const activeTable = tables?.find(t => t.id === activeTableId)
      const activeSeat = activeTable?.assignments?.find(a => a.seat_number === activeSeatNumber)
      
      if (activeSeat?.id) {
        // If target seat is taken by different guest, unassign it first
        if (overSeat?.guest_id && overSeat.guest_id !== activeGuestId) {
          unassignGuest.mutate(overSeat.id, {
            onSuccess: () => {
              // Then unassign from old seat and assign to new
              unassignGuest.mutate(activeSeat.id, {
                onSuccess: () => {
                  assignGuest.mutate({
                    table_id: overTableId,
                    seat_number: overSeatNumber,
                    guest_id: activeGuestId
                  }, {
                    onError: (error) => {
                      console.error('Error assigning guest:', error)
                      alert(error.response?.data?.error || 'Failed to move guest. Please try again.')
                    }
                  })
                }
              })
            }
          })
        } else {
          // Target seat is empty or same guest, just move
          unassignGuest.mutate(activeSeat.id, {
            onSuccess: () => {
              assignGuest.mutate({
                table_id: overTableId,
                seat_number: overSeatNumber,
                guest_id: activeGuestId
              }, {
                onError: (error) => {
                  console.error('Error assigning guest:', error)
                  alert(error.response?.data?.error || 'Failed to move guest. Please try again.')
                }
              })
            },
            onError: (error) => {
              console.error('Error unassigning guest:', error)
              alert('Failed to unassign guest. Please try again.')
            }
          })
        }
      }
    }
    
    // If dragging a guest to unassigned area (unassign)
    if (activeData?.type === 'seat' && overData?.type === 'unassigned') {
      const activeSeat = tables?.flatMap(t => t.assignments || []).find(a => 
        a.table_id === activeData.tableId && a.seat_number === activeData.seatNumber
      )
      if (activeSeat?.id) {
        unassignGuest.mutate(activeSeat.id, {
          onError: (error) => {
            console.error('Error unassigning guest:', error)
            alert('Failed to unassign guest. Please try again.')
          }
        })
      }
    }
    
    setActiveId(null)
    setDraggedTableId(null)
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setDraggedTableId(null)
  }

  // Pan handlers
  const handleMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) { // Middle mouse or Ctrl+Left
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      e.preventDefault()
    }
  }

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  useEffect(() => {
    const room = roomRef.current
    if (room) {
      room.addEventListener('mousedown', handleMouseDown)
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        room.removeEventListener('mousedown', handleMouseDown)
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isPanning, panStart, pan])

  if (tablesLoading) {
    return <div className="p-6">Loading seating chart...</div>
  }

  const activeGuest = activeId?.startsWith('guest-') 
    ? unassignedGuests?.find(g => g.id === parseInt(activeId.split('-')[1]))
    : null

  const activeSeat = activeId?.startsWith('seat-')
    ? (() => {
        const parts = activeId.split('-')
        const tableId = parseInt(parts[1])
        const seatNumber = parseInt(parts[2])
        const table = tables?.find(t => t.id === tableId)
        return table?.assignments?.find(a => a.seat_number === seatNumber)
      })()
    : null

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Seating Chart</h1>
          <p className="text-gray-600 mt-1">Drag tables to arrange them, drag guests to assign seats</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
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
        <UnassignedGuestsDropZone guests={unassignedGuests} activeId={activeId} />

        {/* Seating Chart Canvas */}
        <div className="lg:col-span-3">
          <DndContext
            sensors={sensors}
            collisionDetection={(args) => {
              // Use pointerWithin for better accuracy with transformed/scaled elements
              // This works better when the room is zoomed or panned
              const pointerCollisions = pointerWithin(args)
              
              // If we have pointer collisions, prefer them
              if (pointerCollisions.length > 0) {
                // Sort by distance to pointer (closest first)
                return pointerCollisions.sort((a, b) => {
                  const aData = a.data.current
                  const bData = b.data.current
                  // Prefer seats over tables
                  if (aData?.type === 'seat' && bData?.type !== 'seat') return -1
                  if (bData?.type === 'seat' && aData?.type !== 'seat') return 1
                  return 0
                })
              }
              
              // Fallback to rect intersection
              return rectIntersection(args)
            }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div 
              ref={roomRef}
              className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-gray-300 overflow-hidden relative"
              style={{
                width: '100%',
                height: 'calc(100vh - 200px)',
                cursor: isPanning ? 'grabbing' : 'default'
              }}
            >
              <div
                className="relative"
                style={{
                  width: `${ROOM_WIDTH}px`,
                  height: `${ROOM_HEIGHT}px`,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'top left',
                }}
              >
                {tables?.map((table) => (
                  <DraggableTable
                    key={table.id}
                    table={table}
                    onEdit={handleEditTable}
                    onDelete={deleteTable.mutate}
                    onSelect={setSelectedTable}
                    isSelected={selectedTable === table.id}
                    isDragging={draggedTableId === table.id}
                  />
                ))}
                {(!tables || tables.length === 0) && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <p className="text-lg mb-2">No tables yet</p>
                      <p className="text-sm">Click "Add Table" to create your seating chart</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DragOverlay>
              {activeGuest && (
                <div className="bg-blue-100 border-2 border-blue-500 rounded-lg p-3 shadow-lg">
                  <p className="font-medium text-sm text-gray-900">
                    {activeGuest.first_name} {activeGuest.last_name}
                  </p>
                </div>
              )}
              {activeSeat && activeSeat.guest && (
                <div className="bg-green-100 border-2 border-green-500 rounded-lg p-2 shadow-lg">
                  <p className="font-medium text-xs text-gray-900">
                    {activeSeat.guest.first_name} {activeSeat.guest.last_name}
                  </p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  )
}

// Guest Card Component (Draggable)
function GuestCard({ guest, isDragging }) {
  const { attributes, listeners, setNodeRef, transform, isDragging: isSortableDragging } = useDraggable({
    id: `guest-${guest.id}`,
    data: {
      type: 'guest',
      guestId: guest.id,
      guest: guest
    }
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isSortableDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
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

// Draggable Table Component
function DraggableTable({ table, onEdit, onDelete, onSelect, isSelected, isDragging }) {
  const assignments = table.assignments || []
  const occupiedSeats = assignments.filter(a => a.guest_id).length

  const { attributes, listeners, setNodeRef, transform, isDragging: isTableDragging } = useDraggable({
    id: `table-${table.id}`,
    data: {
      type: 'table',
      tableId: table.id,
      table: table
    }
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isTableDragging ? 0.7 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: 'absolute',
        left: `${table.position_x}px`,
        top: `${table.position_y}px`,
        zIndex: isSelected ? 10 : 1,
      }}
      className={`bg-white border-2 ${isSelected ? 'border-blue-500 shadow-xl' : 'border-gray-300'} rounded-lg p-4 shadow-lg transition-all ${
        isTableDragging ? 'cursor-grabbing' : 'cursor-move'
      }`}
      onClick={(e) => {
        if (!isTableDragging) {
          onSelect(table.id)
        }
      }}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 cursor-move"
        onClick={(e) => e.stopPropagation()}
      >
        <Move className="w-4 h-4" />
      </div>

      <div className="flex justify-between items-start mb-3 pr-6">
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
            title="Edit table"
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
            title="Delete table"
          >
            <Trash className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Seats Grid */}
      <div className={`grid gap-2 ${
        table.shape === 'round' 
          ? 'grid-cols-4' 
          : table.shape === 'rectangular'
          ? 'grid-cols-4'
          : 'grid-cols-3'
      }`}>
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
  // Always make it droppable
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `seat-${tableId}-${assignment.seat_number}`,
    data: {
      type: 'seat',
      tableId: tableId,
      seatNumber: assignment.seat_number,
      assignmentId: assignment.id,
      guestId: assignment.guest_id
    }
  })

  // Only make it draggable if it has a guest
  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: `seat-${tableId}-${assignment.seat_number}`,
    data: {
      type: 'seat',
      tableId: tableId,
      seatNumber: assignment.seat_number,
      assignmentId: assignment.id,
      guestId: assignment.guest_id,
      guest: assignment.guest
    },
    disabled: !assignment.guest_id
  })

  // Combine refs properly
  const combinedRef = React.useCallback((node) => {
    setDroppableRef(node)
    if (assignment.guest_id) {
      setDraggableRef(node)
    }
  }, [setDroppableRef, setDraggableRef, assignment.guest_id])

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <div
      ref={combinedRef}
      style={style}
      {...(assignment.guest_id ? listeners : {})}
      {...(assignment.guest_id ? attributes : {})}
      className={`min-w-[60px] min-h-[60px] rounded border-2 flex flex-col items-center justify-center text-xs font-medium transition-all ${
        assignment.guest_id
          ? isOver
            ? 'bg-green-200 border-green-500 shadow-lg scale-105'
            : isDragging
            ? 'bg-green-100 border-green-400 opacity-50'
            : 'bg-green-100 border-green-400 text-green-800 cursor-move hover:bg-green-200'
          : isOver
          ? 'bg-blue-200 border-blue-500 shadow-lg scale-105'
          : 'bg-gray-50 border-gray-300 text-gray-500'
      }`}
    >
      {assignment.guest_id ? (
        <div className="text-center px-1">
          <div className="font-bold text-[10px] leading-tight">
            {assignment.guest?.first_name || 'Guest'}
          </div>
          <div className="font-semibold text-[9px] leading-tight text-gray-600">
            {assignment.guest?.last_name || ''}
          </div>
        </div>
      ) : (
        <span className="text-gray-400">{assignment.seat_number}</span>
      )}
    </div>
  )
}

// Unassigned Guests Drop Zone Component
function UnassignedGuestsDropZone({ guests, activeId }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unassigned-guests',
    data: { type: 'unassigned' }
  })

  return (
    <div className="lg:col-span-1">
      <div className="bg-white rounded-lg shadow p-4 sticky top-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Unassigned Guests ({guests?.length || 0})
        </h3>
        <div 
          ref={setNodeRef}
          className={`space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto min-h-[100px] p-2 border-2 border-dashed rounded transition-colors ${
            isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
        >
          {guests?.map((guest) => (
            <GuestCard
              key={guest.id}
              guest={guest}
              isDragging={activeId === `guest-${guest.id}`}
            />
          ))}
          {(!guests || guests.length === 0) && (
            <p className="text-sm text-gray-500 text-center py-4">All guests assigned! Drag guests here to unassign.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default SeatingChartPage
