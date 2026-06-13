// Theme tokens for the wedding-website builder.
//
// Each theme is a PLAIN DATA object (fonts, colors, spacing, divider, swatch) —
// deliberately no functions inside, so a future phase (P4) can serialize these
// straight to shared/themes.json for the Python server renderer to consume.
// ONE set of block components (./blocks.jsx) reads these tokens; there is not a
// component tree per theme.

export const THEMES = {
  classic: {
    key: 'classic',
    label: 'Classic',
    mode: 'light',
    fonts: {
      heading: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
      body: "Georgia, 'Times New Roman', serif",
    },
    colors: {
      bg: '#FBF8F2',
      surface: '#FFFFFF',
      text: '#33312E',
      muted: '#7A756C',
      primary: '#6E5C43',
      accent: '#B08D57',
      border: '#E8E1D5',
      heroOverlay: 'rgba(28, 24, 18, 0.38)',
      onHero: '#FFFFFF',
    },
    spacing: { section: '72px', blockGap: '22px', radius: '4px', maxWidth: '720px' },
    divider: { style: 'rule', color: '#D9C7AE' },
    swatch: ['#FBF8F2', '#B08D57', '#33312E'],
  },
  modern: {
    key: 'modern',
    label: 'Modern',
    mode: 'light',
    fonts: {
      heading: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
      body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    },
    colors: {
      bg: '#FAFAF8',
      surface: '#FFFFFF',
      text: '#16161A',
      muted: '#6B7280',
      primary: '#111827',
      accent: '#374151',
      border: '#E5E7EB',
      heroOverlay: 'rgba(17, 24, 39, 0.42)',
      onHero: '#FFFFFF',
    },
    spacing: { section: '80px', blockGap: '28px', radius: '12px', maxWidth: '760px' },
    divider: { style: 'plain', color: '#E5E7EB' },
    swatch: ['#FAFAF8', '#111827', '#6B7280'],
  },
  botanical: {
    key: 'botanical',
    label: 'Botanical',
    mode: 'light',
    fonts: {
      heading: "'Cormorant Garamond', Georgia, serif",
      body: "'Nunito Sans', system-ui, -apple-system, sans-serif",
    },
    colors: {
      bg: '#F3F6F1',
      surface: '#FFFFFF',
      text: '#2F3A2E',
      muted: '#6E7A66',
      primary: '#5A7A52',
      accent: '#88A271',
      border: '#DCE6D3',
      heroOverlay: 'rgba(34, 46, 31, 0.34)',
      onHero: '#FFFFFF',
    },
    spacing: { section: '72px', blockGap: '24px', radius: '16px', maxWidth: '720px' },
    divider: { style: 'leaf', color: '#88A271' },
    swatch: ['#F3F6F1', '#5A7A52', '#88A271'],
  },
  midnight: {
    key: 'midnight',
    label: 'Midnight',
    mode: 'dark',
    fonts: {
      heading: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
      body: "'Inter', system-ui, -apple-system, sans-serif",
    },
    colors: {
      bg: '#0E1730',
      surface: '#15203D',
      text: '#EAE7DF',
      muted: '#A9B2C7',
      primary: '#C9A227',
      accent: '#E6C757',
      border: '#243355',
      heroOverlay: 'rgba(6, 11, 26, 0.55)',
      onHero: '#F4EFDF',
    },
    spacing: { section: '80px', blockGap: '26px', radius: '8px', maxWidth: '740px' },
    divider: { style: 'rule', color: '#C9A227' },
    swatch: ['#0E1730', '#C9A227', '#EAE7DF'],
  },
}

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
