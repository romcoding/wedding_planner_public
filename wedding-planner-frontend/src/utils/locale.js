// Locale-aware helpers for date and time handling.
// We default to the browser locale (e.g. de-CH) so European users see
// dd.mm.yyyy and 24-hour time without explicit configuration.

const FALLBACK_LOCALE = 'de-CH'

export function getUserLocale() {
  if (typeof navigator === 'undefined') return FALLBACK_LOCALE
  return (
    navigator.language ||
    (navigator.languages && navigator.languages[0]) ||
    FALLBACK_LOCALE
  )
}

// Format an ISO date or date string (YYYY-MM-DD or full ISO) using the user's locale.
export function formatLocaleDate(value, options = {}) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(getUserLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  }).format(date)
}

// Format with date + 24-hour time. Locale controls separators; hour12 is forced off
// so European users always see HH:mm regardless of OS preference.
export function formatLocaleDateTime(value, options = {}) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(getUserLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  }).format(date)
}

// Convert any incoming value to a YYYY-MM-DD string suitable for HTML date inputs.
export function toIsoDateInputValue(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    // already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    // ISO with time portion
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) return match[1]
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Convert to YYYY-MM-DDTHH:mm for datetime-local inputs without timezone shift.
export function toLocalDateTimeInputValue(value) {
  if (!value) return ''
  const s = String(value).trim()
  const hasTz = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)
  let date
  if (hasTz) {
    date = new Date(s)
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    return s.slice(0, 16)
  } else {
    date = new Date(s)
  }
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Build a placeholder showing the user's locale date pattern.
// Falls back to dd.mm.yyyy when Intl.DateTimeFormat#formatToParts is unavailable.
export function localeDatePlaceholder() {
  const sample = new Date(2026, 0, 31) // 31 Jan 2026
  try {
    const parts = new Intl.DateTimeFormat(getUserLocale(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(sample)
    return parts
      .map((part) => {
        if (part.type === 'day') return 'dd'
        if (part.type === 'month') return 'mm'
        if (part.type === 'year') return 'yyyy'
        return part.value
      })
      .join('')
  } catch {
    return 'dd.mm.yyyy'
  }
}

export function localeDateTimePlaceholder() {
  return `${localeDatePlaceholder()} HH:mm`
}
