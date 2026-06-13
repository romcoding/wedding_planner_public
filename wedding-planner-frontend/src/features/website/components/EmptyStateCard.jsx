import { Sparkles, X } from 'lucide-react'
import Tooltip from '../../../components/ui/Tooltip'

const ROSE_GOLD = '#C4956A'

// Warm intro shown until the site is first published. The "Let Wedi draft it
// for you" action is present but disabled — P3 will wire it up.
export default function EmptyStateCard({ onDismiss }) {
  return (
    <div
      className="relative rounded-2xl border p-5"
      style={{ borderColor: `${ROSE_GOLD}33`, background: '#FFF9F3' }}
    >
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      ) : null}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: '#F5E6D8' }}
        >
          <Sparkles className="w-5 h-5" style={{ color: ROSE_GOLD }} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Your website, the easy way</h3>
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">
            It starts as a draft with your names and date already filled in. Toggle the sections
            below, make them yours, pick a theme, and publish when you are ready.
          </p>
          <div className="mt-3">
            <Tooltip content="Coming right up" position="right">
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-medium opacity-60 cursor-not-allowed"
                style={{ background: ROSE_GOLD }}
              >
                <Sparkles className="w-4 h-4" />
                Let Wedi draft it for you
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}
