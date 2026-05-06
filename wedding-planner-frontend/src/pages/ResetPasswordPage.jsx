import { useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789',
  'qwerty123', 'qwertyuiop', 'iloveyou', 'sunshine', 'princess',
  'letmein', 'monkey123', 'dragon123', 'master123', 'welcome1',
])

function inputClass(hasError) {
  return `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent text-gray-900 ${
    hasError ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
  }`
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { resetPassword } = useAuth()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState({})
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-800">Invalid reset link</h1>
          <p className="text-gray-500 mt-2 text-sm mb-6">
            No reset token found. Please request a new password reset.
          </p>
          <Link
            to="/auth?tab=login"
            className="inline-block py-3 px-6 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  const validate = () => {
    const e = {}
    if (!password) {
      e.password = 'Password is required'
    } else if (password.length < 8) {
      e.password = 'Password must be at least 8 characters'
    } else if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      e.password = 'Password is too common. Please choose a stronger one.'
    }
    if (!confirmation) {
      e.confirmation = 'Please confirm your password'
    } else if (password !== confirmation) {
      e.confirmation = 'Passwords do not match'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGlobalError('')
    if (!validate()) return

    setLoading(true)
    try {
      const result = await resetPassword(token, password, confirmation)
      if (result.success) {
        setDone(true)
        setTimeout(() => navigate('/auth?tab=login', { replace: true }), 3000)
      } else {
        if (result.errors?.length) {
          setErrors({ password: result.errors.join(' ') })
        } else {
          setGlobalError(result.error || 'Password reset failed')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-800">Password reset!</h1>
          <p className="text-gray-500 mt-2 text-sm mb-6">
            Your password has been updated. Redirecting to sign in…
          </p>
          <Link
            to="/auth?tab=login"
            className="inline-block py-3 px-6 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90"
          >
            Sign in now
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold text-gray-900">Choose a new password</h1>
          <p className="text-gray-500 mt-1 text-sm">Enter and confirm your new password below.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          {globalError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {globalError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass(errors.password)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className={inputClass(errors.confirmation)}
                placeholder="Repeat password"
                autoComplete="new-password"
              />
              {errors.confirmation && <p className="mt-1 text-xs text-red-600">{errors.confirmation}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Resetting…' : 'Reset password'}
            </button>

            <p className="text-center text-sm text-gray-400">
              <Link to="/auth?tab=login" className="hover:text-pink-600 transition-colors">
                ← Back to sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
