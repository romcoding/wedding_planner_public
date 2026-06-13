import { THEME_LIST } from '../themes/tokens'

// Visual theme swatches. Each theme is shown as its 3 signature colours.
export default function ThemePicker({ value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {THEME_LIST.map((theme) => {
        const active = value === theme.key
        return (
          <button
            key={theme.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(theme.key)}
            title={theme.label}
            className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${
              active ? 'border-rose-400 ring-2 ring-rose-200' : 'border-gray-200 hover:border-gray-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="flex overflow-hidden rounded">
              {theme.swatch.map((color, i) => (
                <span
                  key={i}
                  style={{ background: color }}
                  className="block h-6 w-4 border border-black/5"
                />
              ))}
            </span>
            <span className={`text-[11px] ${active ? 'font-medium text-rose-700' : 'text-gray-600'}`}>
              {theme.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
