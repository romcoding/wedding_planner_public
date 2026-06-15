// Shared bits for the "Wedi designs your website" UI (sheet, preview overlay,
// usage indicator). User-facing copy here intentionally never mentions the
// underlying technology — it is all framed as Wedi.

export const ROSE_GOLD = '#C4956A'

// Calm, rotating reassurance shown over the preview while Wedi works.
export const WEDI_STATUS_LINES = [
  'Wedi is sketching your story…',
  'Choosing the right words…',
  'Setting the scene…',
  'Adding a personal touch…',
]

// resetsOn arrives as 'YYYY-MM-01'; render it as a friendly local date.
export function formatResetDate(resetsOn) {
  if (!resetsOn) return ''
  const d = new Date(resetsOn)
  if (Number.isNaN(d.getTime())) return resetsOn
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

// True once this month's design budget is used up.
export function isAtLimit(wedi) {
  return !!(wedi && wedi.limit != null && wedi.used >= wedi.limit)
}
