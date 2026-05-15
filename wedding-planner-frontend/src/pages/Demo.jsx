import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  ListChecks,
  Wallet,
  Calendar,
  ArrowRight,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Heart,
} from 'lucide-react'
import api from '../lib/api'

const PALETTE = {
  bg: '#FAFAF8',
  fg: '#1A1A1A',
  primary: '#C4956A',
  secondary: '#2D4A3E',
  soft: '#F5EFE8',
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: Sparkles },
  { id: 'guests', label: 'Guests', icon: Users },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'budget', label: 'Budget', icon: Wallet },
]

function StatCard({ label, value, tone }) {
  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{ background: '#fff', border: '1px solid #EAE3D6' }}
    >
      <div className="text-xs uppercase tracking-wide" style={{ color: '#7a7264' }}>{label}</div>
      <div
        className="mt-1 text-2xl font-semibold"
        style={{ color: tone || PALETTE.secondary, fontFamily: '"Playfair Display", Georgia, serif' }}
      >
        {value}
      </div>
    </div>
  )
}

function StatusPill({ status }) {
  const s = (status || '').toLowerCase()
  const config = s === 'confirmed'
    ? { bg: '#EAF0EC', fg: PALETTE.secondary, label: '✓ Coming' }
    : s === 'declined'
      ? { bg: '#FDECEC', fg: '#9B2C2C', label: '✗ Declined' }
      : { bg: PALETTE.soft, fg: PALETTE.primary, label: '… Pending' }
  return (
    <span
      className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ background: config.bg, color: config.fg }}
    >
      {config.label}
    </span>
  )
}

function TaskRow({ task }) {
  const done = task.status === 'done'
  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{ background: '#fff', border: '1px solid #EAE3D6' }}
    >
      <div className="flex items-center gap-3">
        {done ? (
          <CheckCircle className="w-4 h-4" style={{ color: PALETTE.secondary }} />
        ) : (
          <AlertCircle className="w-4 h-4" style={{ color: PALETTE.primary }} />
        )}
        <span style={{ color: PALETTE.fg, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.65 : 1 }}>
          {task.title}
        </span>
      </div>
      <span className="text-xs" style={{ color: '#7a7264' }}>
        {task.due_date}
      </span>
    </div>
  )
}

function CostRow({ cost }) {
  const variance = cost.actual != null && cost.estimated != null ? cost.actual - cost.estimated : 0
  return (
    <div
      className="grid grid-cols-12 gap-3 rounded-xl px-4 py-3 items-center"
      style={{ background: '#fff', border: '1px solid #EAE3D6' }}
    >
      <div className="col-span-4 font-medium" style={{ color: PALETTE.fg }}>{cost.name}</div>
      <div className="col-span-3 text-sm" style={{ color: '#7a7264' }}>{cost.category}</div>
      <div className="col-span-2 text-sm text-right" style={{ color: PALETTE.fg }}>
        €{(cost.estimated || 0).toLocaleString()}
      </div>
      <div className="col-span-2 text-sm text-right" style={{ color: PALETTE.fg }}>
        {cost.actual != null ? `€${cost.actual.toLocaleString()}` : '—'}
      </div>
      <div
        className="col-span-1 text-xs text-right font-medium"
        style={{
          color:
            variance > 0
              ? '#9B2C2C'
              : variance < 0
                ? PALETTE.secondary
                : '#7a7264',
        }}
      >
        {variance === 0 ? '' : variance > 0 ? `+€${variance}` : `−€${Math.abs(variance)}`}
      </div>
    </div>
  )
}

export default function DemoPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    let cancelled = false
    api.get('/demo/overview')
      .then((res) => { if (!cancelled) setData(res.data) })
      .catch(() => { if (!cancelled) setError('Could not load demo data right now.') })
    return () => { cancelled = true }
  }, [])

  const wedding = data?.wedding
  const guests = data?.guests || []
  const tasks = data?.tasks || []
  const costs = data?.costs || []
  const analytics = data?.analytics

  return (
    <main
      className="min-h-screen pb-32"
      style={{
        background: PALETTE.bg,
        color: PALETTE.fg,
        fontFamily: '"DM Sans", -apple-system, sans-serif',
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
      />

      {/* Banner */}
      <div style={{ background: PALETTE.secondary, color: '#fff' }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: PALETTE.primary }} />
            <span>You're viewing a demo — none of this data is saved.</span>
          </p>
          <Link
            to="/auth?tab=register"
            className="text-sm font-medium inline-flex items-center gap-2 rounded-lg px-4 py-2"
            style={{ background: PALETTE.primary, color: '#fff' }}
          >
            Create your free workspace
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 pt-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm mb-6" style={{ color: PALETTE.secondary }}>
          <Heart className="w-4 h-4" style={{ color: PALETTE.primary, fill: PALETTE.primary }} />
          Back to AI Wedding OS
        </Link>
        <h1
          className="text-4xl sm:text-5xl"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          {wedding?.couple_names || 'Loading the demo…'}
        </h1>
        {wedding && (
          <p className="mt-2 text-[16px]" style={{ color: '#4a4a4a' }}>
            {wedding.location} · {wedding.wedding_date}
          </p>
        )}
        {error && (
          <p className="mt-4 text-sm" style={{ color: '#9B2C2C' }}>{error}</p>
        )}
      </header>

      {/* Tabs */}
      <nav className="max-w-6xl mx-auto px-6 mt-10 flex gap-1 overflow-x-auto" aria-label="Demo sections">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{
                background: active ? PALETTE.secondary : 'transparent',
                color: active ? '#fff' : PALETTE.secondary,
                border: active ? `1px solid ${PALETTE.secondary}` : '1px solid transparent',
              }}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </nav>

      <section className="max-w-6xl mx-auto px-6 mt-6 space-y-8">
        {/* Stats — always visible */}
        {analytics && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Guests" value={analytics.total_guests} />
            <StatCard label="Confirmed" value={analytics.confirmed} tone={PALETTE.secondary} />
            <StatCard label="Pending" value={analytics.pending} tone={PALETTE.primary} />
            <StatCard label="Declined" value={analytics.declined} tone="#9B2C2C" />
          </div>
        )}

        {tab === 'overview' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div
              className="rounded-2xl p-6"
              style={{ background: '#fff', border: '1px solid #EAE3D6' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4" style={{ color: PALETTE.primary }} />
                <span className="font-semibold" style={{ color: PALETTE.secondary }}>Upcoming tasks</span>
              </div>
              <div className="space-y-2">
                {tasks.filter((t) => t.status !== 'done').slice(0, 4).map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            </div>
            <div
              className="rounded-2xl p-6"
              style={{ background: '#fff', border: '1px solid #EAE3D6' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4" style={{ color: PALETTE.primary }} />
                <span className="font-semibold" style={{ color: PALETTE.secondary }}>Budget snapshot</span>
              </div>
              <div className="space-y-2">
                {costs.slice(0, 4).map((c) => (
                  <CostRow key={c.id} cost={c} />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'guests' && (
          <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid #EAE3D6' }}>
            <div className="font-semibold mb-4" style={{ color: PALETTE.secondary }}>
              {guests.length} guests
            </div>
            <div className="divide-y" style={{ borderColor: '#F0EAE0' }}>
              {guests.map((g) => (
                <div key={g.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium" style={{ color: PALETTE.fg }}>{g.name}</div>
                    <div className="text-xs" style={{ color: '#7a7264' }}>
                      {g.email}
                      {g.dietary ? ` · ${g.dietary}` : ''}
                    </div>
                  </div>
                  <StatusPill status={g.rsvp_status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'tasks' && (
          <div className="grid md:grid-cols-2 gap-3">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        )}

        {tab === 'budget' && (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-3 text-xs uppercase tracking-wide px-4" style={{ color: '#7a7264' }}>
              <div className="col-span-4">Item</div>
              <div className="col-span-3">Category</div>
              <div className="col-span-2 text-right">Estimated</div>
              <div className="col-span-2 text-right">Actual</div>
              <div className="col-span-1 text-right">Δ</div>
            </div>
            {costs.map((c) => (
              <CostRow key={c.id} cost={c} />
            ))}
          </div>
        )}
      </section>

      {/* Floating CTA on mobile */}
      <Link
        to="/auth?tab=register"
        className="md:hidden fixed bottom-4 right-4 inline-flex items-center gap-2 rounded-full px-5 py-3 font-medium text-white shadow-lg"
        style={{ background: PALETTE.primary }}
      >
        Start for free
        <ArrowRight className="w-4 h-4" />
      </Link>
    </main>
  )
}
