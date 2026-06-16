import { useState } from 'react'
import { Globe, Copy, Check, Loader2, ExternalLink } from 'lucide-react'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import SavedIndicator from './SavedIndicator'
import { publicSiteUrl } from '../publicSite'

// Status line + copy-link + open-site + publish/unpublish (with confirmation).
export default function PublishBar({ status, slug, saveState, onPublish, onUnpublish, busy }) {
  const [confirm, setConfirm] = useState(null) // 'publish' | 'unpublish'
  const [copied, setCopied] = useState(false)
  const publicUrl = publicSiteUrl(slug)
  // Display the address without the scheme — calmer than a full URL.
  const publicLabel = publicUrl.replace(/^https?:\/\//, '')
  const live = status === 'published'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`inline-flex items-center gap-1.5 text-sm min-w-0 ${live ? 'text-green-700' : 'text-gray-500'}`}>
          <Globe className="w-4 h-4 shrink-0" />
          {live ? (
            <span className="truncate">
              Live at <span className="font-medium">{publicLabel}</span>
            </span>
          ) : status === 'unpublished' ? (
            'Offline'
          ) : (
            'Draft — not published yet'
          )}
        </span>
        {live ? (
          <>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open site
            </a>
          </>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <SavedIndicator state={saveState} />
        {live ? (
          <button
            type="button"
            onClick={() => setConfirm('unpublish')}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Unpublish
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setConfirm('publish')}
          disabled={busy}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 inline-flex items-center gap-2"
          style={{ background: '#C4956A' }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {live ? 'Re-publish' : 'Publish'}
        </button>
      </div>

      <ConfirmDialog
        isOpen={confirm === 'publish'}
        onClose={() => setConfirm(null)}
        onConfirm={onPublish}
        title="Publish your website?"
        message="This makes your current draft the live, public website. You can unpublish, or edit and re-publish, at any time."
        confirmText="Publish"
        variant="info"
      />
      <ConfirmDialog
        isOpen={confirm === 'unpublish'}
        onClose={() => setConfirm(null)}
        onConfirm={onUnpublish}
        title="Take the website offline?"
        message="Guests will no longer be able to view your website until you publish again. Your content is kept."
        confirmText="Unpublish"
        variant="warning"
      />
    </div>
  )
}
