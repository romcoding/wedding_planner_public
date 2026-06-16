#!/usr/bin/env node
// Theme parity guard.
//
// shared/themes.json is the SINGLE SOURCE OF TRUTH for the wedding-website theme
// tokens. Two consumers mirror it and must never drift:
//   * the frontend renderer  — features/website/themes/tokens.js imports it,
//   * the Python server renderer — wedding-planner-backend/src/services/themes.py
//     embeds it verbatim (Pyodide can't reliably read a JSON file at runtime, so
//     the data is bundled as a .py module).
//
// This script verifies both mirrors. Run with `--write` to (re)generate the
// Python module from shared/themes.json. It is wired into the frontend `build`
// script (npm run check:themes) so drift fails the build.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const THEMES_JSON = resolve(ROOT, 'shared/themes.json')
const THEMES_PY = resolve(ROOT, 'wedding-planner-backend/src/services/themes.py')
const TOKENS_JS = resolve(ROOT, 'wedding-planner-frontend/src/features/website/themes/tokens.js')

const EXPECTED_KEYS = ['classic', 'modern', 'botanical', 'midnight']
const REQUIRED_TOKEN_FIELDS = ['key', 'label', 'mode', 'fonts', 'colors', 'spacing', 'divider', 'swatch']
const REQUIRED_COLORS = ['bg', 'surface', 'text', 'muted', 'primary', 'accent', 'border', 'heroOverlay', 'onHero']

const write = process.argv.includes('--write')
const errors = []

// --- Load + sanity-check the canonical JSON --------------------------------
const rawJson = readFileSync(THEMES_JSON, 'utf8')
let themes
try {
  themes = JSON.parse(rawJson)
} catch (e) {
  console.error(`check:themes — shared/themes.json is not valid JSON: ${e.message}`)
  process.exit(1)
}

for (const key of EXPECTED_KEYS) {
  const t = themes[key]
  if (!t) {
    errors.push(`shared/themes.json is missing theme "${key}"`)
    continue
  }
  for (const f of REQUIRED_TOKEN_FIELDS) {
    if (!(f in t)) errors.push(`theme "${key}" is missing field "${f}"`)
  }
  if (t.colors) {
    for (const c of REQUIRED_COLORS) {
      if (!(c in t.colors)) errors.push(`theme "${key}".colors is missing "${c}"`)
    }
  }
  if (t.key !== key) errors.push(`theme "${key}".key must equal "${key}" (got "${t.key}")`)
}
const extra = Object.keys(themes).filter((k) => !EXPECTED_KEYS.includes(k))
if (extra.length) errors.push(`shared/themes.json has unexpected theme(s): ${extra.join(', ')}`)

// --- Frontend mirror: tokens.js must source from the shared JSON -----------
const tokensSrc = readFileSync(TOKENS_JS, 'utf8')
if (!tokensSrc.includes('themes.json')) {
  errors.push('tokens.js no longer imports shared/themes.json — the frontend would drift from the source of truth')
}

// --- Backend mirror: themes.py embeds the canonical JSON verbatim ----------
function renderThemesPy(jsonText) {
  const body = jsonText.endsWith('\n') ? jsonText : jsonText + '\n'
  return (
    '"""Wedding-website theme tokens for the Python server renderer.\n' +
    '\n' +
    'AUTO-GENERATED from shared/themes.json — do NOT edit by hand. The frontend\n' +
    'renderer (features/website/themes/tokens.js) and this module are two mirrors\n' +
    'of that single source of truth; scripts/check-themes.mjs fails the build if\n' +
    'they drift. Regenerate with: npm run check:themes -- --write\n' +
    '\n' +
    'The data is embedded (not read from disk) because the Cloudflare Python\n' +
    'Workers/Pyodide runtime cannot reliably read a bundled JSON file at runtime.\n' +
    '"""\n' +
    'import json\n' +
    '\n' +
    'THEMES = json.loads(r"""\n' +
    body +
    '""")\n' +
    '\n' +
    'DEFAULT_THEME = "classic"\n' +
    '\n' +
    '\n' +
    'def get_theme(key):\n' +
    '    """Return the token object for *key*, falling back to the default theme."""\n' +
    '    return THEMES.get(key) or THEMES[DEFAULT_THEME]\n'
  )
}

const expectedPy = renderThemesPy(rawJson)
let actualPy = null
try {
  actualPy = readFileSync(THEMES_PY, 'utf8')
} catch {
  /* missing — will be reported/written below */
}

if (write) {
  if (errors.length) {
    console.error('check:themes — refusing to write while shared/themes.json has errors:')
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }
  if (actualPy !== expectedPy) {
    writeFileSync(THEMES_PY, expectedPy)
    console.log('check:themes — regenerated wedding-planner-backend/src/services/themes.py')
  } else {
    console.log('check:themes — themes.py already up to date')
  }
  process.exit(0)
}

if (actualPy === null) {
  errors.push('wedding-planner-backend/src/services/themes.py is missing — run: npm run check:themes -- --write')
} else if (actualPy !== expectedPy) {
  errors.push('themes.py is out of sync with shared/themes.json — run: npm run check:themes -- --write')
}

if (errors.length) {
  console.error('check:themes — FAILED:')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log('check:themes — OK (shared/themes.json ↔ tokens.js ↔ themes.py in sync)')
