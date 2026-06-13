// Wedding-website content contract — FRONTEND mirror (UX layer).
//
// This is one half of a boundary defined twice, deliberately. The authoritative
// validator is the backend (wedding-planner-backend/src/services/site_schema.py):
// every save and publish re-validates there before anything is stored. These zod
// schemas + plain-JS constants exist so the editor can give instant, friendly
// feedback and keep the document canonical — they are NOT the security boundary.
//
// The website is a structured-content system: a fixed, ordered list of typed
// blocks rendered by themes. No freeform HTML — all strings are plain text and
// all URLs are https-only, mirroring the backend rules below.

import { z } from 'zod'

export const DOCUMENT_VERSION = 1
export const URL_MAX = 2000

// Theme keys (token objects live in ./themes). The backend validates the
// selected key; this list keeps the picker and validation in sync.
export const VALID_THEMES = ['classic', 'modern', 'botanical', 'midnight']
export const DEFAULT_THEME = 'classic'

// Fixed block order — the document always carries all of these, toggled on/off.
export const BLOCK_ORDER = [
  'hero', 'story', 'schedule', 'venue', 'rsvp',
  'registry', 'gallery', 'faq', 'footer',
]

export const BLOCK_LABELS = {
  hero: 'Hero',
  story: 'Our Story',
  schedule: 'Schedule',
  venue: 'Venue',
  rsvp: 'RSVP',
  registry: 'Registry',
  gallery: 'Gallery',
  faq: 'FAQ',
  footer: 'Footer',
}

export const BLOCK_HINTS = {
  hero: 'Names, date and a cover image — the first thing guests see.',
  story: 'How you met, the proposal, your story so far.',
  schedule: 'The order of the day: ceremony, dinner, dancing.',
  venue: 'Where it happens, with directions and a map link.',
  rsvp: 'Invite guests to respond, with a deadline.',
  registry: 'Links to your gift registries.',
  gallery: 'A handful of favourite photos.',
  faq: 'Answer the questions guests always ask.',
  footer: 'A closing note at the bottom of the page.',
}

// Which blocks are enabled in a freshly-seeded site (mirror of the backend).
export const DEFAULT_ENABLED = {
  hero: true,
  story: true,
  schedule: true,
  venue: true,
  rsvp: true,
  registry: false,
  gallery: false,
  faq: false,
  footer: true,
}

// --- Field-spec vocabulary (mirror of site_schema.py BLOCK_SPECS) -----------
const t = (max) => ({ kind: 'text', max })
const u = () => ({ kind: 'url', max: URL_MAX })
const b = () => ({ kind: 'bool' })
const ul = (cap) => ({ kind: 'urlList', cap })
const ol = (cap, item) => ({ kind: 'objList', cap, item })

export const BLOCK_SPECS = {
  hero: {
    coupleNames: t(200),
    tagline: t(300),
    date: t(100),
    heroImageUrl: u(),
    showCountdown: b(),
  },
  story: {
    title: t(200),
    body: t(2000),
    photos: ul(6),
  },
  schedule: {
    title: t(200),
    events: ol(12, {
      time: t(100),
      title: t(200),
      location: t(200),
      description: t(1000),
    }),
  },
  venue: {
    title: t(200),
    venueName: t(200),
    address: t(500),
    mapsUrl: u(),
    directions: t(2000),
  },
  rsvp: {
    title: t(200),
    deadline: t(100),
    note: t(1000),
  },
  registry: {
    title: t(200),
    note: t(1000),
    links: ol(8, { label: t(120), url: u() }),
  },
  gallery: {
    title: t(200),
    photos: ul(16),
  },
  faq: {
    title: t(200),
    items: ol(12, { q: t(300), a: t(2000) }),
  },
  footer: {
    note: t(500),
  },
}

// --- zod builders -----------------------------------------------------------
// Strip C0 control characters (keeping \n and \t) — mirror of the backend. The
// pattern is built from an escape string so this source file stays plain ASCII.
// eslint-disable-next-line no-control-regex
const CONTROL_RE = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g')
const cleanText = (v) =>
  typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(CONTROL_RE, '') : v

const zText = (max) =>
  z.string().transform(cleanText).pipe(z.string().max(max, `Max ${max} characters`))

const zUrl = () =>
  z
    .string()
    .transform((v) => cleanText(v).trim())
    .pipe(
      z
        .string()
        .refine((v) => v === '' || /^https:\/\/\S+$/i.test(v), 'Must be an https:// link')
        .refine((v) => v.length <= URL_MAX, `Max ${URL_MAX} characters`),
    )

function fieldToZod(spec) {
  switch (spec.kind) {
    case 'text':
      return zText(spec.max).optional()
    case 'url':
      return zUrl().optional()
    case 'bool':
      return z.boolean().optional()
    case 'urlList':
      return z.array(zUrl()).max(spec.cap, `Up to ${spec.cap} items`).optional()
    case 'objList': {
      const shape = {}
      for (const [key, sub] of Object.entries(spec.item)) shape[key] = fieldToZod(sub)
      return z.array(z.object(shape).strict()).max(spec.cap, `Up to ${spec.cap} items`).optional()
    }
    default:
      return z.any()
  }
}

// Per-block data schemas (strict: unknown keys rejected, mirroring the backend).
export const BLOCK_DATA_SCHEMAS = Object.fromEntries(
  Object.entries(BLOCK_SPECS).map(([type, fields]) => {
    const shape = {}
    for (const [key, spec] of Object.entries(fields)) shape[key] = fieldToZod(spec)
    return [type, z.object(shape).strict()]
  }),
)

export const blockSchema = z
  .object({
    type: z.enum(BLOCK_ORDER),
    enabled: z.boolean(),
    data: z.any(),
  })
  .strict()

export const documentSchema = z
  .object({
    version: z.literal(DOCUMENT_VERSION),
    blocks: z.array(blockSchema),
  })
  .strict()

// --- Plain-JS helpers (block order / defaults) ------------------------------

/** Empty data object for a block type — empty string / [] / false per field. */
export function emptyBlockData(type) {
  const out = {}
  for (const [key, spec] of Object.entries(BLOCK_SPECS[type] || {})) {
    out[key] =
      spec.kind === 'bool' ? false : spec.kind === 'urlList' || spec.kind === 'objList' ? [] : ''
  }
  return out
}

/** Validate a single block's data; returns a zod SafeParseResult. */
export function validateBlockData(type, data) {
  const schema = BLOCK_DATA_SCHEMAS[type]
  if (!schema) return { success: false, error: { issues: [{ message: 'Unknown block' }] } }
  return schema.safeParse(data)
}

/**
 * Normalize any document to canonical block order, filling missing blocks with
 * empty defaults. Mirrors the backend's normalization so the editor always has
 * all blocks to render, regardless of what the server returned.
 */
export function ensureDocument(doc) {
  const provided = {}
  const blocks = doc && Array.isArray(doc.blocks) ? doc.blocks : []
  for (const blk of blocks) {
    if (blk && BLOCK_SPECS[blk.type]) provided[blk.type] = blk
  }
  return {
    version: DOCUMENT_VERSION,
    blocks: BLOCK_ORDER.map((type) => {
      const blk = provided[type]
      return {
        type,
        enabled: typeof blk?.enabled === 'boolean' ? blk.enabled : DEFAULT_ENABLED[type],
        data: { ...emptyBlockData(type), ...(blk?.data || {}) },
      }
    }),
  }
}

/** Build a canonical starter document, seeded from wedding data. */
export function defaultDocument(wedding = {}) {
  const p1 = (wedding.partner_one_name || '').trim()
  const p2 = (wedding.partner_two_name || '').trim()
  const couple = [p1, p2].filter(Boolean).join(' & ') || 'Our Wedding'
  const doc = ensureDocument({ version: DOCUMENT_VERSION, blocks: [] })
  const hero = doc.blocks.find((blk) => blk.type === 'hero')
  hero.data.coupleNames = couple
  hero.data.tagline = "We're getting married!"
  hero.data.date = (wedding.wedding_date || '').trim()
  hero.data.showCountdown = true
  doc.blocks.find((blk) => blk.type === 'venue').data.address = (wedding.location || '').trim()
  doc.blocks.find((blk) => blk.type === 'footer').data.note = couple
  return doc
}
