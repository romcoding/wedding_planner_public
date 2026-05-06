import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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

function FieldError({ message }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-600">{message}</p>
}

function inputClass(hasError) {
  return `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent text-gray-900 ${
    hasError ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
  }`
}

export default function AuthPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login, registerCouple, resendVerification, forgotPassword, user } = useAuth()

  const [tab, setTab] = useState(searchParams.get('tab') === 'register' ? 'register' : 'login')
  const [loading, setLoading] = useState(false)
  const [globalError, setGlobalError] = useState('')

  // Login
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginErrors, setLoginErrors] = useState({})
  // When login fails due to unverified email
  const [needsVerificationEmail, setNeedsVerificationEmail] = useState('')
  const [resendStatus, setResendStatus] = useState('')

  // Forgot password
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotStatus, setForgotStatus] = useState('')
  const [forgotError, setForgotError] = useState('')

  // Register
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
  const [registrationDone, setRegistrationDone] = useState(false)
  const [resendRegStatus, setResendRegStatus] = useState('')

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'register' || tabParam === 'login') setTab(tabParam)
  }, [searchParams])

  const handleTabChange = (newTab) => {
    setTab(newTab)
    setGlobalError('')
    setLoginErrors({})
    setRegisterErrors({})
    setRegistrationDone(false)
    setNeedsVerificationEmail('')
    setResendStatus('')
    setShowForgot(false)
    setForgotStatus('')
    setForgotError('')
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
    setNeedsVerificationEmail('')
    setResendStatus('')
    if (!validateLogin()) return

    setLoading(true)
    try {
      const result = await login(loginForm.email, loginForm.password)
      if (result.success) {
        navigate('/dashboard', { replace: true })
      } else if (result.errorCode === 'email_not_verified') {
        setNeedsVerificationEmail(result.email || loginForm.email)
        setGlobalError(result.error)
      } else {
        setGlobalError(result.error || 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendFromLogin = async () => {
    setResendStatus('sending')
    const result = await resendVerification(needsVerificationEmail)
    setResendStatus(result.success ? 'sent' : 'error')
  }

  // ---------- Forgot password ----------
  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setForgotError('')
    if (!forgotEmail.trim()) { setForgotError('Please enter your email'); return }
    setLoading(true)
    try {
      const result = await forgotPassword(forgotEmail.trim())
      if (result.success) {
        setForgotStatus('sent')
      } else {
        setForgotError(result.error || 'Something went wrong')
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
    if (!registerForm.partner_two_first_name.trim())
      errors.partner_two_first_name = 'First name is required'

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
        partner_one_last_name: registerForm.partner_one_last_name || '',
        partner_two_first_name: registerForm.partner_two_first_name,
        partner_two_last_name: registerForm.partner_two_last_name || '',
        wedding_date: registerForm.wedding_date || undefined,
        location: registerForm.location || undefined,
      })
      if (result.success) {
        if (result.data?.email_verification_required) {
          setRegistrationDone(true)
        } else {
          navigate('/onboarding', { replace: true })
        }
      } else {
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

  const handleResendAfterRegister = async () => {
    setResendRegStatus('sending')
    const result = await resendVerification(registerForm.email)
    setResendRegStatus(result.success ? 'sent' : 'error')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">💍</div>
          <h1 className="text-3xl font-bold text-gray-900">Wedding Planner</h1>
          <p className="text-gray-500 mt-1">AI Wedding OS</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
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
            {globalError && !needsVerificationEmail && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {globalError}
              </div>
            )}

            {/* ── Login form ── */}
            {tab === 'login' && !showForgot && (
              <form onSubmit={handleLogin} className="space-y-4" noValidate>
                {/* Unverified email banner */}
                {needsVerificationEmail && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <p className="font-medium mb-1">Email not verified</p>
                    <p className="mb-2">{globalError}</p>
                    {resendStatus === 'sent' ? (
                      <p className="text-green-700 font-medium">Verification email sent! Check your inbox.</p>
                    ) : resendStatus === 'error' ? (
                      <p className="text-red-600">Could not resend — try again shortly.</p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendFromLogin}
                        disabled={resendStatus === 'sending'}
                        className="text-pink-700 font-semibold underline hover:no-underline disabled:opacity-60"
                      >
                        {resendStatus === 'sending' ? 'Sending…' : 'Resend verification email'}
                      </button>
                    )}
                  </div>
                )}

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
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
                <div className="flex items-center justify-between text-sm">
                  <p className="text-gray-500">
                    New couple?{' '}
                    <button
                      type="button"
                      onClick={() => handleTabChange('register')}
                      className="text-pink-600 font-medium hover:underline"
                    >
                      Create account
                    </button>
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowForgot(true); setGlobalError('') }}
                    className="text-gray-400 hover:text-pink-600 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              </form>
            )}

            {/* ── Forgot password form ── */}
            {tab === 'login' && showForgot && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => { setShowForgot(false); setForgotStatus(''); setForgotError('') }}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  ← Back to sign in
                </button>
                <h2 className="text-lg font-semibold text-gray-800">Reset your password</h2>
                {forgotStatus === 'sent' ? (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-4xl">📬</p>
                    <p className="text-sm text-gray-600">
                      If <strong>{forgotEmail}</strong> is registered, we've sent a reset link.
                      Check your inbox — the link expires in 1 hour.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setShowForgot(false); setForgotStatus('') }}
                      className="text-sm text-pink-600 font-medium hover:underline"
                    >
                      Back to sign in →
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4" noValidate>
                    {forgotError && (
                      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{forgotError}</p>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your email</label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className={inputClass(false)}
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                      {loading ? 'Sending…' : 'Send reset link'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ── Register: email verification success ── */}
            {tab === 'register' && registrationDone && (
              <div className="text-center py-6 space-y-4">
                <div className="text-5xl">📬</div>
                <h2 className="text-lg font-bold text-gray-800">Check your inbox!</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  We sent a verification link to <strong>{registerForm.email}</strong>.
                  Click the link to activate your account and start planning.
                </p>
                <p className="text-xs text-gray-400">The link expires in 24 hours.</p>

                {resendRegStatus === 'sent' ? (
                  <p className="text-sm text-green-700 font-medium">Verification email re-sent!</p>
                ) : resendRegStatus === 'error' ? (
                  <p className="text-sm text-red-600">Could not resend — try again shortly.</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendAfterRegister}
                    disabled={resendRegStatus === 'sending'}
                    className="text-sm text-pink-600 font-medium hover:underline disabled:opacity-60"
                  >
                    {resendRegStatus === 'sending' ? 'Sending…' : "Didn't get it? Resend verification email"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleTabChange('login')}
                  className="block w-full mt-2 text-sm text-gray-400 hover:text-gray-600"
                >
                  Go to sign in →
                </button>
              </div>
            )}

            {/* ── Register form ── */}
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
                      autoComplete="given-name"
                    />
                    <FieldError message={registerErrors.partner_one_first_name} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last name <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={registerForm.partner_one_last_name}
                      onChange={(e) => setRegisterForm({ ...registerForm, partner_one_last_name: e.target.value })}
                      className={inputClass(false)}
                      placeholder="Smith"
                      autoComplete="family-name"
                    />
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
                      autoComplete="given-name"
                    />
                    <FieldError message={registerErrors.partner_two_first_name} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last name <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={registerForm.partner_two_last_name}
                      onChange={(e) => setRegisterForm({ ...registerForm, partner_two_last_name: e.target.value })}
                      className={inputClass(false)}
                      placeholder="Lee"
                      autoComplete="family-name"
                    />
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
                    className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent"
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
                  {loading ? 'Creating account…' : 'Start for free'}
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
