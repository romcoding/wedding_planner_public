import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import { Edit, Plane, Gift, ArrowLeft, Calendar, MapPin, Music } from 'lucide-react'

export default function GuestInfo() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState(null)

  // Fetch images from API
  const { data: images, isLoading: imagesLoading } = useQuery({
    queryKey: ['images'],
    queryFn: () => api.get('/images').then((res) => res.data),
  })

  // Get images by position
  const infoTopImage = images?.find(img => img.position === 'info_top' && img.is_active && img.is_public)
  const editRsvpImage = images?.find(img => img.position === 'edit_rsvp' && img.is_active && img.is_public)
  const travelImage = images?.find(img => img.position === 'travel' && img.is_active && img.is_public)
  const giftsImage = images?.find(img => img.position === 'gifts' && img.is_active && img.is_public)

  const handleSectionClick = (section) => {
    setActiveSection(section)
  }

  const handleBack = () => {
    if (activeSection) {
      setActiveSection(null)
    } else {
      navigate('/')
    }
  }

  // If a section is active, show its content
  if (activeSection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            {activeSection === 'edit_rsvp' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Edit className="w-8 h-8 text-pink-500" />
                  <h2 className="text-3xl font-bold text-gray-900">Edit RSVP</h2>
                </div>
                <p className="text-gray-600 mb-6">
                  You can update your RSVP information at any time. Please contact us if you need to make changes.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 font-medium transition-all"
                >
                  Go to RSVP Form
                </button>
              </div>
            )}

            {activeSection === 'travel' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Plane className="w-8 h-8 text-pink-500" />
                  <h2 className="text-3xl font-bold text-gray-900">Travel & Accommodation</h2>
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-pink-500" />
                      Venue Location
                    </h3>
                    <p className="text-gray-600">
                      The wedding will take place at a beautiful venue. Detailed directions and parking information will be sent closer to the date.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Plane className="w-5 h-5 text-pink-500" />
                      Recommended Hotels
                    </h3>
                    <p className="text-gray-600 mb-4">
                      We have reserved blocks of rooms at the following hotels:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>Hotel Option 1 - Contact: (555) 123-4567</li>
                      <li>Hotel Option 2 - Contact: (555) 234-5678</li>
                      <li>Hotel Option 3 - Contact: (555) 345-6789</li>
                    </ul>
                    <p className="text-sm text-gray-500 mt-4">
                      * Mention the wedding when booking to receive the group rate
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">Transportation</h3>
                    <p className="text-gray-600">
                      Shuttle service will be provided from the recommended hotels to the venue. More details will be provided in your confirmation email.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'gifts' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Gift className="w-8 h-8 text-pink-500" />
                  <h2 className="text-3xl font-bold text-gray-900">Event & Gifts</h2>
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-pink-500" />
                      Event Schedule
                    </h3>
                    <div className="space-y-4">
                      <div className="border-l-4 border-pink-500 pl-4">
                        <h4 className="font-semibold text-gray-900">Ceremony</h4>
                        <p className="text-gray-600">Date and time to be confirmed</p>
                      </div>
                      <div className="border-l-4 border-purple-500 pl-4">
                        <h4 className="font-semibold text-gray-900">Cocktail Hour</h4>
                        <p className="text-gray-600">Date and time to be confirmed</p>
                      </div>
                      <div className="border-l-4 border-pink-500 pl-4">
                        <h4 className="font-semibold text-gray-900">Reception</h4>
                        <p className="text-gray-600">Date and time to be confirmed</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Gift className="w-5 h-5 text-pink-500" />
                      Gift Registry
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Your presence at our wedding is the greatest gift of all. However, if you wish to honor us with a gift, we have registered at:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>Registry Option 1 - Link will be provided</li>
                      <li>Registry Option 2 - Link will be provided</li>
                    </ul>
                    <p className="text-sm text-gray-500 mt-4">
                      We also appreciate contributions to our honeymoon fund.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Music className="w-5 h-5 text-pink-500" />
                      Dress Code
                    </h3>
                    <p className="text-gray-600">
                      We'd love to see you dressed in your finest! Formal attire is requested. Please avoid white.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Main info page with image grid
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Top Image */}
      <div className="relative overflow-hidden">
        {infoTopImage ? (
          <div className="relative h-64 md:h-96 overflow-hidden">
            <img
              src={infoTopImage.url}
              alt={infoTopImage.alt_text || 'Wedding Information'}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center px-4">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
                  Wedding Information
                </h1>
                <p className="text-xl text-white/90 drop-shadow-md">
                  Everything you need to know
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative h-64 md:h-96 bg-gradient-to-br from-pink-200 via-purple-200 to-pink-300 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
                Wedding Information
              </h1>
              <p className="text-xl text-white/90 drop-shadow-md">
                Everything you need to know
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Edit RSVP */}
          <div
            onClick={() => handleSectionClick('edit_rsvp')}
            className="relative h-80 rounded-2xl overflow-hidden shadow-xl cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl group"
          >
            {editRsvpImage ? (
              <img
                src={editRsvpImage.url}
                alt={editRsvpImage.alt_text || 'Edit RSVP'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center">
                <Edit className="w-16 h-16 text-white/80" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-all"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <Edit className="w-12 h-12 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-2xl font-bold mb-2">Edit RSVP</h3>
                <p className="text-white/90">Update your information</p>
              </div>
            </div>
          </div>

          {/* Travel & Accommodation */}
          <div
            onClick={() => handleSectionClick('travel')}
            className="relative h-80 rounded-2xl overflow-hidden shadow-xl cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl group"
          >
            {travelImage ? (
              <img
                src={travelImage.url}
                alt={travelImage.alt_text || 'Travel & Accommodation'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center">
                <Plane className="w-16 h-16 text-white/80" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-all"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <Plane className="w-12 h-12 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-2xl font-bold mb-2">Travel & Accommodation</h3>
                <p className="text-white/90">Hotels and directions</p>
              </div>
            </div>
          </div>

          {/* Event & Gifts */}
          <div
            onClick={() => handleSectionClick('gifts')}
            className="relative h-80 rounded-2xl overflow-hidden shadow-xl cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl group"
          >
            {giftsImage ? (
              <img
                src={giftsImage.url}
                alt={giftsImage.alt_text || 'Event & Gifts'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center">
                <Gift className="w-16 h-16 text-white/80" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-all"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <Gift className="w-12 h-12 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-2xl font-bold mb-2">Event & Gifts</h3>
                <p className="text-white/90">Schedule and registry</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
