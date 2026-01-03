import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import { Gift, ExternalLink, DollarSign, Sparkles } from 'lucide-react'

export default function GiftRegistry() {
  const { data: registryItems, isLoading } = useQuery({
    queryKey: ['gift-registry'],
    queryFn: () => api.get('/gift-registry').then((res) => res.data),
  })

  if (isLoading) {
    return <div className="text-center py-8">Loading registry...</div>
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
        return 'Registry Link'
      case 'cash_fund':
        return 'Cash Fund'
      case 'experience':
        return 'Experience Fund'
      default:
        return 'Gift'
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Gift Registry</h2>
      <p className="text-gray-600 mb-8">
        Your presence at our wedding is the greatest gift of all. However, if you wish to honor us with a gift, 
        we have registered at the following places:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {registryItems && registryItems.length > 0 ? (
          registryItems.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-pink-100 rounded-lg text-pink-600">
                  {getIcon(item.registry_type)}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{item.name}</h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {getTypeLabel(item.registry_type)}
                  </span>
                </div>
              </div>

              {item.description && (
                <p className="text-gray-600 mb-4">{item.description}</p>
              )}

              {item.registry_type === 'external_link' && item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Visit Registry
                </a>
              )}

              {item.registry_type === 'cash_fund' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>
                        ${item.current_amount?.toFixed(2) || '0.00'} / ${item.target_amount?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-pink-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${item.target_amount ? (item.current_amount / item.target_amount) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Contributions can be made through the link provided by the couple.
                  </p>
                </div>
              )}

              {item.registry_type === 'experience' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>
                        ${item.current_amount?.toFixed(2) || '0.00'} / ${item.target_amount?.toFixed(2) || '0.00'}
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
                    Help us create unforgettable memories!
                  </p>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Gift className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p>No registry items available yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}

