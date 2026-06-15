import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import SiteRenderer from '../themes/SiteRenderer'
import { ROSE_GOLD, WEDI_STATUS_LINES } from '../wedi'

const STATUS_STYLE = {
  draft: 'bg-gray-100 text-gray-500',
  published: 'bg-green-100 text-green-700',
  unpublished: 'bg-amber-100 text-amber-700',
}

// Live preview, framed like a browser window. Renders with the exact same pure
// components the public site will use. While Wedi is generating, a calm skeleton
// shimmer + rotating status line cover the preview.
export default function PreviewPane({ content, theme, slug, status, generating = false }) {
  const [lineIdx, setLineIdx] = useState(0)

  useEffect(() => {
    if (!generating) return undefined
    setLineIdx(0)
    const id = setInterval(() => {
      setLineIdx((i) => (i + 1) % WEDI_STATUS_LINES.length)
    }, 2000)
    return () => clearInterval(id)
  }, [generating])

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-300" />
        </span>
        <span className="text-xs text-gray-500 truncate ml-1">/w/{slug}</span>
        <span
          className={`ml-auto text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${
            STATUS_STYLE[status] || STATUS_STYLE.draft
          }`}
        >
          {status}
        </span>
      </div>
      <div className="relative h-[72vh] overflow-y-auto">
        <SiteRenderer content={content} theme={theme} />
        {generating ? (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] flex flex-col items-center justify-center gap-5">
            <div className="w-full max-w-sm px-8 space-y-3" aria-hidden="true">
              <div className="h-5 rounded bg-gray-200 animate-pulse w-2/3 mx-auto" />
              <div className="h-3 rounded bg-gray-200 animate-pulse w-5/6 mx-auto" />
              <div className="h-3 rounded bg-gray-200 animate-pulse w-4/6 mx-auto" />
              <div className="h-24 rounded-lg bg-gray-200 animate-pulse" />
              <div className="h-3 rounded bg-gray-200 animate-pulse w-3/6 mx-auto" />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600" role="status" aria-live="polite">
              <Sparkles className="w-4 h-4 animate-pulse" style={{ color: ROSE_GOLD }} />
              <span>{WEDI_STATUS_LINES[lineIdx]}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
