import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminLayout from '../AdminLayout'

let mockUser = { name: 'Alice & Bob', email: 'couple@example.com', role: 'admin', is_platform_admin: false }

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}))

vi.mock('../../contexts/WeddingContext', () => ({
  useWedding: () => ({ wedding: { plan: 'premium', slug: 'alice-and-bob' }, needsOnboarding: false }),
}))

vi.mock('../../components/AIPanel', () => ({
  default: () => null,
}))

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/admin/guests']}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="guests" element={<div>Guests page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('AdminLayout navigation', () => {
  it('never links to the removed Messages/Gift Registry destinations', () => {
    mockUser = { name: 'Alice & Bob', email: 'couple@example.com', role: 'admin', is_platform_admin: false }
    renderLayout()

    expect(screen.queryByRole('link', { name: /Messages/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Gift Registry/i })).not.toBeInTheDocument()
  })

  it('hides User Management and Content from a normal couple', () => {
    mockUser = { name: 'Alice & Bob', email: 'couple@example.com', role: 'admin', is_platform_admin: false }
    renderLayout()

    expect(screen.queryByRole('link', { name: /User Management/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Content$/i })).not.toBeInTheDocument()
  })

  it('shows User Management and Content to a real platform admin', () => {
    mockUser = { name: 'Admin', email: 'admin@example.com', role: 'admin', is_platform_admin: true }
    renderLayout()

    expect(screen.getByRole('link', { name: /User Management/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Content$/i })).toBeInTheDocument()
  })
})
