import { useCallback, useEffect, useState } from 'react'
import { Download, UserPlus, Check, Loader2, Inbox } from 'lucide-react'
import { useToast } from '../../../components/ui/Toast'
import { getRsvps, addRsvpToGuests } from '../api'

const PAGE = 50

// Neutralize CSV/formula injection — mirror of the backend guest export
// (_csv_safe): cells beginning with = + - @ are prefixed with a single quote so
// spreadsheets render them as literal text. Then quote + escape for CSV.
function csvSafe(value) {
  const s = value == null ? '' : String(value)
  return /^[=+\-@]/.test(s) ? `'${s}` : s
}
function csvCell(value) {
  return `"${csvSafe(value).replace(/"/g, '""')}"`
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(typeof value === 'string' ? value.replace(' ', 'T') + 'Z' : value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString()
}

function Attending({ yes }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={`w-1.5 h-1.5 rounded-full ${yes ? 'bg-green-500' : 'bg-gray-300'}`} />
      <span className={yes ? 'text-gray-700' : 'text-gray-400'}>{yes ? 'Attending' : 'Not attending'}</span>
    </span>
  )
}

export default function RsvpInbox() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [adding, setAdding] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async (offset, append) => {
    const data = await getRsvps({ limit: PAGE, offset })
    setTotal(data.total || 0)
    setRows((prev) => (append ? [...prev, ...(data.responses || [])] : data.responses || []))
  }, [])

  useEffect(() => {
    let alive = true
    load(0, false)
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      await load(rows.length, true)
    } catch {
      toast.error('Could not load more responses')
    } finally {
      setLoadingMore(false)
    }
  }

  const onAdd = async (id) => {
    setAdding(id)
    try {
      const res = await addRsvpToGuests(id)
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, matched: true } : r)))
      toast.success(res.created ? 'Added to your guest list' : 'Already in your guest list')
    } catch {
      toast.error('Could not add to your guest list')
    } finally {
      setAdding(null)
    }
  }

  // Export EVERY response (not just the loaded page) — page through the API first.
  const exportCsv = async () => {
    setExporting(true)
    try {
      let all = []
      let offset = 0
      for (;;) {
        const data = await getRsvps({ limit: 200, offset })
        const batch = data.responses || []
        all = all.concat(batch)
        offset += batch.length
        if (batch.length < 200 || offset >= (data.total || 0)) break
      }
      const header = ['Name', 'Email', 'Attending', 'Party size', 'Dietary', 'Message', 'Date', 'In guest list']
      const lines = [header.map(csvCell).join(',')]
      for (const r of all) {
        lines.push([
          r.guest_name,
          r.email || '',
          r.attending ? 'Yes' : 'No',
          r.party_size,
          r.dietary || '',
          r.message || '',
          formatDate(r.created_at),
          r.matched ? 'Yes' : 'No',
        ].map(csvCell).join(','))
      }
      const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'rsvp-responses.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Could not export responses')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-gray-400">Loading responses…</div>
  }
  if (error) {
    return <div className="py-16 text-center text-red-500">We couldn’t load responses. Please try again.</div>
  }
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
        <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h3 className="text-sm font-medium text-gray-700">No responses yet</h3>
        <p className="text-sm text-gray-500 mt-1">
          When guests RSVP from your published website, their replies appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
        <div className="text-sm text-gray-500">
          {total} {total === 1 ? 'response' : 'responses'}
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="font-medium px-4 py-2">Name</th>
              <th className="font-medium px-4 py-2">Response</th>
              <th className="font-medium px-4 py-2">Party</th>
              <th className="font-medium px-4 py-2">Dietary</th>
              <th className="font-medium px-4 py-2">Message</th>
              <th className="font-medium px-4 py-2">Date</th>
              <th className="font-medium px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100 align-top">
                <td className="px-4 py-3">
                  <div className="text-gray-800">{r.guest_name}</div>
                  {r.email ? <div className="text-xs text-gray-400">{r.email}</div> : null}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Attending yes={r.attending} />
                </td>
                <td className="px-4 py-3 text-gray-600">{r.party_size}</td>
                <td className="px-4 py-3 text-gray-600 max-w-[14rem]">{r.dietary || '—'}</td>
                <td className="px-4 py-3 text-gray-600 max-w-[18rem]">
                  {r.message ? <span className="whitespace-pre-line">{r.message}</span> : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(r.created_at)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  {r.matched ? (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <Check className="w-3.5 h-3.5 text-green-500" />
                      In guest list
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAdd(r.id)}
                      disabled={adding === r.id}
                      className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
                    >
                      {adding === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                      Add to guest list
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length < total ? (
        <div className="px-4 py-3 border-t border-gray-100 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : `Load more (${total - rows.length})`}
          </button>
        </div>
      ) : null}
    </div>
  )
}
