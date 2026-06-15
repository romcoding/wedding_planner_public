import { useEffect, useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { ROSE_GOLD, formatResetDate, isAtLimit } from '../wedi'

const PLACEHOLDER =
  "We're getting married at a lakeside vineyard in September — relaxed, elegant, dinner at sunset…"

// The prompt sheet for both flows: a full draft (mode='full') and a per-section
// rework (mode='refine'). The parent runs the generation while this is closed,
// so the sheet stays simple: collect a note, hand it to onSubmit, close.
export default function WediGenerateSheet({ open, mode = 'full', sectionLabel, wedi, onClose, onSubmit }) {
  const [prompt, setPrompt] = useState('')
  const textareaRef = useRef(null)
  const atLimit = isAtLimit(wedi)

  useEffect(() => {
    if (!open) return undefined
    setPrompt('')
    const id = setTimeout(() => textareaRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [open])

  if (!open) return null

  const refine = mode === 'refine'
  const title = refine
    ? `Ask Wedi to rework “${sectionLabel || 'this section'}”`
    : 'Let Wedi draft your website'
  const subtitle = refine
    ? 'Tell Wedi what to change here. Your other sections stay exactly as they are.'
    : 'Describe your day in a sentence or two and Wedi will write a first draft you can edit.'
  const cta = refine ? 'Rework this section' : 'Let Wedi draft it'

  const canSubmit = prompt.trim().length > 0 && !atLimit

  const submit = () => {
    if (!canSubmit) return
    onSubmit(prompt.trim())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: '#F5E6D8' }}
          >
            <Sparkles className="w-5 h-5" style={{ color: ROSE_GOLD }} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          rows={5}
          value={prompt}
          maxLength={1500}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={PLACEHOLDER}
          className="mt-4 w-full px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-rose-300 resize-y"
        />
        <div className="mt-1 text-right text-[11px] text-gray-400">{prompt.length}/1500</div>

        {atLimit ? (
          <p className="mt-2 text-sm text-gray-600">
            Wedi has reached this month’s design limit. It resets on {formatResetDate(wedi?.resetsOn)}.
          </p>
        ) : null}

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: ROSE_GOLD }}
          >
            <Sparkles className="w-4 h-4" />
            {cta}
          </button>
        </div>
      </div>
    </div>
  )
}
