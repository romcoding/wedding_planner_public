import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
        <Heart className="w-12 h-12 text-pink-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-800">Page not found</h1>
        <p className="text-gray-500 mt-2 text-sm mb-6">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <Link
          to="/"
          className="inline-block px-6 py-2 text-white rounded-lg hover:opacity-90"
          style={{ backgroundColor: 'var(--wp-primary, #ec4899)' }}
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
