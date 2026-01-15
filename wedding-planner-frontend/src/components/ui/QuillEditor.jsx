import { useEffect, useRef } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'

/**
 * React 19-safe Quill editor wrapper (does not use react-quill / findDOMNode).
 *
 * Controlled via `value` (HTML string) + `onChange(html)`.
 */
export default function QuillEditor({
  value,
  onChange,
  modules,
  placeholder,
  minHeight = 300,
}) {
  const containerRef = useRef(null)
  const quillRef = useRef(null)
  const lastHtmlRef = useRef(value ?? '')

  // Initialize Quill once.
  useEffect(() => {
    if (!containerRef.current || quillRef.current) return

    const quill = new Quill(containerRef.current, {
      theme: 'snow',
      modules: modules ?? {},
      placeholder,
    })

    quillRef.current = quill

    // Set initial content
    const initialHtml = value ?? ''
    if (initialHtml) {
      quill.clipboard.dangerouslyPasteHTML(initialHtml)
      lastHtmlRef.current = initialHtml
    }

    const handleTextChange = () => {
      const html = quill.root.innerHTML
      lastHtmlRef.current = html
      onChange?.(html)
    }

    quill.on('text-change', handleTextChange)

    return () => {
      quill.off('text-change', handleTextChange)
      quillRef.current = null
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep editor in sync when `value` changes externally (e.g. language tab switch / edit existing).
  useEffect(() => {
    const quill = quillRef.current
    if (!quill) return

    const nextHtml = value ?? ''
    const currentHtml = quill.root.innerHTML

    // Avoid clobbering the editor while the user is typing.
    // If caller sets same value, do nothing.
    if (nextHtml === currentHtml || nextHtml === lastHtmlRef.current) return

    const isFocused = document.activeElement && quill.root.contains(document.activeElement)
    if (isFocused) return

    quill.clipboard.dangerouslyPasteHTML(nextHtml)
    lastHtmlRef.current = nextHtml
  }, [value])

  return (
    <div
      ref={containerRef}
      style={{ minHeight }}
      className="bg-white text-gray-900"
    />
  )
}

