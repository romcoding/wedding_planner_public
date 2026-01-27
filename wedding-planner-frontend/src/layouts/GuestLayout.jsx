import { Outlet } from 'react-router-dom'

export default function GuestLayout() {
  return (
    <div className="min-h-screen" style={{ color: 'var(--wp-text)' }}>
      <Outlet />
    </div>
  )
}

