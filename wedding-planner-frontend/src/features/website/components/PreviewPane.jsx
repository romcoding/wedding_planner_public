import SiteRenderer from '../themes/SiteRenderer'

const STATUS_STYLE = {
  draft: 'bg-gray-100 text-gray-500',
  published: 'bg-green-100 text-green-700',
  unpublished: 'bg-amber-100 text-amber-700',
}

// Live preview, framed like a browser window. Renders with the exact same pure
// components the public site will use.
export default function PreviewPane({ content, theme, slug, status }) {
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
      <div className="h-[72vh] overflow-y-auto">
        <SiteRenderer content={content} theme={theme} />
      </div>
    </div>
  )
}
