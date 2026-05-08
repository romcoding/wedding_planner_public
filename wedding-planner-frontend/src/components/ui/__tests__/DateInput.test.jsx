import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DateInput from '../DateInput'

describe('DateInput', () => {
  it('uses native date input by default and exposes ISO value through onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateInput value="" onChange={onChange} ariaLabel="Wedding date" />)

    const input = screen.getByLabelText('Wedding date')
    expect(input).toHaveAttribute('type', 'date')

    await user.type(input, '2026-08-15')
    expect(onChange).toHaveBeenCalled()
    const lastValue = onChange.mock.calls.at(-1)[0]
    expect(lastValue).toBe('2026-08-15')
  })

  it('switches to datetime-local when withTime is true', () => {
    render(<DateInput withTime value="" onChange={() => {}} ariaLabel="Reminder time" />)
    const input = screen.getByLabelText('Reminder time')
    expect(input).toHaveAttribute('type', 'datetime-local')
  })

  it('shows the locale format hint by default', () => {
    render(<DateInput value="" onChange={() => {}} ariaLabel="Test" />)
    expect(screen.getByText(/Format:/)).toBeInTheDocument()
  })

  it('uses custom helperText when provided', () => {
    render(
      <DateInput
        value=""
        onChange={() => {}}
        ariaLabel="Test"
        helperText="Pick the day everyone arrives."
      />,
    )
    expect(screen.getByText('Pick the day everyone arrives.')).toBeInTheDocument()
  })
})
