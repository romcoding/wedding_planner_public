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

    const hexToRgba = (hex, a) => {
      const h = (hex || '').trim()
      const v = h.startsWith('#') ? h.slice(1) : h
      if (!/^[0-9a-fA-F]{6}$/.test(v)) return `rgba(0,0,0,${a})`
      const r = parseInt(v.slice(0, 2), 16)
      const g = parseInt(v.slice(2, 4), 16)
      const b = parseInt(v.slice(4, 6), 16)
      return `rgba(${r}, ${g}, ${b}, ${a})`
    }

    const root = document.documentElement
    const primary = read('theme_primary', '#EC4899') // pink-500
    const secondary = read('theme_secondary', '#7C3AED') // violet-600
    const accent = read('theme_accent', '#111827') // gray-900
    const background = read('theme_background', '#FFFFFF')
    const text = read('theme_text', '#111827')

    root.style.setProperty('--wp-primary', primary)
    root.style.setProperty('--wp-secondary', secondary)
    root.style.setProperty('--wp-accent', accent)
    root.style.setProperty('--wp-background', background)
    root.style.setProperty('--wp-text', text)

    // Soft variants (avoid relying on color-mix support)
    root.style.setProperty('--wp-primary-soft', hexToRgba(primary, 0.10))
    root.style.setProperty('--wp-secondary-soft', hexToRgba(secondary, 0.10))
  }, [t])

  return (
    <div
      className="guest-theme min-h-screen"
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

