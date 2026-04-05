import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function RegisterPage() {
  const { registerCouple } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    password: '',
    password_confirmation: '',
    partner_one_first_name: '',
    partner_one_last_name: '',
    partner_two_first_name: '',
    partner_two_last_name: '',
    wedding_date: '',
    location: '',
    style_notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await registerCouple(form)
    if (result.success) {
      navigate('/admin/wedding')
    } else {
      setError(result.error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900">Create your wedding workspace</h1>
        <p className="text-sm text-gray-500 mt-1">Already registered? <Link to="/admin/login" className="text-blue-600 hover:underline">Sign in</Link></p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">{error}</div>}
          <input name="email" type="email" required placeholder="Email" value={form.email} onChange={onChange} className="w-full border rounded px-3 py-2" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input name="partner_one_first_name" required placeholder="Partner 1 first name" value={form.partner_one_first_name} onChange={onChange} className="border rounded px-3 py-2" />
            <input name="partner_one_last_name" required placeholder="Partner 1 last name" value={form.partner_one_last_name} onChange={onChange} className="border rounded px-3 py-2" />
            <input name="partner_two_first_name" required placeholder="Partner 2 first name" value={form.partner_two_first_name} onChange={onChange} className="border rounded px-3 py-2" />
            <input name="partner_two_last_name" required placeholder="Partner 2 last name" value={form.partner_two_last_name} onChange={onChange} className="border rounded px-3 py-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input name="wedding_date" type="date" required value={form.wedding_date} onChange={onChange} className="border rounded px-3 py-2" />
            <input name="location" placeholder="Wedding location (optional)" value={form.location} onChange={onChange} className="border rounded px-3 py-2" />
          </div>
          <textarea name="style_notes" placeholder="Style notes (optional)" value={form.style_notes} onChange={onChange} className="w-full border rounded px-3 py-2 min-h-[90px]" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input name="password" type="password" required placeholder="Password" value={form.password} onChange={onChange} className="border rounded px-3 py-2" />
            <input name="password_confirmation" type="password" required placeholder="Confirm password" value={form.password_confirmation} onChange={onChange} className="border rounded px-3 py-2" />
          </div>
          <button disabled={loading} className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700 disabled:opacity-60">{loading ? 'Creating account...' : 'Create account'}</button>
        </form>
      </div>
    </div>
  )
}
