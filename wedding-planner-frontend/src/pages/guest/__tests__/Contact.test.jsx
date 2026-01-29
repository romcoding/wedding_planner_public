import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../../../components/ui/Toast'
import Contact from '../Contact'
import api from '../../../lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: { retry: false },
  },
})

function renderWithProviders(ui) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {ui}
      </ToastProvider>
    </QueryClientProvider>
  )
}

// Mock api
vi.mock('../../../lib/api', () => ({
  default: {
    post: vi.fn(),
  },
}))

// Mock LanguageContext
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key) => ({
      contactTitle: 'Contact us',
      contactIntro: 'Send us a message',
      contactSubjectLabel: 'Subject',
      contactSubjectPlaceholder: 'Subject placeholder',
      contactMessageLabel: 'Message',
      contactMessagePlaceholder: 'Message placeholder',
      contactSendButton: 'Send',
      contactSending: 'Sending...',
      contactSentTitle: 'Message sent!',
      contactSendFailed: 'Failed to send',
      contactRetry: 'Retry',
    }[key] || key),
  }),
}))

// Mock Toast
const mockSuccess = vi.fn()
const mockError = vi.fn()
vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}))

describe('Contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submits form with correct payload and honeypot empty', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ data: { message: 'ok' } })

    renderWithProviders(<Contact />)

    await user.type(screen.getByPlaceholderText('Subject placeholder'), 'Test subject')
    await user.type(screen.getByPlaceholderText('Message placeholder'), 'Test body')
    await user.click(screen.getByRole('button', { name: /Send/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/messages', expect.objectContaining({
        subject: 'Test subject',
        body: 'Test body',
        idempotency_key: expect.stringMatching(/^msg_\d+_[a-z0-9]+$/),
        _hp: '',
      }))
    })
  })

  it('does not include honeypot value in payload when user does not fill it', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ data: { message: 'ok' } })

    renderWithProviders(<Contact />)
    await user.type(screen.getByPlaceholderText('Subject placeholder'), 'Sub')
    await user.type(screen.getByPlaceholderText('Message placeholder'), 'Body')
    await user.click(screen.getByRole('button', { name: /Send/i }))

    await waitFor(() => {
      const call = api.post.mock.calls[0]
      expect(call[1]._hp).toBe('')
    })
  })

  it('shows success message on successful submit', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ data: { message: 'ok' } })

    renderWithProviders(<Contact />)
    await user.type(screen.getByPlaceholderText('Subject placeholder'), 'Sub')
    await user.type(screen.getByPlaceholderText('Message placeholder'), 'Body')
    await user.click(screen.getByRole('button', { name: /Send/i }))

    await waitFor(() => {
      expect(screen.getByText('Message sent!')).toBeInTheDocument()
    })
    expect(mockSuccess).toHaveBeenCalled()
  })

  it('shows error and retry button on submit failure', async () => {
    const user = userEvent.setup()
    api.post.mockRejectedValue(new Error('Network error'))

    renderWithProviders(<Contact />)
    await user.type(screen.getByPlaceholderText('Subject placeholder'), 'Sub')
    await user.type(screen.getByPlaceholderText('Message placeholder'), 'Body')
    await user.click(screen.getByRole('button', { name: /Send/i }))

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
    expect(mockError).toHaveBeenCalled()
  })

  it('retries with same idempotency key when retry is clicked', async () => {
    const user = userEvent.setup()
    api.post.mockRejectedValueOnce(new Error('Fail')).mockResolvedValueOnce({ data: { message: 'ok' } })

    renderWithProviders(<Contact />)
    await user.type(screen.getByPlaceholderText('Subject placeholder'), 'Sub')
    await user.type(screen.getByPlaceholderText('Message placeholder'), 'Body')
    await user.click(screen.getByRole('button', { name: /Send/i }))

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    const firstKey = api.post.mock.calls[0][1].idempotency_key

    await user.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(2)
      expect(api.post.mock.calls[1][1].idempotency_key).toBe(firstKey)
    })
  })
})
