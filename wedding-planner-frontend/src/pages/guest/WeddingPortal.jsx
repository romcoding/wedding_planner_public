import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { Heart, MapPin, Calendar, Loader2 } from 'lucide-react'
import api from '../../lib/api'

/**
 * Public wedding portal at /w/:slug
 * No authentication required — readable by anyone with the link.
 */
export default function WeddingPortal() {
  const { slug } = useParams()
  const [wedding, setWedding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    api.get(`/weddings/by-slug/${slug}`)
      .then((res) => setWedding(res.data))
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rose-50">
        <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-rose-50 text-center px-4">
        <Heart className="w-12 h-12 text-rose-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Wedding not found</h1>
        <p className="text-gray-500 text-sm">The wedding portal at <strong>/w/{slug}</strong> does not exist or is no longer active.</p>
      </div>
    )
  }

  if (!wedding) return null

  const weddingDate = wedding.wedding_date
    ? new Date(wedding.wedding_date).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : null

  const daysUntil = wedding.wedding_date
    ? Math.ceil((new Date(wedding.wedding_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50">
      {/* Hero */}
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-12 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-px bg-rose-200 flex-1" />
          <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
          <div className="h-px bg-rose-200 flex-1" />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
          {wedding.partner_one_name} & {wedding.partner_two_name}
        </h1>

        {weddingDate && (
          <p className="text-lg text-rose-600 font-medium mb-2">{weddingDate}</p>
        )}

        {wedding.location && (
          <div className="flex items-center justify-center gap-1.5 text-gray-500 text-sm">
            <MapPin className="w-4 h-4" />
            <span>{wedding.location}</span>
          </div>
        )}

        {daysUntil !== null && daysUntil > 0 && (
          <div className="mt-6 inline-flex items-center gap-2 bg-white border border-rose-200 rounded-full px-5 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-rose-500" />
            <span className="text-sm font-medium text-gray-700">
              {daysUntil === 1 ? 'Tomorrow!' : `${daysUntil} days to go`}
            </span>
          </div>
        )}

        {daysUntil !== null && daysUntil <= 0 && (
          <div className="mt-6 inline-flex items-center gap-2 bg-rose-500 text-white rounded-full px-5 py-2 shadow-sm">
            <Heart className="w-4 h-4 fill-white" />
            <span className="text-sm font-medium">We're married!</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="max-w-sm mx-auto flex items-center gap-4 px-4 mb-12">
        <div className="h-px bg-gray-200 flex-1" />
        <span className="text-xs text-gray-400 uppercase tracking-wider">Welcome</span>
        <div className="h-px bg-gray-200 flex-1" />
      </div>

      {/* Welcome card */}
      <div className="max-w-lg mx-auto px-4 mb-16">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-gray-600 leading-relaxed">
            We're so happy to share this special day with you. Please use this page to RSVP, find travel information, and stay up to date with all the details.
          </p>
          <div className="mt-6">
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium px-6 py-3 rounded-xl transition-colors"
            >
              <Heart className="w-4 h-4" />
              RSVP & View Details
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-8">
        <p className="text-xs text-gray-400">
          Powered by{' '}
          <span className="text-rose-400 font-medium">Wedding Planner AI</span>
        </p>
      </div>
    </div>
  )
}
