import { useEffect, useState } from 'react'
import { History, RotateCcw, Loader2 } from 'lucide-react'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'

function formatWhen(value) {
  if (!value) return 'Unknown'
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

// Collapsible list of published-snapshot revisions, with a confirmed restore.
export default function RevisionHistory({ listRevisions, onRestore, reloadToken }) {
  const [open, setOpen] = useState(false)
  const [revisions, setRevisions] = useState([])
  const [loading, setLoading] = useState(false)
  const [confirmId, setConfirmId] = useState(null)

  useEffect(() => {
    if (!open) return undefined
    let alive = true
    setLoading(true)
    listRevisions()
      .then((rows) => {
        if (alive) setRevisions(rows || [])
      })
      .catch(() => {
        if (alive) setRevisions([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [open, reloadToken, listRevisions])

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700"
      >
        <History className="w-4 h-4 text-gray-400" />
        Version history
        <span className="ml-auto text-xs text-gray-400">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? (
        <div className="px-4 pb-3">
          {loading ? (
            <div className="text-sm text-gray-400 flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : revisions.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">No published versions yet.</p>
          ) : (
            <ul className="space-y-1">
              {revisions.map((rev) => (
                <li
                  key={rev.id}
                  className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-gray-50 last:border-0"
                >
                  <span className="text-gray-600">{formatWhen(rev.created_at)}</span>
                  <button
                    type="button"
                    onClick={() => setConfirmId(rev.id)}
                    className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      <ConfirmDialog
        isOpen={confirmId != null}
        onClose={() => setConfirmId(null)}
        onConfirm={() => onRestore(confirmId)}
        title="Restore this version?"
        message="This replaces your current draft with the selected published version. You can edit and re-publish afterwards."
        confirmText="Restore"
        variant="warning"
      />
    </div>
  )
}
