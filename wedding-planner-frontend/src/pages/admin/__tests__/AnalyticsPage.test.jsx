import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
// recharts needs layout; stub the chart container so jsdom can render.
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts')
  return { ...actual, ResponsiveContainer: ({ children }) => <div>{children}</div> }
})
import api from '../../../lib/api'
import AnalyticsPage, { accumulateRsvps } from '../AnalyticsPage'

const responses = {
  '/analytics/overview': {
    headcount: { invited: 20, confirmed: 8, pending: 9, declined: 3 },
    dietary: { with_restrictions: 2, with_allergies: 1, with_special_requests: 0 },
  },
  '/analytics/rsvp-progress': { total_guests: 10, daily: [] },
  '/analytics/site-stats?days=30': { total_views: 42, unique_visitors: 7, daily_views: [], top_pages: [] },
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AnalyticsPage />
    </QueryClientProvider>
  )
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    api.get.mockReset()
    api.get.mockImplementation(async (url) => ({ data: responses[url] }))
  })
  afterEach(cleanup)

  it('shows only per-wedding data and never calls the security endpoint', async () => {
    renderPage()
    expect(await screen.findByText('42')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText(/RSVP progress/)).toBeInTheDocument()
    expect(screen.queryByText(/Security/i)).toBeNull()
    const urls = api.get.mock.calls.map((c) => c[0]).sort()
    expect(urls).toEqual(Object.keys(responses).sort())
  })
})

describe('accumulateRsvps', () => {
  it('builds running totals', () => {
    const out = accumulateRsvps([
      { date: '2026-02-01', confirmed: 2, declined: 0 },
      { date: '2026-02-03', confirmed: 1, declined: 1 },
    ])
    expect(out.map((p) => [p.confirmed, p.declined, p.answered])).toEqual([[2, 0, 2], [3, 1, 4]])
  })
})
