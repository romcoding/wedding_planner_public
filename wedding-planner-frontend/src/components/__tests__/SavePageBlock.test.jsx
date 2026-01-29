import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SavePageBlock, { getSavePlatform } from '../SavePageBlock'

// Mock LanguageContext
const mockT = (key) => key
vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT }),
}))

describe('getSavePlatform', () => {
  it('returns ios for iPhone user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      configurable: true,
    })
    expect(getSavePlatform()).toBe('ios')
  })

  it('returns android for Android user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10)',
      configurable: true,
    })
    expect(getSavePlatform()).toBe('android')
  })

  it('returns desktop for desktop user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    })
    expect(getSavePlatform()).toBe('desktop')
  })
})

describe('SavePageBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    })
  })

  it('renders save page title and copy link button', () => {
    render(<SavePageBlock />)
    expect(screen.getByText('savePageTitle')).toBeInTheDocument()
    expect(screen.getByText('savePageCopyLink')).toBeInTheDocument()
  })

  it('shows Copied! when copy link is clicked and clipboard succeeds', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText },
    })

    render(<SavePageBlock />)
    const copyBtn = screen.getByText('savePageCopyLink')
    await user.click(copyBtn)

    expect(writeText).toHaveBeenCalledWith(window.location.href)
    expect(screen.getByText('savePageCopied')).toBeInTheDocument()
  })

  it('uses fallback when clipboard writeText is not available', async () => {
    const user = userEvent.setup()
    const execCommand = vi.fn().mockReturnValue(true)
    const originalExec = document.execCommand
    document.execCommand = execCommand
    // clipboard without writeText triggers fallback
    Object.defineProperty(navigator, 'clipboard', {
      value: {},
      configurable: true,
    })

    render(<SavePageBlock />)
    const copyBtn = screen.getByText('savePageCopyLink')
    await user.click(copyBtn)

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(screen.getByText('savePageCopied')).toBeInTheDocument()

    document.execCommand = originalExec
  })
})
