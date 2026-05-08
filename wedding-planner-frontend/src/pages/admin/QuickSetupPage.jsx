import { useState } from 'react'
import api from '../../lib/api'
import { Sparkles, Wand2, Calendar, Globe2, ListChecks } from 'lucide-react'
import DateInput from '../../components/ui/DateInput'

const initialForm = {
  couple_names: '',
  wedding_date: '',
  wedding_location: '',
  planner_brand: '',
  wedding_hashtag: '',
  style_note: '',
}

const ESSENTIALS = [
  {
    icon: Globe2,
    title: 'Public wedding website sections',
    description:
      'Hero, Our Story, Travel & Accommodation, FAQ and contact pages — pre-filled in English, German and French so you can publish immediately.',
  },
  {
    icon: Calendar,
    title: 'Timeline events',
    description:
      'Ceremony, aperitif, dinner and party blocks anchored to your wedding date so guests see a full agenda from day one.',
  },
  {
    icon: ListChecks,
    title: 'Kickoff planning tasks',
    description:
      'Twelve foundational tasks (venue contract, guest list, dress fitting, vendor booking and more) with sensible due dates relative to the big day.',
  },
]

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
          <Sparkles className="w-8 h-8 text-amber-500" aria-hidden="true" />
          Wedding Website Quick Setup
        </h1>
        <p className="text-gray-600 mt-2">
          One guided form to instantly generate your public wedding content, event timeline, and kickoff tasks.
        </p>
      </div>

      <section
        className="bg-amber-50 border border-amber-200 rounded-xl p-5"
        aria-labelledby="quick-setup-summary"
      >
        <h2 id="quick-setup-summary" className="text-base font-semibold text-amber-900 mb-3">
          What “Generate all essentials” creates for you
        </h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {ESSENTIALS.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700">
                <Icon className="w-4 h-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-amber-900">{title}</p>
                <p className="text-xs text-amber-800">{description}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-amber-800">
          Already added some content? Existing entries are kept and only missing pieces are filled in — nothing is overwritten.
        </p>
      </section>

      <form onSubmit={onSubmit} className="bg-white rounded-xl shadow p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1 md:col-span-2">
          <span className="text-sm text-gray-600">Couple names</span>
          <input name="couple_names" value={form.couple_names} onChange={onChange} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Emma & Noah" />
        </label>

        <div className="space-y-1">
          <label htmlFor="quick-setup-wedding-date" className="text-sm text-gray-600 block">
            Wedding date
          </label>
          <DateInput
            id="quick-setup-wedding-date"
            withTime
            value={form.wedding_date}
            onChange={(value) => setForm((prev) => ({ ...prev, wedding_date: value }))}
            ariaLabel="Wedding date and time"
            helperText="Shown to guests on the website and used to anchor the timeline."
          />
        </div>

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

        <div className="md:col-span-2 pt-2 flex flex-wrap items-center gap-3">
          <button
            disabled={loading}
            aria-label="Generate website, timeline events and kickoff tasks"
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg disabled:opacity-60"
          >
            <Wand2 className="w-4 h-4" aria-hidden="true" />
            {loading ? 'Generating setup...' : 'Generate all essentials'}
          </button>
          <span className="text-xs text-gray-500">
            Creates the website sections, timeline events and tasks listed above.
          </span>
        </div>

        {error && <div className="md:col-span-2 text-red-600 text-sm" role="alert">{error}</div>}
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
