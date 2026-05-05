import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Heart,
  Sparkles,
  Users,
  CheckCircle,
  Calendar,
  LayoutDashboard,
  Globe,
  ChevronRight,
  Star,
  ArrowRight,
} from 'lucide-react'

// ── Inline registration form shown in the hero CTA ──────────────────────────
function QuickRegisterForm() {
  const navigate = useNavigate()
  const { registerCouple } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    partner_one_first_name: '',
    partner_two_first_name: '',
    email: '',
    password: '',
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (step === 1) { setStep(2); return }
    setError('')
    setLoading(true)
    try {
      const result = await registerCouple({
        email: form.email,
        password: form.password,
        password_confirmation: form.password,
        partner_one_first_name: form.partner_one_first_name,
        partner_one_last_name: '',
        partner_two_first_name: form.partner_two_first_name,
        partner_two_last_name: '',
      })
      if (result.success) {
        navigate('/onboarding', { replace: true })
      } else {
        setError(result.error || 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {step === 1 ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              type="text"
              placeholder="Partner 1 first name"
              value={form.partner_one_first_name}
              onChange={set('partner_one_first_name')}
              className="px-3 py-2.5 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300 text-sm bg-white"
            />
            <input
              required
              type="text"
              placeholder="Partner 2 first name"
              value={form.partner_two_first_name}
              onChange={set('partner_two_first_name')}
              className="px-3 py-2.5 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300 text-sm bg-white"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <input
            required
            type="email"
            placeholder="Your email"
            value={form.email}
            onChange={set('email')}
            className="w-full px-3 py-2.5 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300 text-sm bg-white"
          />
          <input
            required
            type="password"
            minLength={8}
            placeholder="Choose a password (min. 8 chars)"
            value={form.password}
            onChange={set('password')}
            className="w-full px-3 py-2.5 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300 text-sm bg-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            {loading ? 'Creating your space…' : (
              <><Heart className="w-4 h-4 fill-rose-200" /> Start planning for free</>
            )}
          </button>
          <button type="button" onClick={() => setStep(1)} className="w-full text-xs text-gray-400 hover:text-gray-600">
            ← Back
          </button>
        </>
      )}

      <p className="text-xs text-center text-gray-400">
        No credit card required · Free forever for small weddings
      </p>
    </form>
  )
}

// ── Mock UI screenshot rendered in CSS ──────────────────────────────────────
function DashboardMockup() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white text-[10px] select-none">
      {/* top bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-100">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="ml-2 text-gray-400 text-[9px]">Wedding Planner · Admin Dashboard</span>
      </div>
      {/* body */}
      <div className="flex h-48">
        {/* sidebar */}
        <div className="w-20 bg-rose-50 border-r border-rose-100 p-2 flex flex-col gap-1.5">
          {['Dashboard','Guests','Tasks','Budget','Seating','Content'].map((l) => (
            <div key={l} className={`px-1.5 py-1 rounded text-[8px] font-medium ${l === 'Dashboard' ? 'bg-rose-200 text-rose-800' : 'text-gray-500'}`}>{l}</div>
          ))}
        </div>
        {/* main */}
        <div className="flex-1 p-3 flex flex-col gap-2">
          <div className="flex gap-2">
            {[['Guests','42','bg-blue-100 text-blue-700'],['Tasks','8 left','bg-amber-100 text-amber-700'],['Budget','€12k','bg-green-100 text-green-700']].map(([label, val, cls]) => (
              <div key={label} className={`flex-1 rounded-lg px-2 py-1.5 ${cls}`}>
                <div className="font-bold text-sm leading-none">{val}</div>
                <div className="text-[8px] mt-0.5 opacity-70">{label}</div>
              </div>
            ))}
          </div>
          <div className="flex-1 rounded-lg bg-gray-50 border border-gray-100 p-2">
            <div className="text-[9px] font-semibold text-gray-500 mb-1.5">Upcoming tasks</div>
            {['Book florist','Send invites','Confirm menu','Dress fitting'].map((t, i) => (
              <div key={t} className="flex items-center gap-1.5 mb-1">
                <div className={`w-2 h-2 rounded-full ${i < 2 ? 'bg-rose-400' : 'bg-gray-200'}`} />
                <span className={`text-[8px] ${i < 2 ? 'text-gray-700' : 'text-gray-400 line-through'}`}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function GuestPortalMockup() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white text-[10px] select-none">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-100">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="ml-2 text-gray-400 text-[9px]">sarah-and-tom-2026.wedding-planner.app</span>
      </div>
      <div className="bg-gradient-to-b from-rose-100 to-white p-4 flex flex-col items-center text-center h-48">
        <div className="text-rose-400 text-lg mb-1">💍</div>
        <h3 className="font-bold text-gray-800 text-sm">Sarah & Tom</h3>
        <p className="text-[9px] text-gray-500 mb-3">September 14, 2026 · Florence, Italy</p>
        <div className="flex gap-2 mb-3">
          {['Our Story','Venue','RSVP','Registry'].map((item) => (
            <span key={item} className="px-2 py-0.5 bg-white rounded-full border border-rose-200 text-[8px] text-rose-600">{item}</span>
          ))}
        </div>
        <button className="px-4 py-1.5 bg-rose-500 text-white rounded-full text-[9px] font-semibold">Confirm RSVP</button>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function PublicLandingPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-rose-600 font-bold text-lg">
          <Heart className="w-5 h-5 fill-rose-500" />
          WeddingPlanner
        </div>
        <div className="flex items-center gap-3">
          <Link to="/guest/register" className="text-sm text-gray-500 hover:text-gray-700">
            Guest login
          </Link>
          <Link
            to="/auth?tab=login"
            className="text-sm px-4 py-2 rounded-xl border border-gray-200 hover:border-rose-200 hover:text-rose-600 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* decorative blobs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-rose-100 opacity-50 blur-3xl pointer-events-none" />
        <div className="absolute top-48 -left-24 w-72 h-72 rounded-full bg-pink-100 opacity-40 blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 pt-12 pb-24 grid lg:grid-cols-2 gap-16 items-center">
          {/* left: copy + form */}
          <div>
            <div className="inline-flex items-center gap-2 bg-rose-50 text-rose-600 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              <Sparkles className="w-3.5 h-3.5" /> Free to start · No credit card
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
              Plan your
              <span className="block text-rose-500">perfect wedding</span>
              with love.
            </h1>
            <p className="mt-5 text-lg text-gray-500 leading-relaxed max-w-lg">
              One beautiful workspace for couples and planners — manage guests, tasks, budget, seating, and your public wedding website, all in one place.
            </p>

            {/* quick register card */}
            <div className="mt-8 bg-rose-50 border border-rose-100 rounded-2xl p-5 max-w-sm">
              <p className="text-sm font-semibold text-gray-700 mb-3">Create your free wedding space</p>
              <QuickRegisterForm />
            </div>

            <p className="mt-4 text-sm text-gray-400">
              Already have an account?{' '}
              <Link to="/auth?tab=login" className="text-rose-600 hover:underline font-medium">Sign in</Link>
            </p>
          </div>

          {/* right: dashboard mockup */}
          <div className="hidden lg:block">
            <DashboardMockup />
            <div className="mt-4">
              <GuestPortalMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof numbers ── */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            ['∞', 'Guests supported'],
            ['AI', 'Powered planning'],
            ['100%', 'Data ownership'],
            ['Free', 'To get started'],
          ].map(([val, label]) => (
            <div key={label}>
              <div className="text-3xl font-extrabold text-rose-500">{val}</div>
              <div className="mt-1 text-sm text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold">From "yes" to your perfect day</h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto">Three simple steps — and your whole wedding lives in one organised space.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              icon: <Heart className="w-6 h-6 text-rose-500" />,
              title: 'Create your wedding space',
              desc: 'Register in 60 seconds. Enter your names and wedding date — your personal admin dashboard is ready instantly.',
              color: 'bg-rose-50 border-rose-100',
            },
            {
              step: '02',
              icon: <LayoutDashboard className="w-6 h-6 text-purple-500" />,
              title: 'Organise every detail',
              desc: 'Add guests, track tasks, manage your budget, plan your seating chart, and build your wedding website — all from one place.',
              color: 'bg-purple-50 border-purple-100',
            },
            {
              step: '03',
              icon: <Globe className="w-6 h-6 text-blue-500" />,
              title: 'Share with your guests',
              desc: 'Publish your beautiful wedding page. Guests can RSVP, view the schedule, and keep up with all the details.',
              color: 'bg-blue-50 border-blue-100',
            },
          ].map(({ step, icon, title, desc, color }) => (
            <div key={step} className={`rounded-2xl border p-6 ${color} relative overflow-hidden`}>
              <span className="absolute -top-3 -right-2 text-7xl font-black opacity-[0.07] text-gray-700 select-none">{step}</span>
              <div className="mb-4">{icon}</div>
              <h3 className="font-bold text-gray-800 mb-2">{title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features deep-dive ── */}
      <section className="bg-gradient-to-b from-rose-50 to-white py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold">Everything you need, nothing you don't</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: <Users className="w-5 h-5 text-blue-600" />,
                bg: 'bg-blue-50',
                title: 'Guest management',
                desc: 'Import guests, track RSVPs, manage dietary requirements, assign tables, and send reminders — all in real time.',
                bullets: ['RSVP tracking', 'Dietary & accessibility notes', 'Automated reminders', 'Plus-ones support'],
              },
              {
                icon: <CheckCircle className="w-5 h-5 text-green-600" />,
                bg: 'bg-green-50',
                title: 'Task & budget planner',
                desc: 'Never miss a deadline. Build your timeline, track every euro, and let AI suggest what to do next.',
                bullets: ['Visual task timeline', 'Budget breakdown', 'Vendor cost tracking', 'AI planning assistant'],
              },
              {
                icon: <Globe className="w-5 h-5 text-purple-600" />,
                bg: 'bg-purple-50',
                title: 'Public wedding website',
                desc: 'A gorgeous, shareable page for your guests — your story, venue info, schedule, and an RSVP portal.',
                bullets: ['Custom wedding slug', 'AI content builder', 'Mobile friendly', 'No code needed'],
              },
              {
                icon: <Calendar className="w-5 h-5 text-amber-600" />,
                bg: 'bg-amber-50',
                title: 'Seating & event planner',
                desc: 'Drag-and-drop seating chart, event timeline, and a moodboard to capture your style vision.',
                bullets: ['Visual seating chart', 'Day-of timeline', 'Moodboard builder', 'Shareable with your planner'],
              },
            ].map(({ icon, bg, title, desc, bullets }) => (
              <div key={title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className={`inline-flex p-2 rounded-xl ${bg} mb-4`}>{icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{desc}</p>
                <ul className="space-y-1.5">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm text-gray-600">
                      <ChevronRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-bold text-center mb-12">Couples who found their calm</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              quote: 'We had 120 guests spread across two countries. The RSVP tracker alone saved us weeks of back-and-forth.',
              name: 'Mia & Jonas',
              date: 'Married in Vienna, 2025',
            },
            {
              quote: "The public wedding page looked amazing. Our guests kept saying how professional it was — and I built it in an afternoon!",
              name: 'Sophie & Luca',
              date: 'Married in Tuscany, 2025',
            },
            {
              quote: "Having budget, guests, and tasks all in one tab was a game-changer. I finally felt in control of our big day.",
              name: 'Emma & David',
              date: 'Married in Edinburgh, 2025',
            },
          ].map(({ quote, name, date }) => (
            <div key={name} className="bg-rose-50 border border-rose-100 rounded-2xl p-6">
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">"{quote}"</p>
              <div>
                <p className="font-semibold text-sm text-gray-800">{name}</p>
                <p className="text-xs text-gray-400">{date}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-gradient-to-br from-rose-500 to-pink-600 py-24">
        <div className="max-w-2xl mx-auto px-6 text-center text-white">
          <Heart className="w-8 h-8 fill-white/80 mx-auto mb-4" />
          <h2 className="text-4xl font-extrabold leading-tight mb-4">
            Start planning your<br />dream wedding today
          </h2>
          <p className="text-rose-100 mb-8 text-lg">
            Free for small weddings. No credit card required. Your data, your space.
          </p>
          <Link
            to="/auth?tab=register"
            className="inline-flex items-center gap-2 bg-white text-rose-600 font-bold px-8 py-4 rounded-2xl hover:bg-rose-50 transition-colors shadow-lg text-base"
          >
            Create your free wedding space <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-4 text-rose-200 text-sm">
            Already have an account?{' '}
            <Link to="/auth?tab=login" className="text-white underline hover:no-underline">Sign in</Link>
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2 font-medium text-gray-600">
            <Heart className="w-4 h-4 fill-rose-400 text-rose-400" />
            WeddingPlanner
          </div>
          <div className="flex gap-6">
            <Link to="/auth?tab=register" className="hover:text-gray-600">Get started</Link>
            <Link to="/auth?tab=login" className="hover:text-gray-600">Sign in</Link>
            <Link to="/guest/login" className="hover:text-gray-600">Guest portal</Link>
          </div>
          <p>© {new Date().getFullYear()} WeddingPlanner. Made with love.</p>
        </div>
      </footer>
    </main>
  )
}
