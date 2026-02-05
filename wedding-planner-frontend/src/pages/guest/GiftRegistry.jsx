import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import { Gift, ExternalLink, DollarSign, Sparkles } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function GiftRegistry({ hideEmptyState = false }) {
  const { t } = useLanguage()
  const BASE_CURRENCY = 'CHF'
  const formatMoney = (amount, currency = BASE_CURRENCY) => {
    const n = Number(amount || 0)
    try {
      return new Intl.NumberFormat('de-CH', {
        style: 'currency',
        currency,
        currencyDisplay: 'code',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number.isFinite(n) ? n : 0)
    } catch {
      const safe = Number.isFinite(n) ? n : 0
      return `${currency} ${Math.round(safe)}`
    }
  }

  const { data: registryItems, isLoading } = useQuery({
    queryKey: ['gift-registry'],
    queryFn: () => api.get('/gift-registry').then((res) => res.data),
  })

  if (isLoading) {
    return <div className="text-center py-8">{t('giftRegistryLoading')}</div>
  }

  const getIcon = (type) => {
    switch (type) {
      case 'external_link':
        return <ExternalLink className="w-6 h-6" />
      case 'cash_fund':
        return <DollarSign className="w-6 h-6" />
      case 'experience':
        return <Sparkles className="w-6 h-6" />
      default:
        return <Gift className="w-6 h-6" />
    }
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'external_link':
        return t('giftRegistryTypeExternal')
      case 'cash_fund':
        return t('giftRegistryTypeCash')
      case 'experience':
        return t('giftRegistryTypeExperience')
      default:
        return t('giftRegistryTypeDefault')
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {registryItems && registryItems.length > 0 ? (
          registryItems.map((item) => (
            <div key={item.id} className="bg-white/60 rounded-lg border border-black/5 p-6 hover:bg-white/80 transition-all">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--wp-primary) 15%, white)', color: 'var(--wp-primary)' }}>
                  {getIcon(item.registry_type)}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--wp-primary)' }}>{item.name}</h3>
                  <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--wp-primary) 15%, white)', color: 'var(--wp-primary)' }}>
                    {getTypeLabel(item.registry_type)}
                  </span>
                </div>
              </div>

              {item.description && (
                <p className="mb-4" style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>{item.description}</p>
              )}

              {item.registry_type === 'external_link' && item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
                  style={{ backgroundColor: 'var(--wp-primary)' }}
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('giftRegistryVisit')}
                </a>
              )}

              {item.registry_type === 'cash_fund' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1" style={{ color: 'var(--wp-primary)', opacity: 0.8 }}>
                      <span>{t('giftRegistryProgress')}</span>
                      <span>
                        {formatMoney(item.current_amount || 0)} / {formatMoney(item.target_amount || 0)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          backgroundColor: 'var(--wp-primary)',
                          width: `${item.target_amount ? (item.current_amount / item.target_amount) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    {t('giftRegistryCashHint')}
                  </p>
                </div>
              )}

              {item.registry_type === 'experience' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>{t('giftRegistryProgress')}</span>
                      <span>
                        {formatMoney(item.current_amount || 0)} / {formatMoney(item.target_amount || 0)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${item.target_amount ? (item.current_amount / item.target_amount) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    {t('giftRegistryExperienceHint')}
                  </p>
                </div>
              )}
            </div>
          ))
        ) : !hideEmptyState ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Gift className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p>{t('giftRegistryEmpty')}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

