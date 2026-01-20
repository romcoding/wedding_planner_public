import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useLanguage } from '../contexts/LanguageContext'

export default function GuestLayout() {
  const { t } = useLanguage()

  useEffect(() => {
    const read = (key, fallback) => {
      const v = t(key)
      return v && v !== key ? v : fallback
    }

    const root = document.documentElement
    root.style.setProperty('--wp-primary', read('theme_primary', '#EC4899')) // pink-500
    root.style.setProperty('--wp-secondary', read('theme_secondary', '#7C3AED')) // violet-600
    root.style.setProperty('--wp-accent', read('theme_accent', '#111827')) // gray-900
    root.style.setProperty('--wp-background', read('theme_background', '#FFFFFF'))
    root.style.setProperty('--wp-text', read('theme_text', '#111827'))
  }, [t])

  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, var(--wp-primary) 10%, white), var(--wp-background), color-mix(in srgb, var(--wp-secondary) 10%, white))`,
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

