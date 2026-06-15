// Pure site renderer: given ({ content, theme }) it renders the enabled blocks
// using the shared block components + theme tokens. No state, no fetching — the
// P4 Python server renderer mirrors exactly this from shared/themes.json.

import { ensureDocument } from '../siteSchema'
import { getTheme } from './tokens'
import { BLOCK_COMPONENTS } from './blocks'

export default function SiteRenderer({ content, theme }) {
  const tokens = getTheme(theme)
  const doc = ensureDocument(content)
  return (
    <div
      style={{
        background: tokens.colors.bg,
        color: tokens.colors.text,
        fontFamily: tokens.fonts.body,
        minHeight: '100%',
      }}
    >
      {doc.blocks
        .filter((block) => block.enabled)
        .map((block) => {
          const Component = BLOCK_COMPONENTS[block.type]
          return Component ? <Component key={block.type} data={block.data} tokens={tokens} /> : null
        })}
    </div>
  )
}
