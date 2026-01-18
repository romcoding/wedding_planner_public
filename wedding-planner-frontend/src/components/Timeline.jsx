import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { Calendar, MapPin, Clock } from 'lucide-react'

export default function Timeline() {
  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/events').then((res) => res.data),
  })

  const visibleEvents = Array.isArray(events)
    ? events.filter((e) => e?.is_public !== false)
    : []

  if (isLoading) {
    return <div className="text-center py-8">Loading timeline...</div>
  }

  if (!visibleEvents || visibleEvents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>No events scheduled yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Wedding Timeline</h2>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-pink-300 via-purple-300 to-pink-300"></div>
        
        {visibleEvents.map((event, index) => {
          const startDate = new Date(event.start_time)
          const endDate = event.end_time ? new Date(event.end_time) : null
          
          return (
            <div key={event.id} className="relative pl-12 pb-8">
              {/* Timeline dot */}
              <div className="absolute left-2 top-2 w-4 h-4 bg-pink-500 rounded-full border-4 border-white shadow-lg"></div>
              
              {/* Event card */}
              <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{event.name}</h3>
                    
                    {event.description && (
                      <p className="text-gray-600 mb-4">{event.description}</p>
                    )}
                    
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-pink-500" />
                        <span>
                          {startDate.toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span>
                          {startDate.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit' 
                          })}
                          {endDate && ` - ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                        </span>
                      </div>
                      
                      {event.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-pink-500" />
                          <span>{event.location}</span>
                        </div>
                      )}
                      
                      {event.dress_code && (
                        <div className="mt-2">
                          <span className="font-medium text-gray-700">Dress Code: </span>
                          <span className="text-gray-600">{event.dress_code}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

