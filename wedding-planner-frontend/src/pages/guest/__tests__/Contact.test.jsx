import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Contact from '../Contact'

const getDefaultTranslations = () => ({
  contactTitle: 'Contact us',
  contactIntro: 'Reach out any time',
  contactBrideGroom: 'Bride & Groom',
  contactWitnesses: 'Witnesses',
  contactCoupleDescription: 'Contact the couple directly',
  contactWitnessesDescription: 'Contact the witnesses directly',
  witnessPhoneLabel: 'Phone',
  guest_couple_cards: JSON.stringify([
    { name: 'Emma', image: 'https://example.com/emma.jpg', phone: '+41 11 111 11 11' },
    { name: 'Noah', image: 'https://example.com/noah.jpg', phone: '+41 22 222 22 22' },
  ]),
  guest_witnesses: JSON.stringify([
    { name: 'Liam', image: 'https://example.com/liam.jpg', phone: '+41 77 123 45 67' },
  ]),
})

let translations = getDefaultTranslations()

// Mock LanguageContext
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key) => translations[key] || key,
  }),
}))

describe('Contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    translations = getDefaultTranslations()
  })

  it('shows couple cards and toggle when witness cards exist', () => {
    render(<Contact />)

    expect(screen.getByText('Contact us')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bride & Groom' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Witnesses' })).toBeInTheDocument()
    expect(screen.getAllByText('Emma').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Noah').length).toBeGreaterThan(0)
  })

  it('switches to witnesses and reveals phone contact on card flip', async () => {
    const user = userEvent.setup()
    render(<Contact />)

    await user.click(screen.getByRole('button', { name: 'Witnesses' }))
    expect(screen.getAllByText('Liam').length).toBeGreaterThan(0)
    expect(screen.getByText('Contact the witnesses directly')).toBeInTheDocument()

    await user.click(screen.getAllByText('Liam')[0])

    expect(screen.getByText('Phone')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+41 77 123 45 67' })).toHaveAttribute('href', 'tel:+41771234567')
  })

  it('falls back to intro text and hides mode toggle without cards', () => {
    translations.guest_couple_cards = '[]'
    translations.guest_witnesses = '[]'
    render(<Contact />)

    expect(screen.queryByRole('button', { name: 'Bride & Groom' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Witnesses' })).not.toBeInTheDocument()
    expect(screen.getByText('Reach out any time')).toBeInTheDocument()
  })
})
