import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { Download, Link2, Check } from 'lucide-react'

/**
 * Detect platform for platform-specific save instructions.
 * @returns {'ios' | 'android' | 'desktop'}
 */
export function getSavePlatform() {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''
  if (/iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }
  if (/Android/.test(ua)) {
    return 'android'
  }
  return 'desktop'
}

export default function SavePageBlock() {
  const { t } = useLanguage()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installable, setInstallable] = useState(false)
  const [copied, setCopied] = useState(false)
  const [installOutcome, setInstallOutcome] = useState(null)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setInstallable(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    try {
      const { outcome } = await deferredPrompt.prompt()
      setInstallOutcome(outcome)
      if (outcome === 'accepted') {
        setInstallable(false)
        setDeferredPrompt(null)
      }
    } catch (err) {
      console.warn('PWA install prompt error:', err)
    }
  }

  const handleCopyLink = async () => {
    const url = window.location.href
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      }
    } catch {
      // fallback
    }
    // Fallback: select and copy
    try {
      const input = document.createElement('input')
      input.value = url
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const platform = getSavePlatform()
  const instructionsKey = `savePageInstructions_${platform}`

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-900">{t('savePageTitle')}</p>

      {installable && (
        <button
          type="button"
          onClick={handleInstall}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-white transition-all active:scale-[0.99]"
          style={{ background: 'linear-gradient(135deg, var(--wp-primary), var(--wp-secondary))' }}
        >
          <Download className="w-5 h-5" />
          {t('savePageInstall')}
        </button>
      )}

      {!installable && (
        <p className="text-sm text-gray-600">{t(instructionsKey) || t('savePageInstructions')}</p>
      )}

      <button
        type="button"
        onClick={handleCopyLink}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-gray-200 bg-white text-gray-900 font-medium hover:bg-gray-50 transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-5 h-5 text-green-600" />
            {t('savePageCopied')}
          </>
        ) : (
          <>
            <Link2 className="w-5 h-5" />
            {t('savePageCopyLink')}
          </>
        )}
      </button>
    </div>
  )
}
