import { Eye, EyeOff } from 'lucide-react'
import { BLOCK_LABELS } from '../siteSchema'

// Left-panel list of the fixed blocks: toggle visibility + select for editing.
export default function BlockList({ blocks, selected, onSelect, onToggle }) {
  return (
    <div className="space-y-0.5">
      {blocks.map((block) => {
        const isSelected = selected === block.type
        return (
          <div
            key={block.type}
            className={`flex items-center gap-1 rounded-lg px-1.5 py-1.5 ${
              isSelected ? 'bg-rose-50' : 'hover:bg-gray-50'
            }`}
          >
            <button
              type="button"
              onClick={() => onToggle(block.type, !block.enabled)}
              title={block.enabled ? 'Hide this section' : 'Show this section'}
              className="p-1 text-gray-400 hover:text-gray-700"
            >
              {block.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => onSelect(block.type)}
              className={`flex-1 text-left text-sm py-0.5 ${
                block.enabled ? 'text-gray-800' : 'text-gray-400'
              } ${isSelected ? 'font-medium text-rose-700' : ''}`}
            >
              {BLOCK_LABELS[block.type] || block.type}
            </button>
          </div>
        )
      })}
    </div>
  )
}
