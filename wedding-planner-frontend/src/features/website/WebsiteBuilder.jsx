import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useToast } from '../../components/ui/Toast'
import useWebsite from './hooks/useWebsite'
import PublishBar from './components/PublishBar'
import ThemePicker from './components/ThemePicker'
import SlugField from './components/SlugField'
import BlockList from './components/BlockList'
import BlockForm from './components/BlockForm'
import PreviewPane from './components/PreviewPane'
import EmptyStateCard from './components/EmptyStateCard'
import RevisionHistory from './components/RevisionHistory'
import GuestAccess from './components/GuestAccess'
import WediGenerateSheet from './components/WediGenerateSheet'
import RsvpInbox from './components/RsvpInbox'
import { BLOCK_LABELS } from './siteSchema'
import { ROSE_GOLD, formatResetDate, isAtLimit } from './wedi'

function errorMessage(err, fallback) {
  const detail = err?.response?.data
  if (detail && typeof detail === 'object' && detail.error) return detail.error
  if (typeof detail === 'string') return detail
  return fallback
}

// Wedi endpoints return FastAPI-style { detail: { code, detail } } bodies; pull
// out the friendly message (e.g. the monthly-limit copy) when present.
function wediError(err, fallback) {
  const d = err?.response?.data?.detail
  if (d && typeof d === 'object' && d.detail) return d.detail
  if (typeof d === 'string') return d
  return fallback
}

export default function WebsiteBuilder() {
  const site = useWebsite()
  const toast = useToast()
  const [tab, setTab] = useState('website') // 'website' | 'responses'
  const [selected, setSelected] = useState('hero')
  const [showIntro, setShowIntro] = useState(true)
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sheet, setSheet] = useState({ open: false, mode: 'full', sectionLabel: null })

  const atLimit = isAtLimit(site.wedi)

  const openFull = () => setSheet({ open: true, mode: 'full', sectionLabel: null })
  const openRefine = (label) => setSheet({ open: true, mode: 'refine', sectionLabel: label })
  const closeSheet = () => setSheet((s) => ({ ...s, open: false }))

  const onGenerate = async (promptText) => {
    const { mode, sectionLabel } = sheet
    closeSheet()
    setGenerating(true)
    try {
      // For a targeted rework, name the section so Wedi edits the right block.
      const finalPrompt =
        mode === 'refine' && sectionLabel
          ? `Rework the “${sectionLabel}” section. ${promptText}`
          : promptText
      await site.generate(finalPrompt, mode)
      toast.success('Draft updated — review and publish when ready.')
    } catch (err) {
      toast.error(wediError(err, "Wedi couldn't finish this draft just now — please try again."))
    } finally {
      setGenerating(false)
    }
  }

  if (site.loading) {
    return <div className="py-20 text-center text-gray-400">Loading your website…</div>
  }
  if (site.error || !site.content) {
    return <div className="py-20 text-center text-red-500">We could not load your website. Please try again.</div>
  }

  const selectedBlock =
    site.content.blocks.find((b) => b.type === selected) || site.content.blocks[0]

  const onPublish = async () => {
    setBusy(true)
    try {
      await site.publish()
      toast.success('Your website is live')
    } catch (err) {
      toast.error(errorMessage(err, 'Could not publish your website'))
    } finally {
      setBusy(false)
    }
  }

  const onUnpublish = async () => {
    setBusy(true)
    try {
      await site.unpublish()
      toast.info('Your website is now offline')
    } catch (err) {
      toast.error(errorMessage(err, 'Could not unpublish'))
    } finally {
      setBusy(false)
    }
  }

  const onTheme = async (themeKey) => {
    try {
      await site.saveSettings({ theme: themeKey })
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change theme'))
    }
  }

  const onSlug = async (nextSlug) => {
    try {
      await site.saveSettings({ slug: nextSlug })
      toast.success('Your address was updated')
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update the address'))
    }
  }

  const onGuestAccess = async (patch) => {
    try {
      await site.saveSettings(patch)
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save settings'))
    }
  }

  const onRestore = async (id) => {
    try {
      await site.restore(id)
      toast.success('That version was restored to your draft')
    } catch (err) {
      toast.error(errorMessage(err, 'Could not restore that version'))
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Wedding Website</h1>
        <p className="text-sm text-gray-500">Build a beautiful page to share with your guests.</p>
      </header>

      <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
        {[
          { key: 'website', label: 'Website' },
          { key: 'responses', label: 'Responses' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-gray-800 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'responses' ? (
        <RsvpInbox />
      ) : (
        <>
      <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
        <PublishBar
          status={site.status}
          slug={site.slug}
          saveState={site.saveState}
          hasUnpublishedChanges={site.hasUnpublishedChanges}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
          busy={busy}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4 grid gap-4 md:grid-cols-2">
        <div>
          <span className="block text-xs font-medium text-gray-500 mb-2">Theme</span>
          <ThemePicker value={site.theme} onChange={onTheme} />
        </div>
        <SlugField value={site.slug} onSave={onSlug} checkSlug={site.checkSlug} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
        <div className="space-y-4">
          {showIntro && !site.publishedAt ? (
            <EmptyStateCard onDismiss={() => setShowIntro(false)} onDraft={openFull} atLimit={atLimit} />
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between px-1 mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Sections</h2>
              <button
                type="button"
                onClick={openFull}
                disabled={atLimit || generating}
                title="Let Wedi draft the whole site"
                className="inline-flex items-center gap-1 text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: ROSE_GOLD }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Ask Wedi
              </button>
            </div>
            <BlockList
              blocks={site.content.blocks}
              selected={selected}
              onSelect={setSelected}
              onToggle={site.setBlockEnabled}
            />
          </div>

          {selectedBlock ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <BlockForm
                block={selectedBlock}
                onChange={(patch) => site.updateBlockData(selectedBlock.type, patch)}
                onRefine={() => openRefine(BLOCK_LABELS[selectedBlock.type] || 'this section')}
                refineDisabled={atLimit || generating}
              />
            </div>
          ) : null}

          <GuestAccess
            rsvpEnabled={site.rsvpEnabled}
            hasPassword={site.hasPassword}
            onSave={onGuestAccess}
          />

          <RevisionHistory
            listRevisions={site.listRevisions}
            onRestore={onRestore}
            reloadToken={site.publishedAt}
          />
        </div>

        <div className="lg:sticky lg:top-4 self-start w-full">
          <PreviewPane
            content={site.content}
            theme={site.theme}
            slug={site.slug}
            status={site.status}
            rsvpEnabled={site.rsvpEnabled}
            generating={generating}
          />
        </div>
      </div>

      {/* Quiet footer indicator — hidden until at least one design is used. */}
      {site.wedi && site.wedi.used > 0 ? (
        <p className="mt-4 text-center text-xs text-gray-400">
          Wedi designs: {site.wedi.used} of {site.wedi.limit} used this month
          {atLimit ? ` · resets ${formatResetDate(site.wedi.resetsOn)}` : ''}
        </p>
      ) : null}

      <WediGenerateSheet
        open={sheet.open}
        mode={sheet.mode}
        sectionLabel={sheet.sectionLabel}
        wedi={site.wedi}
        onClose={closeSheet}
        onSubmit={onGenerate}
      />
        </>
      )}
    </div>
  )
}
