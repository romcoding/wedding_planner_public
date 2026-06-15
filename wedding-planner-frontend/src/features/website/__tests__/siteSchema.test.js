import { describe, it, expect } from 'vitest'
import {
  defaultDocument,
  ensureDocument,
  validateBlockData,
  BLOCK_ORDER,
  VALID_THEMES,
} from '../siteSchema'

describe('siteSchema (frontend mirror)', () => {
  it('builds a canonical seeded default document', () => {
    const doc = defaultDocument({
      partner_one_name: 'Alex',
      partner_two_name: 'Sam',
      wedding_date: '2026-09-12',
      location: 'Lake Como',
    })
    expect(doc.version).toBe(1)
    expect(doc.blocks.map((b) => b.type)).toEqual(BLOCK_ORDER)
    expect(doc.blocks[0].data.coupleNames).toBe('Alex & Sam')
  })

  it('ensureDocument fills missing blocks in canonical order', () => {
    const doc = ensureDocument({ version: 1, blocks: [{ type: 'hero', enabled: true, data: { coupleNames: 'Z' } }] })
    expect(doc.blocks.map((b) => b.type)).toEqual(BLOCK_ORDER)
  })

  it('mirrors the backend rules (https-only, caps, control chars, unknown keys)', () => {
    expect(validateBlockData('hero', { heroImageUrl: 'https://x/y.jpg' }).success).toBe(true)
    expect(validateBlockData('hero', { heroImageUrl: 'http://x' }).success).toBe(false)
    expect(validateBlockData('story', { body: 'x'.repeat(2001) }).success).toBe(false)
    expect(validateBlockData('gallery', { photos: Array(17).fill('https://x/a.jpg') }).success).toBe(false)
    expect(validateBlockData('hero', { bogus: 'x' }).success).toBe(false)

    const withControl = 'A' + String.fromCharCode(0) + String.fromCharCode(31) + 'B'
    const result = validateBlockData('hero', { coupleNames: withControl })
    expect(result.success).toBe(true)
    expect(result.data.coupleNames).toBe('AB')
  })

  it('exposes exactly four themes', () => {
    expect(VALID_THEMES).toHaveLength(4)
  })
})
