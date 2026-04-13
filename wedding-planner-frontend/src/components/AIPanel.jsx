import { useState, useEffect, useCallback } from 'react'
import { X, Sparkles, Calendar, Users, FileText, Layout, ChevronRight, Loader2, Copy, Check, Plus } from 'lucide-react'
import { useWedding } from '../contexts/WeddingContext'
import UpgradeModal from './UpgradeModal'
import api from '../lib/api'

// ── Skeleton loader ──────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="p-1 hover:bg-gray-100 rounded transition-colors" title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
    </button>
  )
}

// ── Tool: Timeline Builder ────────────────────────────────────────────────────
function TimelineTool({ wedding, onApply }) {
  const [form, setForm] = useState({
    wedding_date: wedding?.wedding_date || '',
    location: wedding?.location || '',
    guest_count: 100,
    ceremony_type: 'outdoor ceremony',
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRun = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/ai/timeline', form)
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.error || 'AI request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Wedding Date</label>
          <input type="date" value={form.wedding_date} onChange={e => setForm(f => ({...f, wedding_date: e.target.value}))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Guest Count</label>
          <input type="number" value={form.guest_count} onChange={e => setForm(f => ({...f, guest_count: parseInt(e.target.value)||0}))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Location</label>
        <input type="text" value={form.location} placeholder="e.g. Tuscany, Italy" onChange={e => setForm(f => ({...f, location: e.target.value}))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Ceremony Type</label>
        <select value={form.ceremony_type} onChange={e => setForm(f => ({...f, ceremony_type: e.target.value}))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200">
          <option>outdoor ceremony</option>
          <option>church wedding</option>
          <option>civil ceremony</option>
          <option>beach wedding</option>
          <option>destination wedding</option>
        </select>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button onClick={handleRun} disabled={loading || !form.wedding_date || !form.location}
        className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : <><Sparkles className="w-4 h-4" />Generate Timeline</>}
      </button>

      {loading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      )}

      {result?.timeline && !loading && (
        <div className="space-y-3 mt-2">
          {result.timeline.map((phase, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">{phase.month_label}</span>
                {phase.months_before !== undefined && (
                  <span className="text-xs text-gray-400">{phase.months_before}mo before</span>
                )}
              </div>
              <ul className="space-y-1">
                {(phase.tasks || []).map((task, ti) => (
                  <li key={ti} className="flex items-start gap-2 text-xs text-gray-600">
                    <Check className="w-3 h-3 text-rose-400 mt-0.5 flex-shrink-0" />
                    {task}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <button onClick={() => onApply('tasks', result.timeline)}
            className="w-full border border-rose-300 text-rose-600 text-xs font-medium py-2 rounded-lg hover:bg-rose-50 transition-colors flex items-center justify-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            Apply tasks to my plan
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tool: Vendor Suggestions ──────────────────────────────────────────────────
function VendorTool({ wedding }) {
  const [form, setForm] = useState({
    budget: 20000,
    location: wedding?.location || '',
    style_preferences: 'romantic, classic',
    guest_count: 100,
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRun = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/ai/vendor-suggestions', form)
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.error || 'AI request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Total Budget ($)</label>
          <input type="number" value={form.budget} onChange={e => setForm(f => ({...f, budget: parseInt(e.target.value)||0}))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Guest Count</label>
          <input type="number" value={form.guest_count} onChange={e => setForm(f => ({...f, guest_count: parseInt(e.target.value)||0}))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Location</label>
        <input type="text" value={form.location} placeholder="e.g. Paris, France" onChange={e => setForm(f => ({...f, location: e.target.value}))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Style Preferences</label>
        <input type="text" value={form.style_preferences} placeholder="e.g. romantic, boho, modern" onChange={e => setForm(f => ({...f, style_preferences: e.target.value}))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button onClick={handleRun} disabled={loading || !form.location}
        className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : <><Sparkles className="w-4 h-4" />Get Suggestions</>}
      </button>

      {loading && <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>}

      {result?.vendors && !loading && (
        <div className="space-y-3 mt-2">
          {result.vendors.map((v, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-800">{v.category}</span>
                <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  ${v.estimated_cost?.toLocaleString()} ({v.budget_allocation_pct}%)
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-2">{v.tips}</p>
              {v.questions_to_ask?.length > 0 && (
                <details className="text-xs">
                  <summary className="text-gray-400 cursor-pointer hover:text-gray-600">Questions to ask →</summary>
                  <ul className="mt-1 space-y-1 pl-2">
                    {v.questions_to_ask.map((q, qi) => <li key={qi} className="text-gray-500">• {q}</li>)}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tool: Copy Generator ──────────────────────────────────────────────────────
function CopyTool({ wedding }) {
  const coupleNames = [wedding?.partner_one_name, wedding?.partner_two_name].filter(Boolean).join(' & ')
  const [form, setForm] = useState({
    couple_names: coupleNames || '',
    wedding_date: wedding?.wedding_date || '',
    location: wedding?.location || '',
    story_notes: '',
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRun = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/ai/copy-generator', form)
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.error || 'AI request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Couple Names</label>
        <input type="text" value={form.couple_names} placeholder="Sarah & John" onChange={e => setForm(f => ({...f, couple_names: e.target.value}))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Wedding Date</label>
          <input type="date" value={form.wedding_date} onChange={e => setForm(f => ({...f, wedding_date: e.target.value}))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Location</label>
          <input type="text" value={form.location} placeholder="City, Country" onChange={e => setForm(f => ({...f, location: e.target.value}))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Your Story (optional)</label>
        <textarea rows={3} value={form.story_notes} placeholder="How you met, your proposal story, what makes your love special…"
          onChange={e => setForm(f => ({...f, story_notes: e.target.value}))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 resize-none" />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button onClick={handleRun} disabled={loading || !form.couple_names}
        className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Writing…</> : <><Sparkles className="w-4 h-4" />Generate Copy</>}
      </button>

      {loading && <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>}

      {result && !loading && (
        <div className="space-y-4 mt-2">
          {result.welcome_text && (
            <div className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">Welcome Text</span>
                <CopyBtn text={result.welcome_text} />
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{result.welcome_text}</p>
            </div>
          )}
          {result.our_story && (
            <div className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">Our Story</span>
                <CopyBtn text={result.our_story} />
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{result.our_story}</p>
            </div>
          )}
          {result.faq?.length > 0 && (
            <div className="border border-gray-100 rounded-lg p-3">
              <span className="text-xs font-semibold text-gray-700 mb-2 block">FAQ Drafts</span>
              {result.faq.map((item, i) => (
                <div key={i} className="mb-2">
                  <p className="text-xs font-medium text-gray-700">{item.question}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.answer}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tool: Seating ────────────────────────────────────────────────────────────
function SeatingTool() {
  const [guestInput, setGuestInput] = useState('Alice Smith, friend\nBob Jones, family\nCarol Brown, colleague')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const parseGuests = () => {
    return guestInput.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split(',')
        return {
          name: parts[0]?.trim() || 'Unknown',
          relationship: parts[1]?.trim() || 'guest',
          dietary: parts[2]?.trim() || 'none',
        }
      })
  }

  const handleRun = async () => {
    const guests = parseGuests()
    if (guests.length < 2) {
      setError('Enter at least 2 guests')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/ai/seating', { guests })
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.error || 'AI request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">
          Guest List <span className="text-gray-400 font-normal">(name, relationship, dietary)</span>
        </label>
        <textarea rows={8} value={guestInput} onChange={e => setGuestInput(e.target.value)}
          placeholder="Alice Smith, family, vegetarian&#10;Bob Jones, friend, none&#10;Carol Brown, colleague, vegan"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-200 resize-none" />
        <p className="text-xs text-gray-400 mt-1">{parseGuests().length} guests parsed</p>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button onClick={handleRun} disabled={loading}
        className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Arranging…</> : <><Sparkles className="w-4 h-4" />Suggest Seating</>}
      </button>

      {loading && <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>}

      {result?.tables && !loading && (
        <div className="space-y-3 mt-2">
          {result.tables.map((table, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-800">Table {table.table_number}</span>
                <span className="text-xs text-gray-400">{table.guests?.length} guests</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {(table.guests || []).map((g, gi) => (
                  <span key={gi} className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">{g}</span>
                ))}
              </div>
              {table.reasoning && (
                <p className="text-xs text-gray-500 italic">{table.reasoning}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main AIPanel ─────────────────────────────────────────────────────────────
const TOOLS = [
  { id: 'timeline', label: 'Timeline Builder', icon: Calendar, description: 'Month-by-month planning countdown' },
  { id: 'vendors', label: 'Vendor Suggestions', icon: Users, description: 'Budget allocation & vendor tips' },
  { id: 'copy', label: 'Website Copy', icon: FileText, description: 'Welcome text, story & FAQ drafts' },
  { id: 'seating', label: 'Seating Planner', icon: Layout, description: 'Smart table groupings' },
]

export default function AIPanel({ isOpen, onClose }) {
  const { wedding, planMeets, getAiUsage } = useWedding()
  const [activeTool, setActiveTool] = useState('timeline')
  const [usage, setUsage] = useState(null)
  const [showUpgrade, setShowUpgrade] = useState(false)

  const fetchUsage = useCallback(async () => {
    if (!planMeets('starter')) return
    const u = await getAiUsage()
    if (u) setUsage(u)
  }, [planMeets, getAiUsage])

  useEffect(() => {
    if (isOpen) fetchUsage()
  }, [isOpen, activeTool, fetchUsage])

  const handleApply = (type, data) => {
    // Future: push AI results into relevant feature pages
    console.log('Apply AI output:', type, data)
  }

  const isLocked = !planMeets('starter')

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-amber-500 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">AI Wedding Assistant</h2>
              <p className="text-xs text-gray-400">Powered by Claude</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Usage Counter (Starter plan) */}
        {usage && !usage.unlimited && (
          <div className="mx-4 mt-3 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="text-xs text-amber-700 font-medium">
              AI uses today: {usage.count} / {usage.limit}
            </span>
            {usage.count >= usage.limit && (
              <button
                onClick={() => setShowUpgrade(true)}
                className="text-xs text-amber-700 underline hover:no-underline"
              >
                Upgrade
              </button>
            )}
          </div>
        )}

        {isLocked ? (
          /* Locked state for free plan */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">AI features require Starter</h3>
            <p className="text-sm text-gray-500 mb-5">
              Upgrade to unlock AI Timeline, Vendor Suggestions, Website Copy, and Smart Seating.
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              Upgrade to Starter — $9/mo
            </button>
          </div>
        ) : (
          <>
            {/* Tool Tabs */}
            <div className="flex flex-col gap-1 p-3 border-b border-gray-100">
              {TOOLS.map((tool) => {
                const Icon = tool.icon
                return (
                  <button
                    key={tool.id}
                    onClick={() => setActiveTool(tool.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      activeTool === tool.id
                        ? 'bg-rose-50 text-rose-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-none">{tool.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{tool.description}</p>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 ml-auto flex-shrink-0 transition-transform ${activeTool === tool.id ? 'text-rose-500' : 'text-gray-300'}`} />
                  </button>
                )
              })}
            </div>

            {/* Tool Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTool === 'timeline' && <TimelineTool wedding={wedding} onApply={handleApply} />}
              {activeTool === 'vendors' && <VendorTool wedding={wedding} />}
              {activeTool === 'copy' && <CopyTool wedding={wedding} />}
              {activeTool === 'seating' && <SeatingTool />}
            </div>
          </>
        )}
      </div>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="Upgrade to Starter to unlock all AI features."
        currentPlan={wedding?.plan || 'free'}
        suggestPlan="starter"
      />
    </>
  )
}
