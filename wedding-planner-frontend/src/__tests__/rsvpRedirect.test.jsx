import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RsvpRedirect } from '../App'

// Regression test for the P0 bug: the backend/email service emails
// `/rsvp/:token` (see services/urls.py:rsvp_link), but the guest flow only
// ever lived at `/guest/rsvp/:token`, so the emailed link rendered blank.
describe('RsvpRedirect', () => {
  it('redirects a top-level /rsvp/:token link into the guest route', () => {
    render(
      <MemoryRouter initialEntries={['/rsvp/test-token-123']}>
        <Routes>
          <Route path="/rsvp/:token" element={<RsvpRedirect />} />
          <Route path="/guest/rsvp/:token" element={<div>Guest entry reached</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Guest entry reached')).toBeInTheDocument()
  })
})
