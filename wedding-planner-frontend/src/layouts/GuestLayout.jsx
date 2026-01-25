import { Outlet } from 'react-router-dom'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function GuestLayout() {
  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(135deg, var(--wp-primary-soft), var(--wp-background), var(--wp-secondary-soft))`,
        color: 'var(--wp-text)',
      }}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>
        <Outlet />
      </div>
    </div>
  )
}

