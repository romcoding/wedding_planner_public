import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import SiteRenderer from '../themes/SiteRenderer'
import { defaultDocument, VALID_THEMES } from '../siteSchema'

describe('SiteRenderer', () => {
  const content = defaultDocument({
    partner_one_name: 'Alex',
    partner_two_name: 'Sam',
    wedding_date: '2026-09-12',
  })

  it('renders every theme without crashing', () => {
    for (const theme of VALID_THEMES) {
      const { container, unmount } = render(<SiteRenderer content={content} theme={theme} />)
      expect(container.textContent).toContain('Alex & Sam')
      unmount()
    }
  })

  it('hides disabled blocks', () => {
    const doc = defaultDocument({ partner_one_name: 'A', partner_two_name: 'B' })
    doc.blocks.find((b) => b.type === 'hero').data.tagline = 'ZZ_HERO_ONLY'

    const { queryByText, rerender } = render(<SiteRenderer content={doc} theme="classic" />)
    expect(queryByText('ZZ_HERO_ONLY')).not.toBeNull()

    const off = { ...doc, blocks: doc.blocks.map((b) => (b.type === 'hero' ? { ...b, enabled: false } : b)) }
    rerender(<SiteRenderer content={off} theme="classic" />)
    expect(queryByText('ZZ_HERO_ONLY')).toBeNull()
  })
})
