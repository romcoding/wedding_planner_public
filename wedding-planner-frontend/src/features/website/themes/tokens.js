// Theme tokens for the wedding-website builder.
//
// shared/themes.json (repo root) is the SINGLE SOURCE OF TRUTH for these tokens.
// We import it here so the editor + React renderer and the Python server
// renderer (wedding-planner-backend/src/services/themes.py, which embeds the
// same JSON) can never drift — scripts/check-themes.mjs fails the build if they
// do. Each theme is PLAIN DATA (fonts, colors, spacing, divider, swatch); ONE
// set of block components (./blocks.jsx) reads these tokens — there is not a
// component tree per theme.

import THEMES_DATA from '@shared/themes.json'

export const THEMES = THEMES_DATA

export const DEFAULT_THEME = 'classic'

// Ordered list for the picker.
export const THEME_LIST = [
  THEMES.classic,
  THEMES.modern,
  THEMES.botanical,
  THEMES.midnight,
]

export function getTheme(key) {
  return THEMES[key] || THEMES[DEFAULT_THEME]
}
