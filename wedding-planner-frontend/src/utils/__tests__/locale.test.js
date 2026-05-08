import { describe, it, expect } from 'vitest'
import {
  formatLocaleDate,
  formatLocaleDateTime,
  toIsoDateInputValue,
  toLocalDateTimeInputValue,
  localeDatePlaceholder,
} from '../locale'

describe('toIsoDateInputValue', () => {
  it('passes through a YYYY-MM-DD string unchanged', () => {
    expect(toIsoDateInputValue('2026-08-15')).toBe('2026-08-15')
  })

  it('extracts the date portion from a full ISO timestamp', () => {
    expect(toIsoDateInputValue('2026-08-15T18:30:00Z')).toBe('2026-08-15')
  })

  it('returns empty string for empty / invalid input', () => {
    expect(toIsoDateInputValue('')).toBe('')
    expect(toIsoDateInputValue(null)).toBe('')
    expect(toIsoDateInputValue('not-a-date')).toBe('')
  })
})

describe('toLocalDateTimeInputValue', () => {
  it('keeps a naive local datetime string in input format', () => {
    expect(toLocalDateTimeInputValue('2026-08-15T18:30')).toBe('2026-08-15T18:30')
    expect(toLocalDateTimeInputValue('2026-08-15T18:30:00')).toBe('2026-08-15T18:30')
  })

  it('returns empty string for empty input', () => {
    expect(toLocalDateTimeInputValue('')).toBe('')
    expect(toLocalDateTimeInputValue(null)).toBe('')
  })
})

describe('formatLocaleDate / formatLocaleDateTime', () => {
  it('returns empty string for falsy input', () => {
    expect(formatLocaleDate(null)).toBe('')
    expect(formatLocaleDateTime(undefined)).toBe('')
  })

  it('formats a date string without throwing', () => {
    const result = formatLocaleDate('2026-08-15')
    expect(typeof result).toBe('string')
    expect(result).toMatch(/2026/)
  })

  it('formats datetime in 24-hour format (no AM/PM)', () => {
    const result = formatLocaleDateTime('2026-08-15T18:30:00Z')
    expect(result).not.toMatch(/AM|PM/i)
  })
})

describe('localeDatePlaceholder', () => {
  it('returns a string containing day, month and year tokens', () => {
    const placeholder = localeDatePlaceholder()
    expect(placeholder).toContain('dd')
    expect(placeholder).toContain('mm')
    expect(placeholder).toContain('yyyy')
  })
})
