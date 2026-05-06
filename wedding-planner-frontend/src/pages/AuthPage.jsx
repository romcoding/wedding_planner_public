import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// ---------- Inline password strength scorer (no external dep) ----------
// Returns { score: 0-4, label, color } based on OWASP-informed heuristics.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789',
  'qwerty123', 'qwertyuiop', 'iloveyou', 'sunshine', 'princess',
  'letmein', 'monkey123', 'dragon123', 'master123', 'welcome1',
])

function scorePassword(pw) {
  if (!pw) return { score: 0, label: '', color: '' }
  if (pw.length < 8 || COMMON_PASSWORDS.has(pw.toLowerCase())) {
    return { score: 1, label: 'Too weak', color: 'bg-red-500' }
  }
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const clamped = Math.min(Math.max(score - 1, 1), 4)
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['', 'bg-red-500', 'bg-yellow-400', 'bg-blue-500', 'bg-green-500']
  return { score: clamped, label: labels[clamped], color: colors[clamped] }
}

function PasswordStrengthMeter({ password }) {
  const { score, label, color } = scorePassword(password)
  if (!password) return null
  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${s <= score ? color : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <p className={`text-xs ${score <= 1 ? 'text-red-500' : score === 2 ? 'text-yellow-600' : score === 3 ? 'text-blue-600' : 'text-green-600'}`}>
        {label}
        {score < 3 && password.length >= 8 && (
          <span className="text-gray-400"> — try adding uppercase, numbers or symbols</span>
        )}
      </p>
    </div>
  )
}

// ---------- Field error helper ----------
function FieldError({ message }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-600">{message}</p>
}

function inputClass(hasError) {
  return `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent ${
    hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'
  }`
}

// ---------- Main page ----------
export default function AuthPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login, registerCouple, user } = useAuth()

  const [tab, setTab] = useState(searchParams.get('tab') === 'register' ? 'register' : 'login')
  const [loading, setLoading] = useState(false)
  const [globalError, setGlobalError] = useState('')

  // Login form state
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginErrors, setLoginErrors] = useState({})

  // Register form state
  const [registerForm, setRegisterForm] = useState({
    email: '',
    password: '',
    password_confirmation: '',
    partner_one_first_name: '',
    partner_one_last_name: '',
    partner_two_first_name: '',
    partner_two_last_name: '',
    wedding_date: '',
    location: '',
  })
  const [registerErrors, setRegisterErrors] = useState({})

  // Post-registration: show "check your email" message
  const [registrationDone, setRegistrationDone] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

  // Sync tab from URL
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'register' || tabParam === 'login') {
      setTab(tabParam)
    }
  }, [searchParams])

  const handleTabChange = (newTab) => {
    setTab(newTab)
    setGlobalError('')
    setLoginErrors({})
    setRegisterErrors({})
    setRegistrationDone(false)
    navigate(`/auth?tab=${newTab}`, { replace: true })
  }

  // ---------- Login ----------
  const validateLogin = () => {
    const errors = {}
    if (!loginForm.email.trim()) errors.email = 'Email is required'
    if (!loginForm.password) errors.password = 'Password is required'
    setLoginErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setGlobalError('')
    if (!validateLogin()) return

    setLoading(true)
    try {
      const result = await login(loginForm.email, loginForm.password)
      if (result.success) {
        navigate('/dashboard', { replace: true })
      } else {
        setGlobalError(result.error || 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  // ---------- Register ----------
  const validateRegister = () => {
    const errors = {}
    if (!registerForm.email.trim()) errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerForm.email.trim()))
      errors.email = 'Enter a valid email address'

    if (!registerForm.partner_one_first_name.trim())
      errors.partner_one_first_name = 'First name is required'
    if (!registerForm.partner_one_last_name.trim())
      errors.partner_one_last_name = 'Last name is required'
    if (!registerForm.partner_two_first_name.trim())
      errors.partner_two_first_name = 'First name is required'
    if (!registerForm.partner_two_last_name.trim())
      errors.partner_two_last_name = 'Last name is required'

    if (!registerForm.password) {
      errors.password = 'Password is required'
    } else if (registerForm.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    } else if (COMMON_PASSWORDS.has(registerForm.password.toLowerCase())) {
      errors.password = 'Password is too common. Please choose a stronger password.'
    }

    if (!registerForm.password_confirmation) {
      errors.password_confirmation = 'Please confirm your password'
    } else if (registerForm.password !== registerForm.password_confirmation) {
      errors.password_confirmation = 'Passwords do not match'
    }

    setRegisterErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setGlobalError('')
    if (!validateRegister()) return

    setLoading(true)
    try {
      const result = await registerCouple({
        email: registerForm.email,
        password: registerForm.password,
        password_confirmation: registerForm.password_confirmation,
        partner_one_first_name: registerForm.partner_one_first_name,
        partner_one_last_name: registerForm.partner_one_last_name,
        partner_two_first_name: registerForm.partner_two_first_name,
        partner_two_last_name: registerForm.partner_two_last_name,
        wedding_date: registerForm.wedding_date || undefined,
        location: registerForm.location || undefined,
      })
      if (result.success) {
        // Show email verification notice rather than redirecting straight to onboarding
        if (result.data?.email_verification_required) {
          setRegistrationDone(true)
        } else {
          navigate('/onboarding', { replace: true })
        }
      } else {
        // Surface per-field errors returned from the backend
        const errData = result.errorData
        if (errData?.missing_fields) {
          const fieldErrors = {}
          errData.missing_fields.forEach((f) => { fieldErrors[f] = 'This field is required' })
          setRegisterErrors(fieldErrors)
        } else {
          setGlobalError(result.error || 'Registration failed')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">💍</div>
          <h1 className="text-3xl font-bold text-gray-900">Wedding Planner</h1>
          <p className="text-gray-500 mt-1">AI Wedding OS</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => handleTabChange('login')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === 'login'
                  ? 'text-pink-600 border-b-2 border-pink-500 bg-pink-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Log in
            </button>
            <button
              onClick={() => handleTabChange('register')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === 'register'
                  ? 'text-pink-600 border-b-2 border-pink-500 bg-pink-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Create account
            </button>
          </div>

          <div className="p-6">
            {globalError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {globalError}
              </div>
            )}

            {/* Login form */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4" noValidate>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    className={inputClass(loginErrors.email)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  <FieldError message={loginErrors.email} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className={inputClass(loginErrors.password)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <FieldError message={loginErrors.password} />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
                <p className="text-center text-sm text-gray-500">
                  New couple?{' '}
                  <button
                    type="button"
                    onClick={() => handleTabChange('register')}
                    className="text-pink-600 font-medium hover:underline"
                  >
                    Create account
                  </button>
                </p>
              </form>
            )}

            {/* Register form — email verification success state */}
            {tab === 'register' && registrationDone && (
              <div className="text-center py-6 space-y-4">
                <div className="text-5xl">📬</div>
                <h2 className="text-lg font-bold text-gray-800">Check your inbox!</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  We sent a verification link to <strong>{registerForm.email}</strong>.
                  Click the link in the email to activate your account and start planning.
                </p>
                <p className="text-xs text-gray-400">The link expires in 24 hours.</p>
                <button
                  type="button"
                  onClick={() => handleTabChange('login')}
                  className="mt-4 text-sm text-pink-600 font-medium hover:underline"
                >
                  Go to sign in →
                </button>
              </div>
            )}

            {/* Register form */}
            {tab === 'register' && !registrationDone && (
              <form onSubmit={handleRegister} className="space-y-4" noValidate>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    className={inputClass(registerErrors.email)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  <FieldError message={registerErrors.email} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Partner 1 — First name</label>
                    <input
                      type="text"
                      value={registerForm.partner_one_first_name}
                      onChange={(e) => setRegisterForm({ ...registerForm, partner_one_first_name: e.target.value })}
                      className={inputClass(registerErrors.partner_one_first_name)}
                      placeholder="Alex"
                    />
                    <FieldError message={registerErrors.partner_one_first_name} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                    <input
                      type="text"
                      value={registerForm.partner_one_last_name}
                      onChange={(e) => setRegisterForm({ ...registerForm, partner_one_last_name: e.target.value })}
                      className={inputClass(registerErrors.partner_one_last_name)}
                      placeholder="Smith"
                    />
                    <FieldError message={registerErrors.partner_one_last_name} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Partner 2 — First name</label>
                    <input
                      type="text"
                      value={registerForm.partner_two_first_name}
                      onChange={(e) => setRegisterForm({ ...registerForm, partner_two_first_name: e.target.value })}
                      className={inputClass(registerErrors.partner_two_first_name)}
                      placeholder="Jordan"
                    />
                    <FieldError message={registerErrors.partner_two_first_name} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                    <input
                      type="text"
                      value={registerForm.partner_two_last_name}
                      onChange={(e) => setRegisterForm({ ...registerForm, partner_two_last_name: e.target.value })}
                      className={inputClass(registerErrors.partner_two_last_name)}
                      placeholder="Lee"
                    />
                    <FieldError message={registerErrors.partner_two_last_name} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Wedding date <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={registerForm.wedding_date}
                    onChange={(e) => setRegisterForm({ ...registerForm, wedding_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    className={inputClass(registerErrors.password)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <PasswordStrengthMeter password={registerForm.password} />
                  <FieldError message={registerErrors.password} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                  <input
                    type="password"
                    value={registerForm.password_confirmation}
                    onChange={(e) => setRegisterForm({ ...registerForm, password_confirmation: e.target.value })}
                    className={inputClass(registerErrors.password_confirmation)}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                  />
                  <FieldError message={registerErrors.password_confirmation} />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Creating account...' : 'Start for free'}
                </button>

                <p className="text-center text-sm text-gray-500">
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => handleTabChange('login')}
                    className="text-pink-600 font-medium hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
