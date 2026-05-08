// Reusable empty-state for list pages. Encourages a clear next step by surfacing
// one or more action buttons. Pass an icon component (e.g. lucide-react) via `icon`.
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actions = [],
  className = '',
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow p-10 text-center ${className}`}
      role="status"
    >
      {Icon && (
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
          <Icon className="w-7 h-7" aria-hidden="true" />
        </div>
      )}
      {title && (
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      )}
      {description && (
        <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
          {description}
        </p>
      )}
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actions.map((action, index) => {
            const {
              label,
              onClick,
              variant = index === 0 ? 'primary' : 'secondary',
              icon: ActionIcon,
              ariaLabel,
              type = 'button',
              disabled,
            } = action
            const styles =
              variant === 'primary'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            return (
              <button
                key={`${label}-${index}`}
                type={type}
                onClick={onClick}
                disabled={disabled}
                aria-label={ariaLabel || label}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles}`}
              >
                {ActionIcon && <ActionIcon className="w-4 h-4" aria-hidden="true" />}
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
