import { useLanguage } from '../contexts/LanguageContext'
import { Globe } from 'lucide-react'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
  ]

  return (
    <div className="relative inline-block">
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="appearance-none rounded-lg px-4 py-2 pr-10 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-opacity-50"
        style={{ 
          backgroundColor: 'var(--wp-background)', 
          borderColor: 'var(--wp-primary-20)',
          color: 'var(--wp-primary)',
          borderWidth: '1px',
          borderStyle: 'solid'
        }}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
      <Globe className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--wp-primary)', opacity: 0.5 }} />
    </div>
  )
}

