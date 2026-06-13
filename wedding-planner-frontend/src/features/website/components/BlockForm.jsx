import { Plus, Trash2 } from 'lucide-react'
import { BLOCK_SPECS, BLOCK_LABELS, BLOCK_HINTS, validateBlockData } from '../siteSchema'

const FIELD_LABELS = {
  coupleNames: 'Couple names',
  tagline: 'Tagline',
  date: 'Date',
  heroImageUrl: 'Cover image URL',
  showCountdown: 'Show countdown',
  title: 'Title',
  body: 'Story',
  photos: 'Photos',
  events: 'Events',
  time: 'Time',
  location: 'Location',
  description: 'Description',
  venueName: 'Venue name',
  address: 'Address',
  mapsUrl: 'Map link',
  directions: 'Directions',
  deadline: 'RSVP deadline',
  note: 'Note',
  links: 'Registry links',
  label: 'Label',
  url: 'Link',
  items: 'Questions',
  q: 'Question',
  a: 'Answer',
}

function fieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}

const INPUT_CLASS =
  'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-rose-300'

function TextField({ id, label, value, onChange, max, multiline, error }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-500 mb-1">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={4}
          maxLength={max}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT_CLASS} resize-y`}
        />
      ) : (
        <input
          id={id}
          maxLength={max}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_CLASS}
        />
      )}
      {error ? <p className="text-xs text-red-500 mt-1">{error}</p> : null}
    </div>
  )
}

function UrlField({ id, label, value, onChange, error }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-500 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="url"
        inputMode="url"
        placeholder="https://…"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      />
      {error ? <p className="text-xs text-red-500 mt-1">{error}</p> : null}
    </div>
  )
}

function BoolField({ label, value, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!value}
      onClick={() => onChange(!value)}
      className="flex items-center justify-between gap-3 w-full py-1 text-left"
    >
      <span className="text-sm text-gray-700">{label}</span>
      <span
        aria-hidden
        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-rose-400' : 'bg-gray-200'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-4' : ''
          }`}
        />
      </span>
    </button>
  )
}

function ListHeader({ label, count, cap }) {
  return (
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className="text-[11px] text-gray-400">
        {count}/{cap}
      </span>
    </div>
  )
}

function UrlListField({ label, value, onChange, cap, error }) {
  const list = value || []
  const setAt = (i, v) => onChange(list.map((x, j) => (j === i ? v : x)))
  const removeAt = (i) => onChange(list.filter((_, j) => j !== i))
  return (
    <div>
      <ListHeader label={label} count={list.length} cap={cap} />
      <div className="space-y-2">
        {list.map((url, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="url"
              placeholder="https://…"
              value={url || ''}
              onChange={(e) => setAt(i, e.target.value)}
              className={INPUT_CLASS}
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label="Remove"
              className="px-2 text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      {list.length < cap ? (
        <button
          type="button"
          onClick={() => onChange([...list, ''])}
          className="mt-2 inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-700"
        >
          <Plus className="w-4 h-4" /> Add photo
        </button>
      ) : null}
      {error ? <p className="text-xs text-red-500 mt-1">{error}</p> : null}
    </div>
  )
}

function ObjListField({ label, value, onChange, cap, item, error }) {
  const list = value || []
  const blank = () => Object.fromEntries(Object.keys(item).map((k) => [k, '']))
  const setAt = (i, patch) => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const removeAt = (i) => onChange(list.filter((_, j) => j !== i))
  return (
    <div>
      <ListHeader label={label} count={list.length} cap={cap} />
      <div className="space-y-3">
        {list.map((entry, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-3 relative">
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label="Remove"
              className="absolute top-2 right-2 text-gray-300 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="space-y-2 pr-5">
              {Object.entries(item).map(([sub, subSpec]) =>
                subSpec.kind === 'url' ? (
                  <UrlField
                    key={sub}
                    id={`${label}-${i}-${sub}`}
                    label={fieldLabel(sub)}
                    value={entry[sub]}
                    onChange={(v) => setAt(i, { [sub]: v })}
                  />
                ) : (
                  <TextField
                    key={sub}
                    id={`${label}-${i}-${sub}`}
                    label={fieldLabel(sub)}
                    value={entry[sub]}
                    onChange={(v) => setAt(i, { [sub]: v })}
                    max={subSpec.max}
                    multiline={subSpec.max >= 500}
                  />
                ),
              )}
            </div>
          </div>
        ))}
      </div>
      {list.length < cap ? (
        <button
          type="button"
          onClick={() => onChange([...list, blank()])}
          className="mt-2 inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-700"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      ) : null}
      {error ? <p className="text-xs text-red-500 mt-1">{error}</p> : null}
    </div>
  )
}

// Per-block form, generated from the shared field spec (no raw JSON in the UI).
export default function BlockForm({ block, onChange }) {
  const spec = BLOCK_SPECS[block.type]
  const data = block.data || {}
  const set = (field, value) => onChange({ [field]: value })

  // Live zod feedback (UX only — the backend is authoritative).
  const parsed = validateBlockData(block.type, data)
  const errors = {}
  if (!parsed.success && parsed.error && parsed.error.issues) {
    for (const issue of parsed.error.issues) {
      const key = issue.path && issue.path.length ? issue.path[0] : '_'
      if (!errors[key]) errors[key] = issue.message
    }
  }

  if (!spec) return null

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">{BLOCK_LABELS[block.type]}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{BLOCK_HINTS[block.type]}</p>
      </div>
      {Object.entries(spec).map(([field, fspec]) => {
        const id = `f-${block.type}-${field}`
        const label = fieldLabel(field)
        if (fspec.kind === 'text') {
          return (
            <TextField
              key={field}
              id={id}
              label={label}
              value={data[field]}
              onChange={(v) => set(field, v)}
              max={fspec.max}
              multiline={fspec.max >= 500}
              error={errors[field]}
            />
          )
        }
        if (fspec.kind === 'url') {
          return (
            <UrlField key={field} id={id} label={label} value={data[field]} onChange={(v) => set(field, v)} error={errors[field]} />
          )
        }
        if (fspec.kind === 'bool') {
          return <BoolField key={field} label={label} value={data[field]} onChange={(v) => set(field, v)} />
        }
        if (fspec.kind === 'urlList') {
          return (
            <UrlListField key={field} label={label} value={data[field]} onChange={(v) => set(field, v)} cap={fspec.cap} error={errors[field]} />
          )
        }
        if (fspec.kind === 'objList') {
          return (
            <ObjListField key={field} label={label} value={data[field]} onChange={(v) => set(field, v)} cap={fspec.cap} item={fspec.item} error={errors[field]} />
          )
        }
        return null
      })}
    </div>
  )
}
