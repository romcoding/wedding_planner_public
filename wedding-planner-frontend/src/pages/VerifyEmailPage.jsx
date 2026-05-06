import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import api from '../lib/api'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState('verifying') // verifying | success | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token found in the URL.')
      return
    }

    api.post('/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch((err) => {
        const detail = err.response?.data?.detail
        setMessage(typeof detail === 'string' ? detail : 'Verification failed. The link may be expired or already used.')
        setStatus('error')
      })
  }, [token])

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
        {status === 'verifying' && (
          <>
            <div className="text-5xl mb-4">⏳</div>
            <h1 className="text-xl font-bold text-gray-800">Verifying your email…</h1>
            <p className="text-gray-500 mt-2 text-sm">Just a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-gray-800">Email verified!</h1>
            <p className="text-gray-500 mt-2 text-sm mb-6">
              Your account is now active. You can sign in and start planning.
            </p>
            <Link
              to="/auth?tab=login"
              className="inline-block py-3 px-6 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              Go to sign in
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-xl font-bold text-gray-800">Verification failed</h1>
            <p className="text-gray-500 mt-2 text-sm mb-6">{message}</p>
            <Link
              to="/auth?tab=login"
              className="inline-block py-3 px-6 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
