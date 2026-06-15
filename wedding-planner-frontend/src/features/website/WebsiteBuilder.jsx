import { useState } from 'react'
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

function errorMessage(err, fallback) {
  const detail = err?.response?.data
  if (detail && typeof detail === 'object' && detail.error) return detail.error
  if (typeof detail === 'string') return detail
  return fallback
}

export default function WebsiteBuilder() {
  const site = useWebsite()
  const toast = useToast()
  const [selected, setSelected] = useState('hero')
  const [showIntro, setShowIntro] = useState(true)
  const [busy, setBusy] = useState(false)

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

      <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
        <PublishBar
          status={site.status}
          slug={site.slug}
          saveState={site.saveState}
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
          {showIntro && !site.publishedAt ? <EmptyStateCard onDismiss={() => setShowIntro(false)} /> : null}

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-1 mb-2">Sections</h2>
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
          <PreviewPane content={site.content} theme={site.theme} slug={site.slug} status={site.status} />
        </div>
      </div>
    </div>
  )
}
