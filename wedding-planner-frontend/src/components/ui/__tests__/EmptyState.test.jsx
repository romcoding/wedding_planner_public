import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Users, Plus } from 'lucide-react'
import EmptyState from '../EmptyState'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        icon={Users}
        title="No guests yet"
        description="Add a guest to get started"
      />,
    )
    expect(screen.getByText('No guests yet')).toBeInTheDocument()
    expect(screen.getByText('Add a guest to get started')).toBeInTheDocument()
  })

  it('invokes the action callback when the button is clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <EmptyState
        icon={Users}
        title="No guests yet"
        actions={[{ label: 'Add Guest', icon: Plus, onClick }]}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Add Guest' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders multiple actions side by side', () => {
    render(
      <EmptyState
        title="Empty"
        actions={[
          { label: 'Primary', onClick: () => {} },
          { label: 'Secondary', onClick: () => {} },
        ]}
      />,
    )
    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Secondary' })).toBeInTheDocument()
  })
})
