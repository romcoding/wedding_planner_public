import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { MessageSquare, Save, Sparkles } from 'lucide-react'

const DEFAULT_CONFIG = {
  template: 'classic',
  guestThemeColors: {
    primary: '#ec4899',
    secondary: '#7c3aed',
    accent: '#111827',
    background: '#ffffff',
    text: '#111827',
  },
  heroImages: [],
  guestTimeline: [],
  guestAgenda: [],
  guestTextSections: { about: '', dressCode: '' },
  guestWitnessCards: [],
  guestBrideCard: {},
  guestGroomCard: {},
  sectionOrder: ['hero', 'about', 'timeline', 'agenda', 'registry', 'rsvp', 'contact'],
}

const SECTION_TITLES = {
  hero: 'Hero Banner',
  about: 'About',
  gallery: 'Photo Gallery',
  timeline: 'Timeline',
  agenda: 'Agenda',
  registry: 'Registry',
  rsvp: 'RSVP Form',
  contact: 'Contact Cards',
  witnesses: 'Witnesses',
  couple_cards: 'Couple Cards',
}

function parseJsonSafe(raw, fallback) {
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export default function WebpageBuilderPage() {
  const queryClient = useQueryClient()
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [chatInput, setChatInput] = useState('')
  const [chatLog, setChatLog] = useState([])
  const [lastTokenMeta, setLastTokenMeta] = useState({ consumed: 0, remaining: null })

  const { data: settings } = useQuery({
    queryKey: ['events', 'guest-portal-settings'],
    queryFn: () => api.get('/events/guest-portal-settings').then((r) => r.data),
  })

  useEffect(() => {
    if (!settings) return
    const fromSaved = settings.webpageConfig || {}
    const witnesses = parseJsonSafe(settings.witnesses, [])
    const cards = parseJsonSafe(settings.coupleCards, [])

    setConfig((prev) => ({
      ...prev,
      ...fromSaved,
      guestTextSections: {
        ...(prev.guestTextSections || {}),
        ...(fromSaved.guestTextSections || {}),
        dressCode: settings.guestDresscode?.en || fromSaved.guestTextSections?.dressCode || '',
      },
      guestAgenda: Array.isArray(fromSaved.guestAgenda)
        ? fromSaved.guestAgenda
        : String(settings.guestAgenda?.en || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => ({ title: line, description: '' })),
      guestWitnessCards: Array.isArray(fromSaved.guestWitnessCards) && fromSaved.guestWitnessCards.length
        ? fromSaved.guestWitnessCards
        : witnesses,
      sectionOrder: Array.isArray(fromSaved.sectionOrder) && fromSaved.sectionOrder.length
        ? fromSaved.sectionOrder
        : DEFAULT_CONFIG.sectionOrder,
      guestBrideCard: fromSaved.guestBrideCard || cards.find((c) => c.type === 'bride') || {},
      guestGroomCard: fromSaved.guestGroomCard || cards.find((c) => c.type === 'groom') || {},
    }))
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: (payload) => api.post('/events/guest-portal-settings', payload),
    onSuccess: () => queryClient.invalidateQueries(['events', 'guest-portal-settings']),
  })

  const aiMutation = useMutation({
    mutationFn: (message) => api.post('/ai/webpage-command', { message, current_config: config }).then((r) => r.data),
    onSuccess: (data) => {
      setConfig((prev) => ({ ...prev, ...(data.updated_config || {}) }))
      setChatLog((prev) => [...prev, { role: 'assistant', content: data.assistant_reply || 'Updated.' }])
      setLastTokenMeta({
        consumed: data.meta?.tokens_charged || 0,
        remaining: data.meta?.tokens_remaining ?? null,
      })
    },
    onError: (err) => {
      setChatLog((prev) => [...prev, { role: 'assistant', content: err.response?.data?.error || 'Failed to apply command.' }])
    },
  })

  const savePayload = useMemo(() => ({
    guestDresscode: {
      en: config?.guestTextSections?.dressCode || '',
      de: '',
      fr: '',
    },
    guestAgenda: {
      en: (config.guestAgenda || []).map((i) => i.title).join('\n'),
      de: '',
      fr: '',
    },
    witnesses: JSON.stringify(config.guestWitnessCards || []),
    coupleCards: JSON.stringify([
      { type: 'bride', ...(config.guestBrideCard || {}) },
      { type: 'groom', ...(config.guestGroomCard || {}) },
    ]),
    webpageConfig: config,
  }), [config])

  useEffect(() => {
    if (!settings) return
    const t = setTimeout(() => {
      saveMutation.mutate(savePayload)
    }, 700)
    return () => clearTimeout(t)
  }, [savePayload, settings])

  const onChatSubmit = (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    const text = chatInput.trim()
    setChatLog((prev) => [...prev, { role: 'user', content: text }])
    setChatInput('')
    aiMutation.mutate(text)
  }

  const onReorder = (fromIdx, toIdx) => {
    if (fromIdx === toIdx || toIdx < 0) return
    setConfig((prev) => {
      const next = [...(prev.sectionOrder || [])]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(Math.min(toIdx, next.length), 0, moved)
      return { ...prev, sectionOrder: next }
    })
  }

  const renderPreviewSection = (section) => {
    switch (section) {
      case 'hero':
        return <div className="p-4 rounded-xl bg-pink-50 border">Hero: {(config.heroImages?.[0]?.alt || 'Upload/select hero image')}</div>
      case 'about':
        return <div className="p-4 rounded-xl bg-white border">{config.guestTextSections?.about || 'About section text...'}</div>
      case 'timeline':
        return <div className="p-4 rounded-xl bg-white border">Timeline items: {config.guestTimeline?.length || 0}</div>
      case 'agenda':
        return <div className="p-4 rounded-xl bg-white border">Agenda items: {config.guestAgenda?.length || 0}</div>
      case 'registry':
        return <div className="p-4 rounded-xl bg-white border">Registry section</div>
      case 'rsvp':
        return <div className="p-4 rounded-xl bg-white border">RSVP form</div>
      case 'contact':
        return <div className="p-4 rounded-xl bg-white border">Contact cards</div>
      default:
        return <div className="p-4 rounded-xl bg-white border">{SECTION_TITLES[section] || section}</div>
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Webpage Builder</h1>
          <p className="text-gray-600">Drag/reorder sections and edit content. Changes auto-save.</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg" onClick={() => saveMutation.mutate(savePayload)}>
          <Save className="h-4 w-4" /> Save now
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-4 space-y-4">
          <div className="bg-white border rounded-xl p-4">
            <h2 className="font-semibold mb-3">Sections</h2>
            <div className="space-y-2">
              {(config.sectionOrder || []).map((section, idx) => (
                <div key={`${section}-${idx}`} className="flex items-center justify-between border rounded-lg p-2 bg-gray-50">
                  <span className="font-medium text-sm">{SECTION_TITLES[section] || section}</span>
                  <div className="flex gap-2">
                    <button className="text-xs px-2 py-1 bg-white border rounded" onClick={() => onReorder(idx, idx - 1)}>↑</button>
                    <button className="text-xs px-2 py-1 bg-white border rounded" onClick={() => onReorder(idx, idx + 1)}>↓</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border rounded-xl p-4 space-y-3">
            <h2 className="font-semibold">Inline Content</h2>
            <label className="block text-sm">
              About text
              <textarea className="mt-1 w-full border rounded-lg p-2" rows={3} value={config.guestTextSections?.about || ''} onChange={(e) => setConfig((p) => ({ ...p, guestTextSections: { ...(p.guestTextSections || {}), about: e.target.value } }))} />
            </label>
            <label className="block text-sm">
              Dress code
              <input className="mt-1 w-full border rounded-lg p-2" value={config.guestTextSections?.dressCode || ''} onChange={(e) => setConfig((p) => ({ ...p, guestTextSections: { ...(p.guestTextSections || {}), dressCode: e.target.value } }))} />
            </label>
            <label className="block text-sm">
              Hero image URL
              <input className="mt-1 w-full border rounded-lg p-2" value={config.heroImages?.[0]?.url || ''} onChange={(e) => setConfig((p) => ({ ...p, heroImages: [{ url: e.target.value, alt: p.heroImages?.[0]?.alt || '' }] }))} />
            </label>
            <label className="block text-sm">
              Hero image alt
              <input className="mt-1 w-full border rounded-lg p-2" value={config.heroImages?.[0]?.alt || ''} onChange={(e) => setConfig((p) => ({ ...p, heroImages: [{ url: p.heroImages?.[0]?.url || '', alt: e.target.value }] }))} />
            </label>
          </div>

          <div className="bg-white border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><MessageSquare className="h-4 w-4" /><h2 className="font-semibold">OpenClaw commands</h2></div>
            <form onSubmit={onChatSubmit} className="flex gap-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="flex-1 border rounded-lg p-2" placeholder="e.g. change template to modern" />
              <button className="px-3 py-2 rounded-lg bg-purple-600 text-white inline-flex items-center gap-1"><Sparkles className="h-4 w-4" />Send</button>
            </form>
            <div className="text-xs text-gray-600 mt-2">Tokens used: {lastTokenMeta.consumed} · Remaining: {lastTokenMeta.remaining ?? '—'}</div>
            <div className="mt-3 max-h-44 overflow-auto space-y-2">
              {chatLog.map((m, i) => <div key={i} className={`text-sm p-2 rounded ${m.role === 'user' ? 'bg-blue-50' : 'bg-gray-50'}`}>{m.content}</div>)}
            </div>
          </div>
        </div>

        <div className="xl:col-span-8 bg-white border rounded-xl p-4">
          <h2 className="font-semibold mb-3">Live preview</h2>
          <div
            className="rounded-2xl p-4 md:p-6 space-y-3"
            style={{ background: config.guestThemeColors?.background || '#fff', color: config.guestThemeColors?.text || '#111827' }}
          >
            {(config.sectionOrder || []).map((section, idx) => (
              <div key={`${section}-preview-${idx}`}>{renderPreviewSection(section)}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
