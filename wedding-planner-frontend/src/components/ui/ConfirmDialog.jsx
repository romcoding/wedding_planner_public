import React from 'react'
import { AlertTriangle, X } from 'lucide-react'

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'danger' }) => {
  if (!isOpen) return null

  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
    info: 'bg-blue-600 hover:bg-blue-700',
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-start">
            <div className={`flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${
              variant === 'danger' ? 'bg-red-100' : variant === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'
            }`}>
              <AlertTriangle className={`h-6 w-6 ${
                variant === 'danger' ? 'text-red-600' : variant === 'warning' ? 'text-yellow-600' : 'text-blue-600'
              }`} />
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-medium text-gray-900">{title}</h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">{message}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="ml-4 text-gray-400 hover:text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm()
                onClose()
              }}
              className={`px-4 py-2 rounded-lg text-white transition-colors ${variantStyles[variant]}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
