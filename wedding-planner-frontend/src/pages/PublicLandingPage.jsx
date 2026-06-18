import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ASSISTANT_NAME } from '../lib/brand'
import { usePricing } from '../hooks/usePricing'
import {
  Heart,
  Sparkles,
  Users,
  CheckCircle,
  ListChecks,
  Wallet,
  ArrowRight,
  Check,
  Star,
  Bot,
  Globe,
  ChevronRight,
} from 'lucide-react'

// Brand palette (spec) — kept inline as CSS vars so we don't have to touch Tailwind config.
const PALETTE = {
  bg: '#FAFAF8',
  fg: '#1A1A1A',
  primary: '#C4956A',   // warm rose-gold
  secondary: '#2D4A3E', // deep forest green
  soft: '#F5EFE8',      // blush cream
}

// ── Reveal-on-scroll wrapper (IntersectionObserver, CSS-only animation) ──
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
    >
      {children}
    </div>
  )
}

// ── Decorative animated rings (pure SVG + CSS) ──
function HeroBackdrop() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full pointer-events-none opacity-60"
    >
      <defs>
        <radialGradient id="ring-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C4956A" stopOpacity="0.25" />
          <stop offset="80%" stopColor="#C4956A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="320" cy="220" r="260" fill="url(#ring-glow)">
        <animate attributeName="r" values="260;290;260" dur="14s" repeatCount="indefinite" />
      </circle>
      <circle cx="900" cy="520" r="220" fill="url(#ring-glow)">
        <animate attributeName="r" values="220;250;220" dur="18s" repeatCount="indefinite" />
      </circle>
      <g stroke="#2D4A3E" strokeOpacity="0.12" fill="none" strokeWidth="1.2">
        <circle cx="600" cy="380" r="160" />
        <circle cx="600" cy="380" r="240" />
        <circle cx="600" cy="380" r="320" />
      </g>
      <g stroke="#C4956A" strokeOpacity="0.22" fill="none" strokeWidth="0.8">
        <path d="M120 700 q 80 -120 200 -100 q 90 14 120 110" />
        <path d="M1060 120 q -80 110 -200 100 q -90 -10 -120 -100" />
      </g>
    </svg>
  )
}

// ── Pain card ──
function PainCard({ icon, title, desc, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <div
        className="h-full rounded-2xl p-6 transition-shadow hover:shadow-md"
        style={{ background: PALETTE.soft, color: PALETTE.fg }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
          style={{ background: '#fff', color: PALETTE.secondary }}
          aria-hidden="true"
        >
          {icon}
        </div>
        <h3 className="font-serif text-xl mb-2" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>{title}</h3>
        <p className="text-[15px] leading-relaxed" style={{ color: '#3f3f3f' }}>{desc}</p>
      </div>
    </Reveal>
  )
}

// ── Feature row (alternating) ──
function FeatureRow({ flip = false, badge, title, description, bullets, mockup, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <div className={`grid lg:grid-cols-2 gap-12 items-center ${flip ? 'lg:[&>div:first-child]:order-2' : ''}`}>
        <div>
          {badge && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full mb-4"
              style={{ background: PALETTE.soft, color: PALETTE.secondary }}
            >
              {badge}
            </span>
          )}
          <h3
            className="text-3xl md:text-4xl mb-4"
            style={{ fontFamily: '"Playfair Display", Georgia, serif', color: PALETTE.fg, lineHeight: 1.15 }}
          >
            {title}
          </h3>
          <p className="text-[17px] leading-relaxed mb-6" style={{ color: '#3a3a3a' }}>
            {description}
          </p>
          <ul className="space-y-2">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-[15px]" style={{ color: PALETTE.fg }}>
                <Check className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: PALETTE.primary }} />
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div>{mockup}</div>
      </div>
    </Reveal>
  )
}

// ── Mockups (pure CSS, no external images) ──
function DashboardMockup() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-xl border" style={{ borderColor: '#EAE3D6', background: '#fff' }}>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: '#F0EAE0', background: PALETTE.soft }}>
        <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-[10px]" style={{ color: PALETTE.secondary }}>Wedding OS · Dashboard</span>
      </div>
      <div className="grid grid-cols-3 gap-3 p-5">
        {[
          { label: 'Guests', value: '94 / 120', tone: PALETTE.secondary },
          { label: 'Budget', value: '€18,400', tone: PALETTE.primary },
          { label: 'Tasks left', value: '6', tone: PALETTE.secondary },
        ].map((card) => (
          <div key={card.label} className="rounded-xl p-3" style={{ background: PALETTE.soft }}>
            <div className="text-[11px] uppercase tracking-wide" style={{ color: '#7a7264' }}>{card.label}</div>
            <div className="font-semibold mt-1" style={{ color: card.tone, fontSize: '17px' }}>{card.value}</div>
          </div>
        ))}
      </div>
      <div className="px-5 pb-5 space-y-2">
        {['Confirm florist contract', 'Final guest count to caterer', 'Music & DJ playlist'].map((t, i) => (
          <div key={t} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: '#fff', border: '1px solid #F0EAE0' }}>
            <span className="text-[13px]" style={{ color: PALETTE.fg }}>{t}</span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: i === 0 ? PALETTE.soft : '#EAF0EC',
                color: i === 0 ? PALETTE.primary : PALETTE.secondary,
              }}
            >
              {i === 0 ? 'In progress' : 'Done'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AIPanelMockup() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-xl border p-6" style={{ borderColor: '#EAE3D6', background: '#fff' }}>
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
          style={{ background: PALETTE.secondary }}
        >
          <Bot className="w-4 h-4" />
        </div>
        <span className="font-semibold" style={{ color: PALETTE.fg }}>Ask {ASSISTANT_NAME}</span>
      </div>
      <div className="space-y-3">
        <div className="rounded-xl px-4 py-3 text-[14px]" style={{ background: PALETTE.soft, color: PALETTE.fg }}>
          Suggest a timeline for a 120-guest evening reception in Como.
        </div>
        <div className="rounded-xl px-4 py-3 text-[14px]" style={{ background: '#fff', border: `1px solid ${PALETTE.soft}`, color: '#3a3a3a' }}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4" style={{ color: PALETTE.primary }} />
            <span className="font-medium" style={{ color: PALETTE.secondary }}>Suggested timeline</span>
          </div>
          <ul className="space-y-1.5 text-[13px]">
            <li>16:00 — Welcome drinks &amp; canapés</li>
            <li>17:30 — Ceremony, lakeside terrace</li>
            <li>19:00 — Seated dinner, four courses</li>
            <li>22:00 — Speeches, first dance, open floor</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function GuestPortalMockup() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-xl border" style={{ borderColor: '#EAE3D6' }}>
      <div className="px-3 py-2 text-[10px] border-b" style={{ background: PALETTE.soft, color: PALETTE.secondary, borderColor: '#F0EAE0' }}>
        sophie-and-james-2025.wedding-planner.app
      </div>
      <div
        className="px-8 py-12 text-center"
        style={{ background: `linear-gradient(180deg, ${PALETTE.soft} 0%, #fff 70%)` }}
      >
        <div className="text-[24px]" style={{ color: PALETTE.primary }}>♥</div>
        <h4
          className="mt-2"
          style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '26px', color: PALETTE.secondary }}
        >
          Sophie &amp; James
        </h4>
        <p className="mt-1 text-[13px]" style={{ color: '#7a7264' }}>September 14, 2025 · Lake Como, Italy</p>
        <div className="mt-5 flex justify-center gap-2 flex-wrap">
          {['Our story', 'Travel', 'RSVP', 'Registry'].map((c) => (
            <span
              key={c}
              className="text-[11px] px-2.5 py-1 rounded-full"
              style={{ background: '#fff', color: PALETTE.secondary, border: '1px solid #E8E0D2' }}
            >
              {c}
            </span>
          ))}
        </div>
        <button
          className="mt-5 text-[12px] font-medium px-5 py-2 rounded-full text-white"
          style={{ background: PALETTE.primary }}
        >
          Confirm your RSVP
        </button>
      </div>
    </div>
  )
}

// ── Pricing card ──
function PricingCard({ name, price, period, perks, ctaLabel, ctaTo, accent = false, badge }) {
  return (
    <Reveal>
      <div
        className="relative rounded-2xl p-7 h-full flex flex-col"
        style={{
          background: accent ? PALETTE.secondary : '#fff',
          color: accent ? '#fff' : PALETTE.fg,
          border: `1px solid ${accent ? PALETTE.secondary : '#E8E0D2'}`,
          boxShadow: accent ? '0 24px 60px -28px rgba(45,74,62,0.45)' : '0 10px 40px -24px rgba(196,149,106,0.25)',
        }}
      >
        {badge && (
          <span
            className="absolute -top-3 left-7 text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wide"
            style={{ background: PALETTE.primary, color: '#fff' }}
          >
            {badge}
          </span>
        )}
        <h4
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: '26px',
            color: accent ? '#fff' : PALETTE.secondary,
          }}
        >
          {name}
        </h4>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-4xl font-semibold">{price}</span>
          <span className="text-sm opacity-70">{period}</span>
        </div>
        <ul className="mt-6 space-y-2.5 flex-1">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-2 text-[15px]">
              <Check className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: accent ? PALETTE.primary : PALETTE.secondary }} />
              <span style={{ opacity: accent ? 0.9 : 1 }}>{p}</span>
            </li>
          ))}
        </ul>
        <Link
          to={ctaTo}
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-medium transition-colors"
          style={{
            background: accent ? PALETTE.primary : PALETTE.secondary,
            color: '#fff',
          }}
        >
          {ctaLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </Reveal>
  )
}

// ── Testimonial card ──
function Testimonial({ quote, name, date }) {
  return (
    <Reveal>
      <figure
        className="h-full rounded-2xl p-7 flex flex-col"
        style={{ background: '#fff', border: '1px solid #E8E0D2' }}
      >
        <div className="flex gap-0.5 mb-3" aria-hidden="true">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-3.5 h-3.5 fill-current" style={{ color: PALETTE.primary }} />
          ))}
        </div>
        <blockquote
          className="text-[16px] leading-relaxed flex-1"
          style={{ fontFamily: '"Playfair Display", Georgia, serif', color: PALETTE.fg }}
        >
          “{quote}”
        </blockquote>
        <figcaption className="mt-5">
          <div className="font-medium" style={{ color: PALETTE.secondary }}>{name}</div>
          <div className="text-[13px]" style={{ color: '#7a7264' }}>{date}</div>
        </figcaption>
      </figure>
    </Reveal>
  )
}

// ── Hero CTAs ──
function HeroCTAs() {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-8">
      <Link
        to="/auth?tab=register"
        className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-medium text-white transition-transform hover:-translate-y-0.5"
        style={{ background: PALETTE.primary, boxShadow: '0 14px 40px -16px rgba(196,149,106,0.65)' }}
      >
        Start planning free
        <ArrowRight className="w-4 h-4" />
      </Link>
      <Link
        to="/demo"
        className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-medium border transition-colors hover:bg-white"
        style={{ borderColor: PALETTE.secondary, color: PALETTE.secondary, background: 'transparent' }}
      >
        See a demo
      </Link>
    </div>
  )
}

// ── Main page ──
export default function PublicLandingPage() {
  const { pricing, format } = usePricing()
  return (
    <main
      className="min-h-screen overflow-x-hidden"
      style={{
        background: PALETTE.bg,
        color: PALETTE.fg,
        fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Inject the brand fonts once. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
      />

      {/* ── Top nav ── */}
      <nav className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between relative z-10">
        <Link to="/" className="flex items-center gap-2 font-semibold" style={{ color: PALETTE.secondary }}>
          <Heart className="w-5 h-5" style={{ color: PALETTE.primary, fill: PALETTE.primary }} />
          <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '20px' }}>Wedding OS</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4 text-sm">
          <Link to="/demo" className="hidden sm:inline-block hover:underline" style={{ color: PALETTE.secondary }}>
            Demo
          </Link>
          <Link to="/auth?tab=login" className="hover:underline" style={{ color: PALETTE.secondary }}>
            Sign in
          </Link>
          <Link
            to="/auth?tab=register"
            className="rounded-xl px-4 py-2 text-white font-medium"
            style={{ background: PALETTE.secondary }}
          >
            Start free
          </Link>
        </div>
      </nav>

      {/* ── 1. Hero ── */}
      <section className="relative overflow-hidden">
        <HeroBackdrop />
        <div className="relative max-w-6xl mx-auto px-6 pt-10 pb-24 grid lg:grid-cols-2 gap-14 items-center">
          <Reveal>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: PALETTE.soft, color: PALETTE.secondary }}
            >
              <Sparkles className="w-3 h-3" /> Smart wedding planning
            </span>
            <h1
              className="mt-5 text-4xl sm:text-5xl lg:text-6xl"
              style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                color: PALETTE.fg,
                lineHeight: 1.05,
                letterSpacing: '-0.01em',
              }}
            >
              Your wedding, organised.
              <span className="block mt-2" style={{ color: PALETTE.primary }}>
                Your love story, remembered.
              </span>
            </h1>
            <p
              className="mt-5 text-[18px] leading-relaxed max-w-xl"
              style={{ color: '#4a4a4a' }}
            >
              Smart planning for the most important day of your life. Guest management,
              budget tracking, RSVPs — all in one beautiful place.
            </p>
            <HeroCTAs />
            <p className="mt-6 text-sm" style={{ color: '#7a7264' }}>
              Join 500+ couples planning their perfect day.
            </p>
          </Reveal>

          <Reveal delay={150}>
            <div className="relative">
              <DashboardMockup />
              <div className="hidden md:block absolute -bottom-10 -right-6 w-64">
                <GuestPortalMockup />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 2. Pain → Solution ── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto">
            <h2
              className="text-3xl sm:text-4xl"
              style={{ fontFamily: '"Playfair Display", Georgia, serif', color: PALETTE.fg }}
            >
              Stop juggling 12 spreadsheets.
            </h2>
            <p className="mt-3 text-[16px]" style={{ color: '#4a4a4a' }}>
              The everyday wedding-planning chaos — solved.
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          <PainCard
            icon={<Users className="w-5 h-5" />}
            title="Guest chaos"
            desc="One guest list. Dietary needs, RSVPs, seating — tracked automatically."
            delay={0}
          />
          <PainCard
            icon={<Wallet className="w-5 h-5" />}
            title="Budget anxiety"
            desc="Track every cost. Set limits. No more surprise overspending."
            delay={120}
          />
          <PainCard
            icon={<ListChecks className="w-5 h-5" />}
            title="Task overload"
            desc="Your personal planning checklist, powered by Wedi. Never miss a detail."
            delay={240}
          />
        </div>
      </section>

      {/* ── 3. Features Showcase (alternating rows) ── */}
      <section
        className="py-24"
        style={{ background: '#fff', borderTop: '1px solid #F0EAE0', borderBottom: '1px solid #F0EAE0' }}
      >
        <div className="max-w-6xl mx-auto px-6 space-y-24">
          <FeatureRow
            badge="Smart Guest Management"
            title="Every guest, every detail, in one calm view."
            description="Import contacts, send invitations, track RSVPs, dietary needs, and seating — without a single spreadsheet."
            bullets={[
              'Live RSVP dashboard with confirmed / pending / declined splits',
              'Dietary, accessibility, and plus-one tracking',
              'Bulk email and reminders that respect tone',
              'Custom guest portal with your branding',
            ]}
            mockup={<DashboardMockup />}
          />
          <FeatureRow
            flip
            badge={`✦ Planning with ${ASSISTANT_NAME}`}
            title="A planner that's been to a thousand weddings."
            description={`Ask ${ASSISTANT_NAME} to generate timelines, suggest vendors, write your website copy, and draft seating plans — all grounded in your real wedding data.`}
            bullets={[
              'Day-of timeline tuned to your venue and guest count',
              'Vendor and seating suggestions',
              'Drafts wedding website copy and invitation wording',
              'Stays out of the way — you remain in control',
            ]}
            mockup={<AIPanelMockup />}
          />
          <FeatureRow
            badge="Beautiful Guest Portal"
            title="A page your guests will actually want to open."
            description="Each wedding gets a polished public portal — story, schedule, travel info, RSVP, and registry. Mobile-first by default."
            bullets={[
              'Custom slug (yourname-and-partner-2026)',
              `Smart content builder with ${ASSISTANT_NAME}`,
              'Translations to English / German / French',
              'Mobile-first, accessible, and fast',
            ]}
            mockup={<GuestPortalMockup />}
          />
        </div>
      </section>

      {/* ── 4. Pricing ── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto">
            <h2
              className="text-3xl sm:text-4xl"
              style={{ fontFamily: '"Playfair Display", Georgia, serif', color: PALETTE.fg }}
            >
              Simple, honest pricing.
            </h2>
            <p className="mt-3 text-[16px]" style={{ color: '#4a4a4a' }}>
              Free forever for small weddings. One flat fee — or pay it off once.
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <PricingCard
            name="Free"
            price={format(0)}
            period="forever"
            ctaLabel="Start free"
            ctaTo="/auth?tab=register"
            perks={[
              'Up to 30 guests',
              'Up to 20 tasks',
              'Basic budget tracking',
              'Public guest portal',
              'RSVP collection',
            ]}
          />
          <PricingCard
            accent
            badge="Most popular"
            name="Premium"
            price={format(pricing.monthly)}
            period={`/month · or ${format(pricing.lifetime)} lifetime`}
            ctaLabel="Upgrade to Premium"
            ctaTo="/auth?tab=register"
            perks={[
              'Unlimited guests, tasks, RSVPs',
              `Full ${ASSISTANT_NAME} planning assistant`,
              'Custom slug + branded portal',
              'Exports & advanced budget',
              'Priority support',
            ]}
          />
        </div>
      </section>

      {/* ── 5. Testimonials ── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Reveal>
          <h2
            className="text-3xl sm:text-4xl text-center"
            style={{ fontFamily: '"Playfair Display", Georgia, serif', color: PALETTE.fg }}
          >
            Couples who breathed again.
          </h2>
        </Reveal>
        <div className="mt-10 grid md:grid-cols-2 gap-6">
          <Testimonial
            quote="We had 120 guests across three countries. The RSVP dashboard alone saved us weeks of WhatsApp back-and-forth."
            name="Mia & Jonas"
            date="Married, June 2025"
          />
          <Testimonial
            quote="Wedi's suggestions felt thoughtful, not generic. Our planner now uses it too."
            name="Sophie & Luca"
            date="Married, September 2025"
          />
        </div>
      </section>

      {/* ── 6. Final CTA ── */}
      <section
        className="py-24"
        style={{ background: PALETTE.secondary, color: '#fff' }}
      >
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2
            className="text-3xl sm:text-5xl"
            style={{ fontFamily: '"Playfair Display", Georgia, serif', lineHeight: 1.05 }}
          >
            Ready to start?
          </h2>
          <p className="mt-4 text-[17px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
            No credit card required. Free forever for up to 30 guests.
          </p>
          <Link
            to="/auth?tab=register"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-medium"
            style={{ background: PALETTE.primary, color: '#fff', boxShadow: '0 16px 40px -16px rgba(0,0,0,0.4)' }}
          >
            Create your free wedding workspace
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12" style={{ background: PALETTE.bg, borderTop: '1px solid #EAE3D6' }}>
        <div className="max-w-6xl mx-auto px-6 grid sm:grid-cols-2 gap-6 text-sm">
          <div>
            <div className="flex items-center gap-2 font-semibold" style={{ color: PALETTE.secondary }}>
              <Heart className="w-4 h-4" style={{ color: PALETTE.primary, fill: PALETTE.primary }} />
              <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '18px' }}>Wedding OS</span>
            </div>
            <p className="mt-2" style={{ color: '#7a7264' }}>
              Planning, beautifully organised.
            </p>
            <p className="mt-4 text-xs" style={{ color: '#9a9182' }}>
              Made with care by Alpmind Labs.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 sm:justify-end" style={{ color: PALETTE.secondary }}>
            <Link to="/#features" className="hover:underline">Features</Link>
            <Link to="/#pricing" className="hover:underline">Pricing</Link>
            <Link to="/demo" className="hover:underline">Demo</Link>
            <Link to="/auth?tab=login" className="hover:underline">Sign in</Link>
            <Link to="/guest/login" className="hover:underline">Guest portal</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
