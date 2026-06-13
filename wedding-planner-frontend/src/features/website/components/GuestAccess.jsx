import { useState } from 'react'
import { Lock } from 'lucide-react'

// Surfaces the backend website settings that aren't on the top bar: whether the
// RSVP section shows, and an optional guest password (hashed server-side).
export default function GuestAccess({ rsvpEnabled, hasPassword, onSave }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (patch) => {
    setBusy(true)
    try {
      await onSave(patch)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Guest access</h2>

      <button
        type="button"
        role="switch"
        aria-checked={!!rsvpEnabled}
        onClick={() => save({ rsvp_enabled: !rsvpEnabled })}
        disabled={busy}
        className="flex items-center justify-between gap-3 w-full text-left"
      >
        <span className="text-sm text-gray-700">Show RSVP section</span>
        <span
          aria-hidden
          className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
            rsvpEnabled ? 'bg-rose-400' : 'bg-gray-200'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              rsvpEnabled ? 'translate-x-4' : ''
            }`}
          />
        </span>
      </button>

      <div>
        <span className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1">
          <Lock className="w-3 h-3" /> Password {hasPassword ? '(set)' : '(optional)'}
        </span>
        <div className="flex gap-2">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={hasPassword ? 'Enter a new password' : 'Add a password'}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-rose-300"
          />
          <button
            type="button"
            disabled={busy || pw.length < 4}
            onClick={async () => {
              await save({ password: pw })
              setPw('')
            }}
            className="px-3 py-2 rounded-lg text-sm text-white disabled:opacity-40"
            style={{ background: '#C4956A' }}
          >
            Set
          </button>
        </div>
        {hasPassword ? (
          <button
            type="button"
            onClick={() => save({ password: '' })}
            className="mt-1 text-xs text-gray-400 hover:text-red-500"
          >
            Remove password
          </button>
        ) : null}
      </div>
    </div>
  )
}
