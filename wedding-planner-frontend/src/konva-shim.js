/**
 * Shim for konva - Konva is loaded via CDN script in moodboard.html.
 * Redirects ALL konva imports (including konva/lib/Core.js, konva/lib/Global.js)
 * to prevent bundling konva internals, which causes "Cannot access before initialization".
 */
const Konva = typeof window !== 'undefined' ? window.Konva : {}

// Default export (for: import Konva from 'konva/lib/Core.js')
export default Konva

// Named export (for: import { Konva } from 'konva/lib/Global.js')
export { Konva }
