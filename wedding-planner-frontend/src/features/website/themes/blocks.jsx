// ONE set of block components, shared by all themes. Each is a PURE function of
// ({ data, tokens }) — no fetching, no external state — so the P4 Python server
// renderer can mirror them from the serialized theme tokens + content document.

function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  if (Number.isNaN(target.getTime())) return null
  const a = new Date(target).setHours(0, 0, 0, 0)
  const b = new Date().setHours(0, 0, 0, 0)
  return Math.round((a - b) / 86400000)
}

function onPrimary(tokens) {
  return tokens.mode === 'dark' ? tokens.colors.bg : '#FFFFFF'
}

function Section({ tokens, alt, children }) {
  const c = tokens.colors
  return (
    <section style={{ background: alt ? c.bg : c.surface, padding: `${tokens.spacing.section} 24px` }}>
      <div style={{ maxWidth: tokens.spacing.maxWidth, margin: '0 auto' }}>{children}</div>
    </section>
  )
}

function Title({ tokens, children }) {
  return (
    <h2
      style={{
        fontFamily: tokens.fonts.heading,
        color: tokens.colors.primary,
        fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
        textAlign: 'center',
        margin: 0,
        fontWeight: 600,
      }}
    >
      {children}
    </h2>
  )
}

function Divider({ tokens }) {
  const d = tokens.divider
  if (d.style === 'leaf') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '12px 0 26px' }}>
        <span style={{ height: '1px', width: '40px', background: d.color, display: 'inline-block' }} />
        <span style={{ width: '7px', height: '7px', borderRadius: '9999px', background: d.color, display: 'inline-block' }} />
        <span style={{ height: '1px', width: '40px', background: d.color, display: 'inline-block' }} />
      </div>
    )
  }
  const width = d.style === 'plain' ? '44px' : '90px'
  const height = d.style === 'plain' ? '2px' : '1px'
  return <div style={{ width, height, background: d.color, margin: '12px auto 26px' }} />
}

function PhotoGrid({ photos, tokens }) {
  if (!photos || photos.length === 0) return null
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '10px',
        marginTop: '20px',
      }}
    >
      {photos.map((url, i) => (
        <img
          key={i}
          src={url}
          alt=""
          style={{
            width: '100%',
            height: '150px',
            objectFit: 'cover',
            borderRadius: tokens.spacing.radius,
            border: `1px solid ${tokens.colors.border}`,
          }}
        />
      ))}
    </div>
  )
}

function bodyText(tokens, extra) {
  return {
    fontFamily: tokens.fonts.body,
    color: tokens.colors.text,
    fontSize: '1rem',
    lineHeight: 1.7,
    ...extra,
  }
}

function buttonStyle(tokens) {
  return {
    display: 'inline-block',
    padding: '10px 20px',
    borderRadius: tokens.spacing.radius,
    background: tokens.colors.primary,
    color: onPrimary(tokens),
    textDecoration: 'none',
    fontFamily: tokens.fonts.body,
    fontSize: '0.95rem',
    border: 'none',
  }
}

function HeroBlock({ data, tokens }) {
  const c = tokens.colors
  const hasImg = !!data.heroImageUrl
  const days = data.showCountdown ? daysUntil(data.date) : null
  return (
    <section
      style={{
        position: 'relative',
        padding: `${tokens.spacing.section} 24px`,
        textAlign: 'center',
        background: hasImg ? c.text : c.surface,
        overflow: 'hidden',
      }}
    >
      {hasImg && (
        <img
          src={data.heroImageUrl}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {hasImg && <div style={{ position: 'absolute', inset: 0, background: c.heroOverlay }} />}
      <div style={{ position: 'relative', color: hasImg ? c.onHero : c.text }}>
        <h1
          style={{
            fontFamily: tokens.fonts.heading,
            fontSize: 'clamp(2rem, 5.5vw, 3.6rem)',
            margin: 0,
            letterSpacing: '0.02em',
            fontWeight: 600,
          }}
        >
          {data.coupleNames}
        </h1>
        {data.tagline ? (
          <p style={{ fontFamily: tokens.fonts.body, fontSize: '1.15rem', marginTop: '14px', opacity: 0.95 }}>
            {data.tagline}
          </p>
        ) : null}
        {data.date ? (
          <p
            style={{
              fontFamily: tokens.fonts.body,
              marginTop: '10px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontSize: '0.82rem',
            }}
          >
            {data.date}
          </p>
        ) : null}
        {typeof days === 'number' && days >= 0 ? (
          <p
            style={{
              marginTop: '18px',
              fontFamily: tokens.fonts.heading,
              fontSize: '1.5rem',
              color: hasImg ? c.onHero : c.primary,
            }}
          >
            {days === 0 ? 'Today is the day' : `${days} days to go`}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function StoryBlock({ data, tokens }) {
  return (
    <Section tokens={tokens} alt>
      <Title tokens={tokens}>{data.title || 'Our Story'}</Title>
      <Divider tokens={tokens} />
      {data.body ? (
        <p style={bodyText(tokens, { whiteSpace: 'pre-line', textAlign: 'center' })}>{data.body}</p>
      ) : null}
      <PhotoGrid photos={data.photos} tokens={tokens} />
    </Section>
  )
}

function ScheduleBlock({ data, tokens }) {
  const events = data.events || []
  return (
    <Section tokens={tokens}>
      <Title tokens={tokens}>{data.title || 'Schedule'}</Title>
      <Divider tokens={tokens} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.blockGap }}>
        {events.map((ev, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'baseline',
              borderBottom: `1px solid ${tokens.colors.border}`,
              paddingBottom: '14px',
            }}
          >
            <div
              style={{
                minWidth: '92px',
                fontFamily: tokens.fonts.body,
                color: tokens.colors.accent,
                fontSize: '0.95rem',
                fontWeight: 600,
              }}
            >
              {ev.time}
            </div>
            <div>
              <div style={{ fontFamily: tokens.fonts.heading, color: tokens.colors.text, fontSize: '1.15rem' }}>
                {ev.title}
              </div>
              {ev.location ? (
                <div style={{ fontFamily: tokens.fonts.body, color: tokens.colors.muted, fontSize: '0.9rem' }}>
                  {ev.location}
                </div>
              ) : null}
              {ev.description ? (
                <div style={bodyText(tokens, { fontSize: '0.95rem', marginTop: '4px' })}>{ev.description}</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function VenueBlock({ data, tokens }) {
  return (
    <Section tokens={tokens} alt>
      <Title tokens={tokens}>{data.title || 'Venue'}</Title>
      <Divider tokens={tokens} />
      <div style={{ textAlign: 'center' }}>
        {data.venueName ? (
          <div style={{ fontFamily: tokens.fonts.heading, fontSize: '1.3rem', color: tokens.colors.text }}>
            {data.venueName}
          </div>
        ) : null}
        {data.address ? (
          <div style={bodyText(tokens, { color: tokens.colors.muted, marginTop: '6px' })}>{data.address}</div>
        ) : null}
        {data.directions ? (
          <p style={bodyText(tokens, { whiteSpace: 'pre-line', marginTop: '12px' })}>{data.directions}</p>
        ) : null}
        {data.mapsUrl ? (
          <div style={{ marginTop: '18px' }}>
            <a href={data.mapsUrl} target="_blank" rel="noreferrer" style={buttonStyle(tokens)}>
              View on map
            </a>
          </div>
        ) : null}
      </div>
    </Section>
  )
}

function RsvpBlock({ data, tokens }) {
  return (
    <Section tokens={tokens}>
      <Title tokens={tokens}>{data.title || 'RSVP'}</Title>
      <Divider tokens={tokens} />
      <div style={{ textAlign: 'center' }}>
        {data.note ? <p style={bodyText(tokens, { whiteSpace: 'pre-line' })}>{data.note}</p> : null}
        {data.deadline ? (
          <p style={{ fontFamily: tokens.fonts.body, color: tokens.colors.accent, marginTop: '10px', fontWeight: 600 }}>
            {`Please respond by ${data.deadline}`}
          </p>
        ) : null}
        <div style={{ marginTop: '18px' }}>
          <span style={buttonStyle(tokens)}>RSVP</span>
        </div>
      </div>
    </Section>
  )
}

function RegistryBlock({ data, tokens }) {
  const links = data.links || []
  return (
    <Section tokens={tokens} alt>
      <Title tokens={tokens}>{data.title || 'Registry'}</Title>
      <Divider tokens={tokens} />
      <div style={{ textAlign: 'center' }}>
        {data.note ? <p style={bodyText(tokens, { whiteSpace: 'pre-line' })}>{data.note}</p> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginTop: '18px' }}>
          {links.map((link, i) => (
            <a key={i} href={link.url} target="_blank" rel="noreferrer" style={buttonStyle(tokens)}>
              {link.label || 'View registry'}
            </a>
          ))}
        </div>
      </div>
    </Section>
  )
}

function GalleryBlock({ data, tokens }) {
  return (
    <Section tokens={tokens}>
      <Title tokens={tokens}>{data.title || 'Gallery'}</Title>
      <Divider tokens={tokens} />
      <PhotoGrid photos={data.photos} tokens={tokens} />
    </Section>
  )
}

function FaqBlock({ data, tokens }) {
  const items = data.items || []
  return (
    <Section tokens={tokens} alt>
      <Title tokens={tokens}>{data.title || 'FAQ'}</Title>
      <Divider tokens={tokens} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.blockGap }}>
        {items.map((item, i) => (
          <div key={i}>
            <div style={{ fontFamily: tokens.fonts.heading, color: tokens.colors.text, fontSize: '1.1rem' }}>
              {item.q}
            </div>
            {item.a ? <div style={bodyText(tokens, { whiteSpace: 'pre-line', marginTop: '4px' })}>{item.a}</div> : null}
          </div>
        ))}
      </div>
    </Section>
  )
}

function FooterBlock({ data, tokens }) {
  return (
    <footer style={{ background: tokens.colors.bg, padding: '40px 24px', textAlign: 'center' }}>
      <div
        style={{
          fontFamily: tokens.fonts.heading,
          color: tokens.colors.muted,
          fontSize: '1rem',
          letterSpacing: '0.04em',
        }}
      >
        {data.note}
      </div>
    </footer>
  )
}

export const BLOCK_COMPONENTS = {
  hero: HeroBlock,
  story: StoryBlock,
  schedule: ScheduleBlock,
  venue: VenueBlock,
  rsvp: RsvpBlock,
  registry: RegistryBlock,
  gallery: GalleryBlock,
  faq: FaqBlock,
  footer: FooterBlock,
}
