import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import GuestRegister from '../Register'
import { GuestAuthProvider } from '../../../contexts/GuestAuthContext'

const getMock = vi.fn()
const postMock = vi.fn()
vi.mock('../../../lib/api', () => ({
  default: {
    get: (...args) => getMock(...args),
    post: (...args) => postMock(...args),
  },
}))

vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: (key) => key }),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

function renderRegister() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <GuestAuthProvider>
        <MemoryRouter initialEntries={['/guest/register?token=invite-token']}>
          <GuestRegister />
        </MemoryRouter>
      </GuestAuthProvider>
    </QueryClientProvider>
  )
}

describe('GuestRegister', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    getMock.mockReset()
    postMock.mockReset()
    navigateMock.mockReset()
    getMock.mockResolvedValue({ data: { valid: true, guest_name: 'Alex' } })
  })

  it('stores the guest session in sessionStorage (not localStorage) and navigates to /guest/info', async () => {
    postMock.mockResolvedValue({
      data: { access_token: 'tok-abc', guest: { id: 'g1', first_name: 'Alex' } },
    })
    const user = userEvent.setup()
    renderRegister()

    await screen.findByLabelText('guestRegisterFirstName')
    await user.type(screen.getByLabelText('guestRegisterFirstName'), 'Alex')
    await user.type(screen.getByLabelText('guestRegisterLastName'), 'Doe')
    await user.type(screen.getByLabelText(/Username/i), 'alexdoe')
    await user.type(screen.getByLabelText(/guestLoginPassword/), 'sixplus1')
    await user.type(screen.getByLabelText('guestRegisterConfirmPassword'), 'sixplus1')
    await user.click(screen.getByRole('button', { name: 'guestRegisterCreateContinue' }))

    await vi.waitFor(() => expect(postMock).toHaveBeenCalled())
    await vi.waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/guest/info'))

    expect(sessionStorage.getItem('guest_token')).toBe('tok-abc')
    expect(localStorage.getItem('guest_token')).toBeNull()
  })
})
