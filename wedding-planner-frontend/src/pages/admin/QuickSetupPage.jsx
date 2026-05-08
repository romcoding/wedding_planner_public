import { useState } from 'react'
import api from '../../lib/api'
import { Sparkles, Wand2 } from 'lucide-react'

const initialForm = {
  couple_names: '',
  wedding_date: '',
  wedding_location: '',
  planner_brand: '',
  wedding_hashtag: '',
  style_note: '',
}

export default function QuickSetupPage() {
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const onChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const payload = {
        ...form,
        wedding_date: form.wedding_date ? new Date(form.wedding_date).toISOString() : '',
      }
      const response = await api.post('/onboarding/quick-setup', payload)
      setResult(response.data)
    } catch (err) {
      const data = err.response?.data
      const detail = data?.detail
      const message =
        data?.error ||
        (detail && typeof detail === 'object' && detail.error) ||
        (typeof detail === 'string' ? detail : null) ||
        err.message ||
        'Quick setup failed. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-amber-500" />
          Wedding Website Quick Setup
        </h1>
        <p className="text-gray-600 mt-2">
          One guided form to instantly generate your public wedding content, event timeline, and kickoff tasks.
        </p>
      </div>

      <form onSubmit={onSubmit} className="bg-white rounded-xl shadow p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1 md:col-span-2">
          <span className="text-sm text-gray-600">Couple names</span>
          <input name="couple_names" value={form.couple_names} onChange={onChange} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Emma & Noah" />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-gray-600">Wedding date</span>
          <input type="datetime-local" name="wedding_date" value={form.wedding_date} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-gray-600">Wedding location</span>
          <input name="wedding_location" value={form.wedding_location} onChange={onChange} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Lakeview Garden Hotel" />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-gray-600">Planner brand</span>
          <input name="planner_brand" value={form.planner_brand} onChange={onChange} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Atelier Weddings" />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-gray-600">Wedding hashtag</span>
          <input name="wedding_hashtag" value={form.wedding_hashtag} onChange={onChange} className="w-full border rounded-lg px-3 py-2" placeholder="#emmaandnoah2027" />
        </label>

        <label className="space-y-1 md:col-span-2">
          <span className="text-sm text-gray-600">Style note</span>
          <textarea name="style_note" value={form.style_note} onChange={onChange} rows={3} className="w-full border rounded-lg px-3 py-2" placeholder="Describe the wedding mood and personality." />
        </label>

        <div className="md:col-span-2 pt-2">
          <button disabled={loading} className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg disabled:opacity-60">
            <Wand2 className="w-4 h-4" />
            {loading ? 'Generating setup...' : 'Generate all essentials'}
          </button>
        </div>

        {error && <div className="md:col-span-2 text-red-600 text-sm">{error}</div>}
      </form>

      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <h2 className="font-semibold text-emerald-800 mb-2">Setup complete</h2>
          <ul className="text-emerald-900 text-sm space-y-1">
            <li>Content entries created: {result.content?.created ?? 0}</li>
            <li>Content entries updated: {result.content?.updated ?? 0}</li>
            <li>Timeline events created: {result.events?.created ?? 0}</li>
            <li>Kickoff tasks created: {result.tasks?.created ?? 0}</li>
          </ul>
        </div>
      )}
    </div>
  )
}
