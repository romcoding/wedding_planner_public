import { describe, it, expect } from 'vitest'
import { parseLocalDate, formatLocalDate } from '../dates'

describe('parseLocalDate', () => {
  it('parses a date-only string as a local calendar date', () => {
    const d = parseLocalDate('2026-06-20')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 5, 20])
    expect(d.getHours()).toBe(0)
  })
  it('uses the date part of an ISO datetime', () => {
    expect(parseLocalDate('2026-06-20T23:30:00Z').getDate()).toBe(20)
  })
  it('returns null for empty or garbage input', () => {
    expect(parseLocalDate('')).toBeNull()
    expect(parseLocalDate(null)).toBeNull()
    expect(parseLocalDate('nope')).toBeNull()
    expect(formatLocalDate('nope')).toBe('')
  })
})
