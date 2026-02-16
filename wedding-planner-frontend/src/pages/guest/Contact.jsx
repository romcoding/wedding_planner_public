import { useState, useMemo } from 'react'
import { Phone, User } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function Contact() {
  const { t } = useLanguage()
  const [contactMode, setContactMode] = useState('couple')

  // Parse couple card data from content
  const coupleCards = useMemo(() => {
    try {
      const raw = t('guest_couple_cards')
      if (!raw || raw === 'guest_couple_cards') return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((c) => c.name || c.image) : []
    } catch {
      return []
    }
  }, [t])

  // Parse witness data from content
  const witnessCards = useMemo(() => {
    try {
      const raw = t('guest_witnesses')
      if (!raw || raw === 'guest_witnesses') return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((w) => w.name || w.image) : []
    } catch {
      return []
    }
  }, [t])

  const hasWitnesses = witnessCards.length > 0
  const hasCoupleCards = coupleCards.length > 0

  return (
    <div className="space-y-6 text-center">
      <h2 className="text-2xl md:text-3xl font-semibold mb-2" style={{ color: 'var(--wp-primary)' }}>{t('contactTitle')}</h2>

      {/* Toggle buttons - only show if there are witness cards */}
      {hasWitnesses && (
        <div className="flex justify-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setContactMode('couple')}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all border"
            style={
              contactMode === 'couple'
                ? { backgroundColor: 'var(--wp-primary)', color: '#fff', borderColor: 'var(--wp-primary)' }
                : { backgroundColor: 'transparent', color: 'var(--wp-primary)', borderColor: 'var(--wp-primary)' }
            }
          >
            {t('contactBrideGroom')}
          </button>
          <button
            type="button"
            onClick={() => setContactMode('witnesses')}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all border"
            style={
              contactMode === 'witnesses'
                ? { backgroundColor: 'var(--wp-primary)', color: '#fff', borderColor: 'var(--wp-primary)' }
                : { backgroundColor: 'transparent', color: 'var(--wp-primary)', borderColor: 'var(--wp-primary)' }
            }
          >
            {t('contactWitnesses')}
          </button>
        </div>
      )}

      {/* Bride & Groom flip cards */}
      {contactMode === 'couple' && (
        <div>
          {hasCoupleCards ? (
            <>
              <p className="mb-6 text-sm" style={{ color: 'var(--wp-primary)', opacity: 0.7 }}>
                {t('contactCoupleDescription')}
              </p>
              <div
                className="grid gap-6 justify-items-center"
                style={{
                  justifyContent: 'center',
                  gridTemplateColumns: coupleCards.length === 1
                    ? '1fr'
                    : 'repeat(2, minmax(0, 280px))',
                }}
              >
                {coupleCards.map((c, idx) => (
                  <FlipCard key={idx} witness={c} t={t} />
                ))}
              </div>
            </>
          ) : (
            <p className="mb-8" style={{ color: 'var(--wp-primary)' }}>
              {t('contactIntro')}
            </p>
          )}
        </div>
      )}

      {/* Witnesses flip cards */}
      {contactMode === 'witnesses' && (
        <div>
          <p className="mb-6 text-sm" style={{ color: 'var(--wp-primary)', opacity: 0.7 }}>
            {t('contactWitnessesDescription')}
          </p>
          <div
            className="grid gap-6 justify-items-center"
            style={{
              justifyContent: 'center',
              gridTemplateColumns: witnessCards.length === 1
                ? '1fr'
                : witnessCards.length === 2
                  ? 'repeat(2, minmax(0, 280px))'
                  : 'repeat(auto-fit, minmax(220px, 280px))',
            }}
          >
            {witnessCards.map((w, idx) => (
              <FlipCard key={idx} witness={w} t={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Flip Card Component ── */
function FlipCard({ witness, t }) {
  const [isFlipped, setIsFlipped] = useState(false)

  return (
    <div
      className="w-full cursor-pointer"
      style={{ perspective: '1000px', maxWidth: '280px' }}
      onClick={() => setIsFlipped((f) => !f)}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingBottom: '133%', /* 3:4 aspect ratio */
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s ease',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front - Image */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: '1rem',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          }}
        >
          {witness.image ? (
            <img
              src={witness.image}
              alt={witness.name || ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--wp-secondary, #7C3AED)',
              }}
            >
              <User style={{ width: '4rem', height: '4rem', color: '#fff', opacity: 0.6 }} />
            </div>
          )}
          {/* Name overlay at bottom of image */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '1.5rem 1rem 1rem',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
              color: '#fff',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{witness.name}</div>
          </div>
        </div>

        {/* Back - Contact info */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: '1rem',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            backgroundColor: 'var(--wp-background, #F7F3EA)',
            border: '2px solid var(--wp-primary, #EC4899)',
          }}
        >
          <div
            style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              backgroundColor: 'var(--wp-primary, #EC4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem',
            }}
          >
            <Phone style={{ width: '1.5rem', height: '1.5rem', color: '#fff' }} />
          </div>

          <div style={{ color: 'var(--wp-primary, #EC4899)', fontWeight: 700, fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            {witness.name}
          </div>

          {witness.phone && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--wp-primary, #EC4899)', opacity: 0.6, marginBottom: '0.25rem' }}>
                {t('witnessPhoneLabel')}
              </div>
              <a
                href={`tel:${witness.phone.replace(/\s/g, '')}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: 'var(--wp-primary, #EC4899)',
                  textDecoration: 'none',
                }}
              >
                {witness.phone}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
