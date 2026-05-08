import { useId } from 'react'
import { localeDatePlaceholder, localeDateTimePlaceholder } from '../../utils/locale'

// Locale-aware date / datetime input. The native input uses the browser locale
// to render the picker, so European users get dd.mm.yyyy and 24-hour time
// automatically. We expose value as a YYYY-MM-DD or YYYY-MM-DDTHH:mm string
// (ISO 8601) so the backend stays locale-agnostic.

export default function DateInput({
  value,
  onChange,
  withTime = false,
  required = false,
  className = '',
  ariaLabel,
  helperText,
  showFormatHint = true,
  ...rest
}) {
  const id = useId()
  const placeholder = withTime ? localeDateTimePlaceholder() : localeDatePlaceholder()
  const baseClass =
    'w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900'

  return (
    <div className="space-y-1">
      <input
        id={id}
        type={withTime ? 'datetime-local' : 'date'}
        value={value || ''}
        onChange={(event) => onChange?.(event.target.value, event)}
        required={required}
        aria-label={ariaLabel}
        aria-describedby={showFormatHint ? `${id}-hint` : undefined}
        className={`${baseClass} ${className}`}
        {...rest}
      />
      {(showFormatHint || helperText) && (
        <p id={`${id}-hint`} className="text-xs text-gray-500">
          {helperText || `Format: ${placeholder}`}
        </p>
      )}
    </div>
  )
}
