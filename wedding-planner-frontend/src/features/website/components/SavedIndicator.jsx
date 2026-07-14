import { Check, Loader2, AlertCircle, Circle } from 'lucide-react'

// Subtle autosave status — never a modal or toast.
export default function SavedIndicator({ state }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Saving…
      </span>
    )
  }
  if (state === 'unsaved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
        <Circle className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
        Unsaved changes
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-500">
        <AlertCircle className="w-3.5 h-3.5" />
        Could not save
      </span>
    )
  }
  if (state === 'conflict') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-500 font-medium">
        <AlertCircle className="w-3.5 h-3.5" />
        This site was edited elsewhere — reload to continue
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
      <Check className="w-3.5 h-3.5 text-green-500" />
      Saved
    </span>
  )
}
