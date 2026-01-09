import React from 'react'
import { AlertCircle, X } from 'lucide-react'

const ErrorMessage = ({ message, onDismiss, className = '' }) => {
  if (!message) return null

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 flex items-start ${className}`}>
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="ml-3 flex-1">
        <p className="text-sm text-red-800">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-4 text-red-400 hover:text-red-600"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

export default ErrorMessage
