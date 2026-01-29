import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { useToast } from '../../components/ui/Toast'
import {
  Hand,
  MousePointer2,
  ImagePlus,
  Square,
  Circle as CircleIcon,
  Type,
  Grid3x3,
  Minus,
  Plus,
  Download,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Save,
  PlusCircle,
  Pencil,
  X,
} from 'lucide-react'

// Dynamically import react-konva to avoid SSR/initialization issues
let Stage, Layer, Rect, Circle, Line, Text, KonvaImage, Transformer
const loadKonva = async () => {
  const konva = await import('react-konva')
  Stage = konva.Stage
  Layer = konva.Layer
  Rect = konva.Rect
  Circle = konva.Circle
  Line = konva.Line
  Text = konva.Text
  KonvaImage = konva.Image
  Transformer = konva.Transformer
  return true
}

const CANVAS_W = 3000
const CANVAS_H = 2000
const GRID_SIZE = 40

function uid(prefix = 'obj') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function parseHexColor(hex) {
  const raw = (hex || '').trim()
  if (!raw) return null
  const v = raw.startsWith('#') ? raw.slice(1) : raw
  if (![3, 6].includes(v.length)) return null
  if (!/^[0-9a-fA-F]+$/.test(v)) return null
  if (v.length === 3) {
    const r = v[0] + v[0]
    const g = v[1] + v[1]
    const b = v[2] + v[2]
    return `#${r}${g}${b}`.toUpperCase()
  }
  return `#${v}`.toUpperCase()
}

function rgbToHex(r, g, b) {
  const to2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase()
}

function hexToRgb(hex) {
  const h = parseHexColor(hex)
  if (!h) return null
  const v = h.slice(1)
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return { r, g, b }
}

function defaultBoardContent() {
  return {
    version: 1,
    stage: { x: 40, y: 40, scale: 0.4 },
    grid: { enabled: true, size: GRID_SIZE, snap: false },
    palette: [],
    objects: [],
  }
}

function useHtmlImage(src) {
  const [image, setImage] = useState(null)
  useEffect(() => {
    if (!src) {
      setImage(null)
      return
    }
    const img = new window.Image()
    img.onload = () => setImage(img)
    img.onerror = () => setImage(null)
    img.src = src
  }, [src])
  return image
}

function MoodboardImageNode({ o, tool, onSelect, onDragEnd, onTransformEnd }) {
  const { data: img } = useQuery({
    queryKey: ['image', o.imageId],
    queryFn: () => api.get(`/images/${o.imageId}`).then((r) => r.data),
    enabled: !!o.imageId,
    staleTime: 1000 * 60 * 10,
  })
  const imageUrl = img?.url || null
  const image = useHtmlImage(imageUrl)
  return (
    <KonvaImage
      id={o.id}
      x={o.x}
      y={o.y}
      width={o.width}
      height={o.height}
      image={image}
      opacity={o.opacity ?? 1}
      rotation={o.rotation || 0}
      draggable={tool === 'select'}
      onMouseDown={(e) => onSelect(o.id, e)}
      onTouchStart={(e) => onSelect(o.id, e)}
      onTap={(e) => onSelect(o.id, e)}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    />
  )
}

function ColorControl({ label, value, onChange, allowAlpha = false, alphaValue = 1, onAlphaChange }) {
  const rgb = hexToRgb(value) || { r: 0, g: 0, b: 0 }
  const [hexDraft, setHexDraft] = useState(value || '#000000')

  useEffect(() => {
    setHexDraft(value || '#000000')
  }, [value])

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-700">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={parseHexColor(value) || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 rounded border border-gray-200 bg-white"
        />
        <input
          type="text"
          value={hexDraft}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={() => {
            const parsed = parseHexColor(hexDraft)
            if (parsed) onChange(parsed)
            else setHexDraft(value || '#000000')
          }}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
          placeholder="#RRGGBB"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-[11px] text-gray-600">R</div>
          <input
            type="range"
            min="0"
            max="255"
            value={rgb.r}
            onChange={(e) => onChange(rgbToHex(parseInt(e.target.value), rgb.g, rgb.b))}
            className="w-full"
          />
        </div>
        <div>
          <div className="text-[11px] text-gray-600">G</div>
          <input
            type="range"
            min="0"
            max="255"
            value={rgb.g}
            onChange={(e) => onChange(rgbToHex(rgb.r, parseInt(e.target.value), rgb.b))}
            className="w-full"
          />
        </div>
        <div>
          <div className="text-[11px] text-gray-600">B</div>
          <input
            type="range"
            min="0"
            max="255"
            value={rgb.b}
            onChange={(e) => onChange(rgbToHex(rgb.r, rgb.g, parseInt(e.target.value)))}
            className="w-full"
          />
        </div>
      </div>
      {allowAlpha && (
        <div>
          <div className="text-[11px] text-gray-600">Opacity</div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={alphaValue ?? 1}
            onChange={(e) => onAlphaChange?.(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      )}
    </div>
  )
}

function IconButton({ title, onClick, active, children, disabled, className = '' }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        'h-10 w-10 rounded-lg border flex items-center justify-center transition-colors',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50',
        active ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default function MoodboardPage() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const stageRef = useRef(null)
  const containerRef = useRef(null)
  const transformerRef = useRef(null)
  const fileInputRef = useRef(null)
  const pasteInputRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const longPressStartRef = useRef(null) // { x, y }

  const didBootstrapRef = useRef(false)
  const gestureRef = useRef({ isPinching: false, startDist: 0, startScale: 1, startCenter: null, startPos: null })

  const [viewport, setViewport] = useState({ w: 900, h: 600 })

  const [activeTool, setActiveTool] = useState('select') // select | pan | rect | circle | line | text
  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const [keepRatio, setKeepRatio] = useState(true)
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false)
  const [textEditor, setTextEditor] = useState({ open: false, id: null, value: '' })
  const [pastePrompt, setPastePrompt] = useState({ open: false, pos: null })
  const [pasteMenu, setPasteMenu] = useState({ open: false, localX: 0, localY: 0, pos: null })

  const [boardId, setBoardId] = useState(null)
  const [boardTitleDraft, setBoardTitleDraft] = useState('')
  const [showRename, setShowRename] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [content, setContent] = useState(defaultBoardContent)
  const [selectedIds, setSelectedIds] = useState([])

  const [drawingLine, setDrawingLine] = useState(null) // { id, points: [] } preview

  const [history, setHistory] = useState({ past: [], future: [] })
  const [isMounted, setIsMounted] = useState(false)
  const [konvaLoaded, setKonvaLoaded] = useState(false)

  // Load react-konva dynamically to prevent initialization issues in production builds
  useEffect(() => {
    loadKonva().then(() => {
      setKonvaLoaded(true)
      setIsMounted(true)
    }).catch((err) => {
      console.error('Failed to load react-konva:', err)
    })
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const update = () => setIsCoarsePointer(!!mq.matches)
    update()
    if (mq.addEventListener) {
      mq.addEventListener('change', update)
      return () => mq.removeEventListener('change', update)
    }
    mq.addListener(update)
    return () => mq.removeListener(update)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setViewport({ w: el.clientWidth || 900, h: el.clientHeight || 600 })
    update()
    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { data: boards, isLoading: boardsLoading } = useQuery({
    queryKey: ['moodboards'],
    queryFn: () => api.get('/moodboards').then((r) => r.data),
  })

  const fetchBoard = useMutation({
    mutationFn: (id) => api.get(`/moodboards/${id}`).then((r) => r.data),
    onSuccess: (b) => {
      const raw = b.contentJson
      if (raw) {
        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          setContent(parsed)
        } catch {
          setContent(defaultBoardContent())
        }
      } else {
        setContent(defaultBoardContent())
      }
      setSelectedIds([])
      setHistory({ past: [], future: [] })
      setSaveError('')
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || 'Failed to load moodboard')
    },
  })

  const createBoard = useMutation({
    mutationFn: (title) => api.post('/moodboards', { title }).then((r) => r.data),
    onSuccess: (b) => {
      queryClient.invalidateQueries(['moodboards'])
      setBoardId(b.id)
      setBoardTitleDraft(b.title || '')
      fetchBoard.mutate(b.id)
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to create board'),
  })

  const renameBoard = useMutation({
    mutationFn: ({ id, title }) => api.put(`/moodboards/${id}`, { title }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['moodboards'])
      setShowRename(false)
      toast.success('Board renamed')
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to rename board'),
  })

  const deleteBoard = useMutation({
    mutationFn: (id) => api.delete(`/moodboards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['moodboards'])
      setBoardId(null)
      setContent(defaultBoardContent())
      toast.success('Board deleted')
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to delete board'),
  })

  const resetBoards = useMutation({
    mutationFn: () => api.post('/moodboards/reset').then((r) => r.data),
    onSuccess: (b) => {
      queryClient.invalidateQueries(['moodboards'])
      setBoardId(b.id)
      setBoardTitleDraft(b.title || '')
      setContent(defaultBoardContent())
      setSelectedIds([])
      setHistory({ past: [], future: [] })
      toast.success('Moodboards reset')
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to reset moodboards'),
  })

  const saveBoard = useMutation({
    mutationFn: ({ id, contentJson }) => api.put(`/moodboards/${id}`, { contentJson }).then((r) => r.data),
    onSuccess: () => {
      setIsSaving(false)
      setSaveError('')
      queryClient.invalidateQueries(['moodboards'])
    },
    onError: (err) => {
      setIsSaving(false)
      const msg = err?.response?.data?.error || 'Failed to save'
      setSaveError(msg)
    },
  })

  useEffect(() => {
    if (boardsLoading) return
    if (!boards) return

    // Prevent creating boards in a loop (e.g. slow network + repeated renders).
    // We only auto-create the default board once per page load.
    if (boards.length === 0 && !didBootstrapRef.current) {
      didBootstrapRef.current = true
      createBoard.mutate('Main Moodboard')
      return
    }

    if (!boardId) {
      const first = boards[0]
      setBoardId(first.id)
      setBoardTitleDraft(first.title || '')
      fetchBoard.mutate(first.id)
      return
    }
  }, [boardsLoading, boards, boardId, createBoard, fetchBoard])

  // Autosave (debounced)
  useEffect(() => {
    if (!boardId) return
    setIsSaving(true)
    const t = setTimeout(() => {
      try {
        const json = JSON.stringify(content)
        saveBoard.mutate({ id: boardId, contentJson: json })
      } catch (e) {
        setIsSaving(false)
        setSaveError('Failed to serialize board JSON')
      }
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, boardId])

  const stageState = content.stage || { x: 0, y: 0, scale: 1 }

  const setStageState = (next) => {
    setContent((prev) => ({ ...prev, stage: { ...prev.stage, ...next } }))
  }

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressStartRef.current = null
  }, [])

  useEffect(() => {
    return () => cancelLongPress()
  }, [cancelLongPress])

  const openTextEditor = useCallback(
    (id) => {
      const obj = (content.objects || []).find((o) => o.id === id)
      if (!obj) {
        setTextEditor({ open: true, id, value: '' })
        return
      }
      if (obj.type !== 'text') return
      setTextEditor({ open: true, id, value: obj.text || '' })
    },
    [content.objects]
  )

  useEffect(() => {
    if (!textEditor.open) return
    const t = setTimeout(() => {
      try {
        document.getElementById('moodboard-text-editor')?.focus?.()
      } catch {
        // ignore
      }
    }, 50)
    return () => clearTimeout(t)
  }, [textEditor.open])

  useEffect(() => {
    if (!pastePrompt.open) return
    const t = setTimeout(() => {
      try {
        pasteInputRef.current?.focus?.()
      } catch {
        // ignore
      }
    }, 50)
    return () => clearTimeout(t)
  }, [pastePrompt.open])

  const tryPasteFromClipboard = useCallback(
    async (preferredPos) => {
      // Best-effort clipboard read (works on some browsers; iOS often blocks it).
      try {
        if (!navigator.clipboard?.read) {
          throw new Error('Clipboard read not supported')
        }
        const items = await navigator.clipboard.read()
        const files = []
        for (const item of items) {
          const types = item.types || []
          const imgType =
            types.find((t) => (t || '').startsWith('image/')) ||
            // sometimes Safari uses png explicitly
            types.find((t) => t === 'image/png')
          if (!imgType) continue
          // eslint-disable-next-line no-await-in-loop
          const blob = await item.getType(imgType)
          if (!blob) continue
          const ext = (imgType || '').split('/')[1] || 'png'
          const file = new File([blob], `pasted.${ext}`, { type: imgType })
          files.push(file)
        }
        if (files.length === 0) {
          toast.error('Clipboard has no image')
          return true
        }
        const base = preferredPos || viewportCenterCanvasPos()
        for (let i = 0; i < files.length; i += 1) {
          const pos = { x: base.x + i * 24, y: base.y + i * 24 }
          // eslint-disable-next-line no-await-in-loop
          await tryUploadFile(files[i], pos)
        }
        return true
      } catch (e) {
        return false
      }
    },
    [toast, tryUploadFile, viewportCenterCanvasPos]
  )

  const viewportCenterCanvasPos = useCallback(() => {
    const el = containerRef.current
    const scale = stageState.scale || 1
    const cx = (el?.clientWidth || viewport.w || 900) / 2
    const cy = (el?.clientHeight || viewport.h || 600) / 2
    return {
      x: (cx - (stageState.x || 0)) / scale,
      y: (cy - (stageState.y || 0)) / scale,
    }
  }, [stageState.scale, stageState.x, stageState.y, viewport.h, viewport.w])

  const clientPointToCanvasPos = useCallback(
    (clientX, clientY) => {
      const el = containerRef.current
      const scale = stageState.scale || 1
      if (!el) return viewportCenterCanvasPos()
      const r = el.getBoundingClientRect()
      const localX = clientX - r.left
      const localY = clientY - r.top
      return {
        x: (localX - (stageState.x || 0)) / scale,
        y: (localY - (stageState.y || 0)) / scale,
      }
    },
    [stageState.scale, stageState.x, stageState.y, viewportCenterCanvasPos]
  )

  const snap = useCallback(
    (value) => {
      if (!content.grid?.snap) return value
      const size = content.grid?.size || GRID_SIZE
      return Math.round(value / size) * size
    },
    [content.grid]
  )

  const pushHistory = useCallback(
    (nextContent) => {
      setHistory((h) => {
        const past = [...h.past, content]
        if (past.length > 60) past.shift()
        return { past, future: [] }
      })
      setContent(nextContent)
    },
    [content]
  )

  const handleUndo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h
      const prev = h.past[h.past.length - 1]
      const past = h.past.slice(0, -1)
      const future = [content, ...h.future]
      setContent(prev)
      setSelectedIds([])
      return { past, future }
    })
  }, [content])

  const handleRedo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h
      const next = h.future[0]
      const future = h.future.slice(1)
      const past = [...h.past, content]
      setContent(next)
      setSelectedIds([])
      return { past, future }
    })
  }, [content])

  const removeSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    pushHistory({
      ...content,
      objects: (content.objects || []).filter((o) => !selectedIds.includes(o.id)),
    })
    setSelectedIds([])
  }, [selectedIds, pushHistory, content])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space') {
        setIsSpaceDown(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) handleRedo()
        else handleUndo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        handleRedo()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault()
          removeSelected()
        }
      }
    }
    const onKeyUp = (e) => {
      if (e.code === 'Space') setIsSpaceDown(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [selectedIds, handleUndo, handleRedo, removeSelected])

  const duplicateSelected = () => {
    if (selectedIds.length === 0) return
    const objects = content.objects || []
    const toDup = objects.filter((o) => selectedIds.includes(o.id))
    const copies = toDup.map((o) => ({ ...o, id: uid(o.type), x: (o.x || 0) + 24, y: (o.y || 0) + 24 }))
    pushHistory({ ...content, objects: [...objects, ...copies] })
    setSelectedIds(copies.map((c) => c.id))
  }

  const reorderSelected = (dir) => {
    if (selectedIds.length !== 1) return
    const id = selectedIds[0]
    const objects = [...(content.objects || [])]
    const idx = objects.findIndex((o) => o.id === id)
    if (idx === -1) return
    const nextIdx = dir === 'up' ? idx + 1 : idx - 1
    if (nextIdx < 0 || nextIdx >= objects.length) return
    const [item] = objects.splice(idx, 1)
    objects.splice(nextIdx, 0, item)
    pushHistory({ ...content, objects })
  }

  const selectedObject = useMemo(() => {
    if (selectedIds.length !== 1) return null
    return (content.objects || []).find((o) => o.id === selectedIds[0]) || null
  }, [content.objects, selectedIds])

  // Keep transformer in sync
  useEffect(() => {
    const tr = transformerRef.current
    const stage = stageRef.current
    if (!tr || !stage) return
    const layer = tr.getLayer()
    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter(Boolean)
    tr.nodes(nodes)
    tr.keepRatio(keepRatio)
    tr.getLayer()?.batchDraw()
    layer?.batchDraw()
  }, [selectedIds, keepRatio, content.objects])

  const getPointerCanvasPos = () => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const p = stage.getPointerPosition()
    if (!p) return { x: 0, y: 0 }
    const scale = stage.scaleX() || 1
    return {
      x: (p.x - stage.x()) / scale,
      y: (p.y - stage.y()) / scale,
    }
  }

  const addObject = (obj) => {
    pushHistory({ ...content, objects: [...(content.objects || []), obj] })
    setSelectedIds([obj.id])
  }

  const handleStageMouseDown = (e) => {
    // click on empty
    const clickedOnEmpty = e.target === e.target.getStage()
    const tool = isSpaceDown ? 'pan' : activeTool

    if (tool === 'select' || tool === 'pan') {
      if (clickedOnEmpty) setSelectedIds([])
      return
    }

    const pos = getPointerCanvasPos()
    if (tool === 'rect') {
      addObject({
        id: uid('rect'),
        type: 'rect',
        x: snap(pos.x),
        y: snap(pos.y),
        width: 220,
        height: 140,
        rotation: 0,
        opacity: 1,
        fill: '#F3F4F6',
        stroke: '#111827',
        strokeWidth: 2,
        cornerRadius: 18,
      })
      setActiveTool('select')
    } else if (tool === 'circle') {
      addObject({
        id: uid('circle'),
        type: 'circle',
        x: snap(pos.x),
        y: snap(pos.y),
        radius: 90,
        rotation: 0,
        opacity: 1,
        fill: '#F3F4F6',
        stroke: '#111827',
        strokeWidth: 2,
      })
      setActiveTool('select')
    } else if (tool === 'text') {
      const id = uid('text')
      addObject({
        id,
        type: 'text',
        x: snap(pos.x),
        y: snap(pos.y),
        text: 'Text',
        fontFamily: 'system-ui',
        fontSize: 42,
        fontStyle: 'normal',
        fontWeight: 600,
        align: 'left',
        fill: '#111827',
        opacity: 1,
        width: 420,
      })
      setActiveTool('select')
      setTextEditor({ open: true, id, value: 'Text' })
    } else if (tool === 'line') {
      const id = uid('line')
      setDrawingLine({ id, points: [snap(pos.x), snap(pos.y), snap(pos.x), snap(pos.y)] })
    }
  }

  const handleStageMouseMove = () => {
    if (!drawingLine) return
    const pos = getPointerCanvasPos()
    setDrawingLine((d) => {
      if (!d) return d
      const next = [...d.points]
      next[2] = snap(pos.x)
      next[3] = snap(pos.y)
      return { ...d, points: next }
    })
  }

  const handleStageMouseUp = () => {
    if (!drawingLine) return
    const line = drawingLine
    setDrawingLine(null)
    addObject({
      id: line.id,
      type: 'line',
      points: line.points,
      stroke: '#111827',
      strokeWidth: 4,
      opacity: 1,
    })
    setActiveTool('select')
  }

  const handleSelectObject = (id, e) => {
    const isMulti = e?.evt?.shiftKey
    setSelectedIds((prev) => {
      if (!isMulti) return [id]
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      return [...prev, id]
    })
  }

  const updateObject = (id, partial) => {
    const objects = (content.objects || []).map((o) => (o.id === id ? { ...o, ...partial } : o))
    setContent((prev) => ({ ...prev, objects }))
  }

  const commitTransform = (node) => {
    const id = node.id()
    const obj = (content.objects || []).find((o) => o.id === id)
    if (!obj) return

    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)

    if (obj.type === 'rect' || obj.type === 'image' || obj.type === 'text') {
      const width = Math.max(10, (obj.width || node.width()) * scaleX)
      const height = Math.max(10, (obj.height || node.height()) * scaleY)
      pushHistory({
        ...content,
        objects: (content.objects || []).map((o) =>
          o.id === id
            ? {
                ...o,
                x: snap(node.x()),
                y: snap(node.y()),
                width,
                height: o.type === 'text' ? o.height : height,
                rotation: node.rotation(),
              }
            : o
        ),
      })
      return
    }

    if (obj.type === 'circle') {
      const r = Math.max(5, (obj.radius || node.width() / 2) * Math.max(scaleX, scaleY))
      pushHistory({
        ...content,
        objects: (content.objects || []).map((o) =>
          o.id === id
            ? { ...o, x: snap(node.x()), y: snap(node.y()), radius: r, rotation: node.rotation() }
            : o
        ),
      })
      return
    }

    if (obj.type === 'line') {
      pushHistory({
        ...content,
        objects: (content.objects || []).map((o) =>
          o.id === id ? { ...o, x: snap(node.x()), y: snap(node.y()), rotation: node.rotation() } : o
        ),
      })
    }
  }

  const handleWheel = (e) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX() || 1
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const scaleBy = 1.06
    const direction = e.evt.deltaY > 0 ? -1 : 1
    const nextScale = clamp(direction > 0 ? oldScale * scaleBy : oldScale / scaleBy, 0.1, 3)

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }

    const newPos = {
      x: pointer.x - mousePointTo.x * nextScale,
      y: pointer.y - mousePointTo.y * nextScale,
    }

    setStageState({ x: newPos.x, y: newPos.y, scale: nextScale })
  }

  const getTouchInfo = (evt) => {
    const touches = evt?.evt?.touches
    if (!touches || touches.length < 2) return null
    const a = touches[0]
    const b = touches[1]
    const dx = b.clientX - a.clientX
    const dy = b.clientY - a.clientY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const center = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
    return { dist, center }
  }

  const handleTouchStart = (e) => {
    const info = getTouchInfo(e)
    if (!info) return
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    gestureRef.current = {
      isPinching: true,
      startDist: info.dist,
      startScale: stageState.scale || 1,
      startCenter: info.center,
      startPos: { x: stageState.x || 0, y: stageState.y || 0 },
    }
  }

  const handleTouchMove = (e) => {
    const info = getTouchInfo(e)
    if (!info) return
    const g = gestureRef.current
    if (!g?.isPinching) return
    e.evt.preventDefault()

    const stage = stageRef.current
    if (!stage) return

    const scale = clamp(g.startScale * (info.dist / (g.startDist || 1)), 0.1, 3)

    // Pan with two-finger drag: shift by center delta
    const dx = info.center.x - (g.startCenter?.x || info.center.x)
    const dy = info.center.y - (g.startCenter?.y || info.center.y)

    setStageState({
      scale,
      x: (g.startPos?.x || 0) + dx,
      y: (g.startPos?.y || 0) + dy,
    })
  }

  const handleTouchEnd = () => {
    gestureRef.current = { isPinching: false, startDist: 0, startScale: stageState.scale || 1, startCenter: null, startPos: null }
  }

  // On tablets, we need single-finger taps to behave like mouse clicks (add/select/draw),
  // while still supporting pinch-zoom + two-finger pan.
  const handleStageTouchStart = (e) => {
    const touches = e?.evt?.touches
    if (touches && touches.length >= 2) return handleTouchStart(e)
    return handleStageMouseDown(e)
  }

  const handleStageTouchMove = (e) => {
    const touches = e?.evt?.touches
    if (touches && touches.length >= 2) return handleTouchMove(e)
    return handleStageMouseMove(e)
  }

  const handleStageTouchEnd = () => {
    if (gestureRef.current?.isPinching) return handleTouchEnd()
    return handleStageMouseUp()
  }

  const zoomBy = (delta) => {
    const scale = clamp((stageState.scale || 1) + delta, 0.1, 3)
    setStageState({ scale })
  }

  const fitToScreen = () => {
    const el = containerRef.current
    if (!el) return
    const w = el.clientWidth
    const h = el.clientHeight
    const scale = Math.min(w / CANVAS_W, h / CANVAS_H)
    const pad = 40
    setStageState({
      scale: clamp(scale, 0.1, 2),
      x: pad,
      y: pad,
    })
  }

  const toggleGrid = () => {
    setContent((prev) => ({ ...prev, grid: { ...prev.grid, enabled: !prev.grid?.enabled } }))
  }

  const toggleSnap = () => {
    setContent((prev) => ({ ...prev, grid: { ...prev.grid, snap: !prev.grid?.snap } }))
  }

  const tryUploadFile = async (file, preferredPos) => {
    if (!file) return
    const name = (file.name || '').toLowerCase()
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif')
    if (isHeic) {
      toast.error('HEIC not supported yet, please convert')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image (PNG/JPG/SVG/WEBP/GIF)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB')
      return
    }

    const allowedExt = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
    const ext = name.includes('.') ? name.split('.').pop() : ''
    if (ext && !allowedExt.includes(ext)) {
      toast.error('Unsupported image type. Allowed: PNG, JPG, JPEG, GIF, WEBP, SVG')
      return
    }

    const fd = new FormData()
    fd.append('file', file)
    fd.append('position', 'moodboard')
    try {
      const res = await api.post('/images', fd)
      const img = res.data
      // Prime cache for lazy image-by-id queries
      if (img?.id) {
        queryClient.setQueryData(['image', img.id], img)
      }
      const fallback = getPointerCanvasPos()
      const pos = preferredPos || fallback
      addObject({
        id: uid('image'),
        type: 'image',
        imageId: img.id,
        x: snap(pos.x),
        y: snap(pos.y),
        width: 520,
        height: 360,
        rotation: 0,
        opacity: 1,
      })
      toast.success('Image added to board')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Upload failed')
    }
  }

  const onDropFiles = async (e) => {
    e.preventDefault()
    setIsDragOverCanvas(false)

    const dt = e.dataTransfer
    const files = Array.from(dt?.files || []).filter(Boolean)
    if (files.length === 0) {
      const uri = dt?.getData?.('text/uri-list') || dt?.getData?.('text/plain')
      if (uri && /^https?:\/\//i.test(uri.trim())) {
        toast.error('Dropping image URLs is not supported yet. Please download the image and drop the file, or use Upload.')
      }
      return
    }

    const base = clientPointToCanvasPos(e.clientX, e.clientY)
    for (let i = 0; i < files.length; i += 1) {
      // slight offset so multiple dropped files don't stack perfectly
      const pos = { x: base.x + i * 24, y: base.y + i * 24 }
      // eslint-disable-next-line no-await-in-loop
      await tryUploadFile(files[i], pos)
    }
  }

  // Paste (Ctrl/Cmd+V) images directly into the moodboard.
  useEffect(() => {
    const onPaste = async (e) => {
      // If user is typing into an input/textarea, don't hijack paste.
      const tag = (e.target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return

      const items = Array.from(e.clipboardData?.items || [])
      const files = items
        .filter((it) => it.kind === 'file' && (it.type || '').startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter(Boolean)

      if (files.length === 0) return

      e.preventDefault()
      const base = viewportCenterCanvasPos()
      for (let i = 0; i < files.length; i += 1) {
        const pos = { x: base.x + i * 24, y: base.y + i * 24 }
        // eslint-disable-next-line no-await-in-loop
        await tryUploadFile(files[i], pos)
      }
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [tryUploadFile, viewportCenterCanvasPos])

  const onToolbarUploadClick = () => {
    fileInputRef.current?.click()
  }

  const selectedImageUrl = useMemo(() => {
    if (selectedObject?.type !== 'image') return null
    const cached = queryClient.getQueryData(['image', selectedObject.imageId])
    return cached?.url || null
  }, [queryClient, selectedObject])

  // eslint-disable-next-line no-unused-vars
  const _selectedImage = useHtmlImage(selectedImageUrl) // warm cache (helps Konva export reliability)

  const exportPng = () => {
    const stage = stageRef.current
    if (!stage) return
    const url = stage.toDataURL({ pixelRatio: 2 })
    const a = document.createElement('a')
    a.href = url
    a.download = `${(boards?.find((b) => b.id === boardId)?.title || 'moodboard').replace(/\s+/g, '-')}.png`
    a.click()
    toast.success('Exported PNG')
  }

  const addPaletteColor = () => {
    const obj = selectedObject
    const color =
      obj?.fill ||
      obj?.stroke ||
      (obj?.type === 'text' ? obj.fill : null) ||
      '#111827'
    const hex = parseHexColor(color) || '#111827'
    setContent((prev) => {
      const palette = prev.palette || []
      if (palette.includes(hex)) return prev
      return { ...prev, palette: [...palette, hex] }
    })
    toast.success('Added to palette')
  }

  const exportPaletteJson = () => {
    const json = JSON.stringify({ palette: content.palette || [] }, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'palette.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const gridLines = useMemo(() => {
    if (!content.grid?.enabled) return []
    const size = content.grid?.size || GRID_SIZE
    const lines = []
    for (let x = 0; x <= CANVAS_W; x += size) {
      lines.push({ points: [x, 0, x, CANVAS_H] })
    }
    for (let y = 0; y <= CANVAS_H; y += size) {
      lines.push({ points: [0, y, CANVAS_W, y] })
    }
    return lines
  }, [content.grid])

  const tool = isSpaceDown ? 'pan' : activeTool
  const canTransform = tool === 'select'
  const isPanMode = tool === 'pan'
  const toolBtnSize = isCoarsePointer ? 'h-12 w-12' : 'h-10 w-10'

  // Show loading state until react-konva is loaded
  if (!konvaLoaded) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Moodboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Moodboard</h1>
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving…' : 'Saved'}</span>
            {saveError && <span className="text-red-600">({saveError})</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={boardId || ''}
            onChange={(e) => {
              const next = parseInt(e.target.value)
              const b = (boards || []).find((x) => x.id === next)
              setBoardId(next)
              setBoardTitleDraft(b?.title || '')
              fetchBoard.mutate(next)
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
            disabled={!boards || boards.length === 0}
          >
            {(boards || []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
          <IconButton title="Create board" onClick={() => createBoard.mutate('New Moodboard')}>
            <PlusCircle className="w-5 h-5" />
          </IconButton>
          <IconButton
            title="Rename board"
            onClick={() => setShowRename(true)}
            disabled={!boardId}
          >
            <Pencil className="w-5 h-5" />
          </IconButton>
          <IconButton
            title="Delete board"
            onClick={() => {
              if (!boardId) return
              if (window.confirm('Delete this board? This cannot be undone.')) {
                deleteBoard.mutate(boardId)
              }
            }}
            disabled={!boardId}
          >
            <Trash2 className="w-5 h-5" />
          </IconButton>

          {boards && boards.length > 1 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset moodboards? This deletes ALL moodboards and recreates a single "Main Moodboard".')) {
                  resetBoards.mutate()
                }
              }}
              className="ml-2 px-3 h-10 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-sm font-medium"
              title="Delete all moodboards and recreate a single default board"
            >
              Reset
            </button>
          )}

          <div className="w-px h-8 bg-gray-200 mx-1" />

          <IconButton title="Undo (Ctrl/Cmd+Z)" onClick={handleUndo} disabled={history.past.length === 0}>
            <Undo2 className="w-5 h-5" />
          </IconButton>
          <IconButton title="Redo (Ctrl/Cmd+Y)" onClick={handleRedo} disabled={history.future.length === 0}>
            <Redo2 className="w-5 h-5" />
          </IconButton>

          <div className="w-px h-8 bg-gray-200 mx-1" />

          <IconButton title="Toggle grid" onClick={toggleGrid} active={!!content.grid?.enabled}>
            <Grid3x3 className="w-5 h-5" />
          </IconButton>
          <button
            type="button"
            onClick={toggleSnap}
            className={[
              'px-3 h-10 rounded-lg border text-sm font-medium',
              content.grid?.snap ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
            ].join(' ')}
            title="Snap to grid"
          >
            Snap
          </button>

          <div className="w-px h-8 bg-gray-200 mx-1" />

          <IconButton title="Zoom out" onClick={() => zoomBy(-0.08)}>
            <Minus className="w-5 h-5" />
          </IconButton>
          <div className="min-w-[72px] text-center text-sm text-gray-700">
            {Math.round((stageState.scale || 1) * 100)}%
          </div>
          <IconButton title="Zoom in" onClick={() => zoomBy(0.08)}>
            <Plus className="w-5 h-5" />
          </IconButton>
          <button
            type="button"
            onClick={fitToScreen}
            className="px-3 h-10 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium"
          >
            Fit
          </button>
          <IconButton title="Export PNG" onClick={exportPng}>
            <Download className="w-5 h-5" />
          </IconButton>
        </div>
      </div>

      {/* Rename modal */}
      {showRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-xl p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-gray-900">Rename board</h3>
              <button
                type="button"
                onClick={() => setShowRename(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              value={boardTitleDraft}
              onChange={(e) => setBoardTitleDraft(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900"
              placeholder="Board title"
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  if (!boardId) return
                  renameBoard.mutate({ id: boardId, title: boardTitleDraft })
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowRename(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-200 text-gray-900 hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[64px_1fr_340px] gap-4">
        {/* Left toolbar */}
        <div className="flex lg:flex-col gap-2 bg-white border border-gray-200 rounded-2xl p-2 h-fit">
          <IconButton className={toolBtnSize} title="Select" onClick={() => setActiveTool('select')} active={activeTool === 'select' && !isSpaceDown}>
            <MousePointer2 className="w-5 h-5" />
          </IconButton>
          <IconButton className={toolBtnSize} title="Pan (or hold Space)" onClick={() => setActiveTool('pan')} active={activeTool === 'pan' || isSpaceDown}>
            <Hand className="w-5 h-5" />
          </IconButton>
          <div className="w-px lg:w-full lg:h-px h-10 bg-gray-200 my-1" />
          <IconButton className={toolBtnSize} title="Upload image" onClick={onToolbarUploadClick}>
            <ImagePlus className="w-5 h-5" />
          </IconButton>
          <IconButton className={toolBtnSize} title="Rectangle" onClick={() => setActiveTool('rect')} active={activeTool === 'rect'}>
            <Square className="w-5 h-5" />
          </IconButton>
          <IconButton className={toolBtnSize} title="Circle" onClick={() => setActiveTool('circle')} active={activeTool === 'circle'}>
            <CircleIcon className="w-5 h-5" />
          </IconButton>
          <IconButton className={toolBtnSize} title="Line" onClick={() => setActiveTool('line')} active={activeTool === 'line'}>
            <Minus className="w-5 h-5" />
          </IconButton>
          <IconButton className={toolBtnSize} title="Text" onClick={() => setActiveTool('text')} active={activeTool === 'text'}>
            <Type className="w-5 h-5" />
          </IconButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.svg,.png,.jpg,.jpeg,.gif,.webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              await tryUploadFile(file)
            }}
          />
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className={[
            'relative bg-white border rounded-2xl overflow-hidden',
            isDragOverCanvas ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200',
          ].join(' ')}
          style={{ height: 'calc(100vh - 220px)', minHeight: 560, touchAction: 'none' }}
          onTouchStart={(e) => {
            // Long-press helper: opens a focusable field so iOS/Android can show "Paste".
            if (pastePrompt.open || pasteMenu.open) return
            const t = e.touches?.[0]
            if (!t) return
            if ((e.touches?.length || 0) !== 1) return

            cancelLongPress()
            longPressStartRef.current = { x: t.clientX, y: t.clientY }
            longPressTimerRef.current = setTimeout(() => {
              const start = longPressStartRef.current
              if (!start) return
              const pos = clientPointToCanvasPos(start.x, start.y)
              const el = containerRef.current
              const r = el?.getBoundingClientRect?.()
              const localX = r ? start.x - r.left : 16
              const localY = r ? start.y - r.top : 16
              setPasteMenu({ open: true, localX, localY, pos })
            }, 550)
          }}
          onTouchMove={(e) => {
            const t = e.touches?.[0]
            const start = longPressStartRef.current
            if (!t || !start) return
            const dx = t.clientX - start.x
            const dy = t.clientY - start.y
            if (Math.sqrt(dx * dx + dy * dy) > 10) cancelLongPress()
          }}
          onTouchEnd={() => cancelLongPress()}
          onTouchCancel={() => cancelLongPress()}
          onDragEnter={(e) => {
            if (e.dataTransfer?.types?.includes?.('Files')) setIsDragOverCanvas(true)
          }}
          onDragLeave={() => setIsDragOverCanvas(false)}
          onDragOver={(e) => {
            e.preventDefault()
            if (e.dataTransfer?.types?.includes?.('Files')) setIsDragOverCanvas(true)
          }}
          onDrop={onDropFiles}
        >
          {/* Long-press context menu (tablet friendly) */}
          {pasteMenu.open && (
            <div
              className="absolute inset-0 z-20"
              onClick={() => setPasteMenu({ open: false, localX: 0, localY: 0, pos: null })}
            >
              <div
                className="absolute"
                style={{
                  left: clamp(pasteMenu.localX, 16, (viewport?.w || 900) - 220),
                  top: clamp(pasteMenu.localY, 16, (viewport?.h || 600) - 160),
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="rounded-2xl bg-white border border-gray-200 shadow-xl p-3 w-[220px]">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Insert</div>
                  <button
                    type="button"
                    className="w-full px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-semibold text-sm"
                    onClick={async () => {
                      const ok = await tryPasteFromClipboard(pasteMenu.pos)
                      if (!ok) {
                        // fallback to system paste helper
                        setPastePrompt({ open: true, pos: pasteMenu.pos })
                      }
                      setPasteMenu({ open: false, localX: 0, localY: 0, pos: null })
                    }}
                  >
                    Paste image
                  </button>
                  <button
                    type="button"
                    className="mt-2 w-full px-3 py-2 rounded-xl bg-gray-100 text-gray-900 hover:bg-gray-200 font-medium text-sm"
                    onClick={() => {
                      setPastePrompt({ open: true, pos: pasteMenu.pos })
                      setPasteMenu({ open: false, localX: 0, localY: 0, pos: null })
                    }}
                  >
                    System paste…
                  </button>
                  <div className="mt-2 text-[11px] text-gray-500">
                    Tip: tap text to edit. Drag to move.
                  </div>
                </div>
              </div>
            </div>
          )}

          {pastePrompt.open && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/30" onClick={() => setPastePrompt({ open: false, pos: null })} />
              <div className="relative w-full max-w-sm rounded-2xl bg-white border border-gray-200 shadow-xl p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold text-gray-900">Paste image</div>
                  <button
                    type="button"
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
                    onClick={() => setPastePrompt({ open: false, pos: null })}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  Tap below, then choose <span className="font-semibold">Paste</span>.
                </div>
                <input
                  ref={pasteInputRef}
                  type="text"
                  inputMode="text"
                  className="mt-3 w-full px-3 py-3 rounded-xl border border-gray-200 bg-white text-gray-900"
                  placeholder="Tap here, then Paste"
                  onPaste={async (e) => {
                    const items = Array.from(e.clipboardData?.items || [])
                    const files = items
                      .filter((it) => it.kind === 'file' && (it.type || '').startsWith('image/'))
                      .map((it) => it.getAsFile())
                      .filter(Boolean)
                    if (files.length === 0) {
                      toast.error('No image found in clipboard')
                      return
                    }
                    e.preventDefault()
                    const base = pastePrompt.pos || viewportCenterCanvasPos()
                    for (let i = 0; i < files.length; i += 1) {
                      const pos = { x: base.x + i * 24, y: base.y + i * 24 }
                      // eslint-disable-next-line no-await-in-loop
                      await tryUploadFile(files[i], pos)
                    }
                    setPastePrompt({ open: false, pos: null })
                  }}
                />
                <div className="mt-3 text-xs text-gray-500">
                  Tip: for websites that block copying images, download the file and drag & drop it instead.
                </div>
              </div>
            </div>
          )}

          {isDragOverCanvas && (
            <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
              <div className="rounded-2xl bg-white/90 border border-blue-200 shadow px-5 py-4 text-center">
                <div className="text-sm font-semibold text-gray-900">Drop to add image</div>
                <div className="text-xs text-gray-600 mt-1">Tip: you can also paste (Ctrl/Cmd+V)</div>
              </div>
            </div>
          )}
          <Stage
            ref={stageRef}
            width={viewport.w}
            height={viewport.h}
            x={stageState.x || 0}
            y={stageState.y || 0}
            scaleX={stageState.scale || 1}
            scaleY={stageState.scale || 1}
            draggable={isPanMode}
            onDragEnd={(e) => setStageState({ x: e.target.x(), y: e.target.y() })}
            onWheel={handleWheel}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onTouchStart={handleStageTouchStart}
            onTouchMove={handleStageTouchMove}
            onTouchEnd={handleStageTouchEnd}
          >
            <Layer>
              {/* Hard-white canvas background (regardless of admin page bg) */}
              <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#FFFFFF" listening={false} />

              {/* grid */}
              {gridLines.map((l, idx) => (
                <Line key={idx} points={l.points} stroke="#EEF2F7" strokeWidth={1} listening={false} />
              ))}
            </Layer>

            <Layer>
              {(content.objects || []).map((o) => {
                if (o.type === 'rect') {
                  return (
                    <Rect
                      key={o.id}
                      id={o.id}
                      x={o.x}
                      y={o.y}
                      width={o.width}
                      height={o.height}
                      fill={o.fill}
                      opacity={o.opacity ?? 1}
                      stroke={o.stroke}
                      strokeWidth={o.strokeWidth || 0}
                      cornerRadius={o.cornerRadius || 0}
                      rotation={o.rotation || 0}
                      draggable={tool === 'select'}
                      onMouseDown={(e) => handleSelectObject(o.id, e)}
                      onTouchStart={(e) => handleSelectObject(o.id, e)}
                      onTap={(e) => handleSelectObject(o.id, e)}
                      onDragEnd={(e) => updateObject(o.id, { x: snap(e.target.x()), y: snap(e.target.y()) })}
                      onTransformEnd={(e) => commitTransform(e.target)}
                    />
                  )
                }
                if (o.type === 'circle') {
                  return (
                    <Circle
                      key={o.id}
                      id={o.id}
                      x={o.x}
                      y={o.y}
                      radius={o.radius}
                      fill={o.fill}
                      opacity={o.opacity ?? 1}
                      stroke={o.stroke}
                      strokeWidth={o.strokeWidth || 0}
                      rotation={o.rotation || 0}
                      draggable={tool === 'select'}
                      onMouseDown={(e) => handleSelectObject(o.id, e)}
                      onTouchStart={(e) => handleSelectObject(o.id, e)}
                      onTap={(e) => handleSelectObject(o.id, e)}
                      onDragEnd={(e) => updateObject(o.id, { x: snap(e.target.x()), y: snap(e.target.y()) })}
                      onTransformEnd={(e) => commitTransform(e.target)}
                    />
                  )
                }
                if (o.type === 'line') {
                  return (
                    <Line
                      key={o.id}
                      id={o.id}
                      points={o.points}
                      stroke={o.stroke}
                      strokeWidth={o.strokeWidth || 1}
                      opacity={o.opacity ?? 1}
                      lineCap="round"
                      lineJoin="round"
                      draggable={tool === 'select'}
                      onMouseDown={(e) => handleSelectObject(o.id, e)}
                      onTouchStart={(e) => handleSelectObject(o.id, e)}
                      onTap={(e) => handleSelectObject(o.id, e)}
                      onDragEnd={(e) => updateObject(o.id, { x: snap(e.target.x()), y: snap(e.target.y()) })}
                      onTransformEnd={(e) => commitTransform(e.target)}
                    />
                  )
                }
                if (o.type === 'text') {
                  return (
                    <Text
                      key={o.id}
                      id={o.id}
                      x={o.x}
                      y={o.y}
                      width={o.width}
                      text={o.text || ''}
                      fontFamily={o.fontFamily || 'system-ui'}
                      fontSize={o.fontSize || 24}
                      fontStyle={o.fontStyle || 'normal'}
                      fontVariant="normal"
                      fill={o.fill || '#111827'}
                      opacity={o.opacity ?? 1}
                      align={o.align || 'left'}
                      draggable={tool === 'select'}
                      onMouseDown={(e) => handleSelectObject(o.id, e)}
                      onTouchStart={(e) => handleSelectObject(o.id, e)}
                      onTap={(e) => {
                        handleSelectObject(o.id, e)
                        if (isCoarsePointer && tool === 'select') openTextEditor(o.id)
                      }}
                      onDblClick={() => openTextEditor(o.id)}
                      onDblTap={() => openTextEditor(o.id)}
                      onDragEnd={(e) => updateObject(o.id, { x: snap(e.target.x()), y: snap(e.target.y()) })}
                      onTransformEnd={(e) => commitTransform(e.target)}
                    />
                  )
                }
                if (o.type === 'image') {
                  return (
                    <MoodboardImageNode
                      key={o.id}
                      o={o}
                      tool={tool}
                      onSelect={handleSelectObject}
                      onDragEnd={(e) => updateObject(o.id, { x: snap(e.target.x()), y: snap(e.target.y()) })}
                      onTransformEnd={(e) => commitTransform(e.target)}
                    />
                  )
                }
                return null
              })}

              {/* line preview */}
              {drawingLine && (
                <Line
                  points={drawingLine.points}
                  stroke="#111827"
                  strokeWidth={4}
                  opacity={0.6}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
              )}

              {/* Transformer must be rendered after component is mounted (prevents "Cannot access before initialization" error) */}
              {isMounted && (
                <Transformer
                  ref={transformerRef}
                  rotateEnabled={true}
                  enabledAnchors={
                    canTransform
                      ? ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']
                      : []
                  }
                  boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 10 || newBox.height < 10) return oldBox
                    return newBox
                  }}
                />
              )}
            </Layer>
          </Stage>
        </div>

        {/* Right properties panel */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 h-fit">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-gray-900">Properties</div>
            <div className="flex items-center gap-1">
              <IconButton title="Bring forward" onClick={() => reorderSelected('up')} disabled={selectedIds.length !== 1}>
                <ArrowUp className="w-4 h-4" />
              </IconButton>
              <IconButton title="Send backward" onClick={() => reorderSelected('down')} disabled={selectedIds.length !== 1}>
                <ArrowDown className="w-4 h-4" />
              </IconButton>
              <IconButton title="Duplicate" onClick={duplicateSelected} disabled={selectedIds.length === 0}>
                <Copy className="w-4 h-4" />
              </IconButton>
              <IconButton title="Delete" onClick={removeSelected} disabled={selectedIds.length === 0}>
                <Trash2 className="w-4 h-4" />
              </IconButton>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 p-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">Transform</div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-gray-700 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={keepRatio}
                    onChange={(e) => setKeepRatio(e.target.checked)}
                  />
                  Keep ratio
                </label>
              </div>
            </div>

            {selectedObject ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 p-3">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Position</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={Math.round(selectedObject.x || 0)}
                      onChange={(e) => updateObject(selectedObject.id, { x: snap(parseFloat(e.target.value) || 0) })}
                      className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
                      placeholder="x"
                    />
                    <input
                      type="number"
                      value={Math.round(selectedObject.y || 0)}
                      onChange={(e) => updateObject(selectedObject.id, { y: snap(parseFloat(e.target.value) || 0) })}
                      className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
                      placeholder="y"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-3">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Opacity</div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedObject.opacity ?? 1}
                    onChange={(e) => updateObject(selectedObject.id, { opacity: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                {(selectedObject.type === 'rect' || selectedObject.type === 'circle') && (
                  <div className="rounded-xl border border-gray-200 p-3 space-y-4">
                    <ColorControl
                      label="Fill"
                      value={selectedObject.fill || '#FFFFFF'}
                      onChange={(c) => updateObject(selectedObject.id, { fill: c })}
                    />
                    <ColorControl
                      label="Stroke"
                      value={selectedObject.stroke || '#111827'}
                      onChange={(c) => updateObject(selectedObject.id, { stroke: c })}
                    />
                    <div>
                      <div className="text-xs font-semibold text-gray-700">Stroke width</div>
                      <input
                        type="range"
                        min="0"
                        max="24"
                        value={selectedObject.strokeWidth || 0}
                        onChange={(e) => updateObject(selectedObject.id, { strokeWidth: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    {selectedObject.type === 'rect' && (
                      <div>
                        <div className="text-xs font-semibold text-gray-700">Corner radius</div>
                        <input
                          type="range"
                          min="0"
                          max="120"
                          value={selectedObject.cornerRadius || 0}
                          onChange={(e) => updateObject(selectedObject.id, { cornerRadius: parseInt(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={addPaletteColor}
                      className="w-full px-3 py-2 rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200 text-sm font-medium"
                    >
                      Save color to palette
                    </button>
                  </div>
                )}

                {selectedObject.type === 'line' && (
                  <div className="rounded-xl border border-gray-200 p-3 space-y-4">
                    <ColorControl
                      label="Stroke"
                      value={selectedObject.stroke || '#111827'}
                      onChange={(c) => updateObject(selectedObject.id, { stroke: c })}
                    />
                    <div>
                      <div className="text-xs font-semibold text-gray-700">Stroke width</div>
                      <input
                        type="range"
                        min="1"
                        max="24"
                        value={selectedObject.strokeWidth || 4}
                        onChange={(e) => updateObject(selectedObject.id, { strokeWidth: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addPaletteColor}
                      className="w-full px-3 py-2 rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200 text-sm font-medium"
                    >
                      Save color to palette
                    </button>
                  </div>
                )}

                {selectedObject.type === 'text' && (
                  <div className="rounded-xl border border-gray-200 p-3 space-y-4">
                    <button
                      type="button"
                      onClick={() => openTextEditor(selectedObject.id)}
                      className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold"
                    >
                      Edit text (opens keyboard)
                    </button>
                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-2">Text</div>
                      <textarea
                        value={selectedObject.text || ''}
                        onChange={(e) => updateObject(selectedObject.id, { text: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
                        rows={3}
                      />
                    </div>
                    <ColorControl
                      label="Color"
                      value={selectedObject.fill || '#111827'}
                      onChange={(c) => updateObject(selectedObject.id, { fill: c })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-1">Font</div>
                        <select
                          value={selectedObject.fontFamily || 'system-ui'}
                          onChange={(e) => updateObject(selectedObject.id, { fontFamily: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
                        >
                          <option value="system-ui">System</option>
                          <option value="Georgia">Georgia</option>
                          <option value="Times New Roman">Times</option>
                          <option value="Arial">Arial</option>
                          <option value="Helvetica">Helvetica</option>
                          <option value="Courier New">Courier</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-1">Size</div>
                        <input
                          type="number"
                          min="8"
                          max="240"
                          value={selectedObject.fontSize || 24}
                          onChange={(e) => updateObject(selectedObject.id, { fontSize: parseInt(e.target.value) || 24 })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-1">Weight</div>
                        <select
                          value={selectedObject.fontWeight || 400}
                          onChange={(e) => updateObject(selectedObject.id, { fontWeight: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
                        >
                          <option value={300}>Light</option>
                          <option value={400}>Normal</option>
                          <option value={600}>Semibold</option>
                          <option value={700}>Bold</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-1">Style</div>
                        <select
                          value={selectedObject.fontStyle || 'normal'}
                          onChange={(e) => updateObject(selectedObject.id, { fontStyle: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
                        >
                          <option value="normal">Normal</option>
                          <option value="italic">Italic</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={addPaletteColor}
                      className="w-full px-3 py-2 rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200 text-sm font-medium"
                    >
                      Save color to palette
                    </button>
                  </div>
                )}

                {selectedObject.type === 'image' && (
                  <div className="rounded-xl border border-gray-200 p-3 space-y-3">
                    <div className="text-xs font-semibold text-gray-700">Image</div>
                    <div className="text-sm text-gray-700">
                      Source: <span className="text-gray-900 font-medium">#{selectedObject.imageId}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Tip: drag & resize via corners. Upload supports PNG/JPG/SVG/WEBP/GIF (HEIC shows a clear message).
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="text-sm text-gray-700">
                  Select an object to edit its properties.
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Multi-select: Shift+Click. Pan: hold Space or choose Hand tool.
                </div>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-gray-900">Palette</div>
                <button
                  type="button"
                  onClick={exportPaletteJson}
                  className="text-xs text-blue-700 hover:underline"
                >
                  Export JSON
                </button>
              </div>
              {(content.palette || []).length === 0 ? (
                <div className="text-sm text-gray-600">No saved colors yet.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(content.palette || []).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(c)
                        toast.success('Copied hex')
                      }}
                      className="flex items-center gap-2 px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50"
                      title="Click to copy hex"
                    >
                      <span className="h-4 w-4 rounded border border-gray-200" style={{ background: c }} />
                      <span className="text-xs text-gray-700">{c}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Text editor modal (tablet friendly: auto-focus opens keyboard) */}
      {textEditor.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setTextEditor({ open: false, id: null, value: '' })} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white border border-gray-200 shadow-xl p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold text-gray-900">Edit text</div>
              <button
                type="button"
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
                onClick={() => setTextEditor({ open: false, id: null, value: '' })}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              id="moodboard-text-editor"
              value={textEditor.value}
              onChange={(e) => setTextEditor((s) => ({ ...s, value: e.target.value }))}
              className="mt-3 w-full px-3 py-3 rounded-xl border border-gray-200 bg-white text-gray-900"
              rows={5}
              placeholder="Type your text…"
              autoFocus
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold"
                onClick={() => {
                  if (!textEditor.id) return
                  updateObject(textEditor.id, { text: textEditor.value })
                  setTextEditor({ open: false, id: null, value: '' })
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 rounded-lg bg-gray-200 text-gray-900 hover:bg-gray-300 font-medium"
                onClick={() => setTextEditor({ open: false, id: null, value: '' })}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

