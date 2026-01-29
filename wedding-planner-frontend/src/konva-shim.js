/**
 * Shim for konva - Konva is loaded via CDN script in moodboard.html.
 * This prevents konva from being bundled (which causes "Cannot access before initialization").
 * react-konva imports from 'konva'; with resolve.alias we redirect to this shim.
 */
export default typeof window !== 'undefined' ? window.Konva : {}
export const Konva = typeof window !== 'undefined' ? window.Konva : {}
