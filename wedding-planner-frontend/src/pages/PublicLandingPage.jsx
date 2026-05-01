import { Link } from 'react-router-dom'
import { Heart, Sparkles, ShieldCheck, Users } from 'lucide-react'

export default function PublicLandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-white text-gray-900">
      <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <div className="inline-flex items-center gap-2 text-rose-600 font-semibold mb-5">
          <Heart className="w-5 h-5 fill-rose-500" />
          wedding_planner
        </div>
        <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-4xl">
          Plan your wedding, publish your guest website, and manage RSVP flow in one place.
        </h1>
        <p className="mt-6 text-lg text-gray-600 max-w-3xl">
          A complete workspace for couples and planners: admin board, guest website builder, and guest registration portal.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/auth?tab=register" className="px-5 py-3 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700">
            Create organizer account
          </Link>
          <Link to="/auth?tab=login" className="px-5 py-3 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 font-medium">
            Open admin board
          </Link>
          <Link to="/guest/register" className="px-5 py-3 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 font-medium">
            Guest registration
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20 grid md:grid-cols-3 gap-4">
        <article className="rounded-2xl border bg-white p-5">
          <ShieldCheck className="w-5 h-5 text-rose-600" />
          <h2 className="mt-3 font-semibold">Admin for planner or couple</h2>
          <p className="mt-2 text-sm text-gray-600">Manage guests, invitations, costs, content, analytics, and timelines from the admin dashboard.</p>
        </article>
        <article className="rounded-2xl border bg-white p-5">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h2 className="mt-3 font-semibold">Guest website builder</h2>
          <p className="mt-2 text-sm text-gray-600">Design and edit your public wedding page, reorder sections, and use AI-powered commands.</p>
        </article>
        <article className="rounded-2xl border bg-white p-5">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="mt-3 font-semibold">Guest registration & RSVP</h2>
          <p className="mt-2 text-sm text-gray-600">Guests can register, log in, and RSVP through a dedicated portal or wedding slug page.</p>
        </article>
      </section>
    </main>
  )
}
