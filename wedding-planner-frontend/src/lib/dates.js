/**
 * Parse a date-only string ("YYYY-MM-DD", or the date part of an ISO string) as
 * a LOCAL calendar date. `new Date("2026-06-20")` is UTC midnight and renders as
 * the previous day west of UTC, so never use it for date-only values.
 * Returns null when unparseable.
 */
export function parseLocalDate(value) {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Locale-formatted long date for a date-only string; '' when unparseable. */
export function formatLocalDate(value, locale, options = { dateStyle: 'long' }) {
  const d = parseLocalDate(value)
  return d ? new Intl.DateTimeFormat(locale, options).format(d) : ''
}
