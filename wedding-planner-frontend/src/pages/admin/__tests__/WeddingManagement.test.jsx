import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
import api from '../../../lib/api'
import WeddingManagement from '../WeddingManagement'

const overview = {
  guests: { total: 3, by_status: { pending: 1, confirmed: 1, declined: 1 } },
  headcount: { invited: 9, confirmed: 4, pending: 3, declined: 2 },
  overnight: { yes: 2, no: 2 },
  dietary: { with_restrictions: 5, with_allergies: 1, with_special_requests: 0 },
  budget: { planned: 1700, paid: 500, remaining: 1200 },
  currency: 'EUR',
  wedding_date: '2026-06-20',
  days_until: 12,
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><WeddingManagement /></MemoryRouter>
    </QueryClientProvider>
  )
}

describe('WeddingManagement', () => {
  beforeEach(() => {
    api.get.mockReset() // (don't return it: vitest would call the returned fn as teardown)
  })
  afterEach(cleanup)

  it('uses only /analytics/overview and shows people counts, date and countdown', async () => {
    api.get.mockResolvedValue({ data: overview })
    renderPage()
    expect(await screen.findByText('12 days to go')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument() // people invited
    expect(screen.getAllByText(/EUR/).length).toBeGreaterThan(0) // wedding currency, not CHF
    expect(api.get.mock.calls.map((c) => c[0])).toEqual(['/analytics/overview'])
    expect(screen.queryByText(/Set in Content Management/)).toBeNull()
    expect(screen.queryByText(/Next Steps/i)).toBeNull()
  })

  it('falls back to CHF and invites setting a date when none exists', async () => {
    api.get.mockResolvedValue({ data: { ...overview, currency: undefined, wedding_date: null, days_until: null } })
    renderPage()
    expect(await screen.findByText(/No date set yet/)).toBeInTheDocument()
    expect(screen.getAllByText(/CHF/).length).toBeGreaterThan(0)
  })

  it('shows the API error text on failure', async () => {
    const e = Object.assign(new Error('x'), { response: { data: { code: 'internal_error', detail: 'Boom' } } })
    api.get.mockRejectedValue(e)
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom')
  })
})
