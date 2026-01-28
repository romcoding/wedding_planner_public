import React from 'react'

export default function BrandedMapEmbed({
  title = 'Map',
  embedSrc,
  openUrl,
  openLabel = 'Open in Google Maps',
  height = 300,
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-white/60 shadow-sm">
      {/* Soft tint overlay to blend with theme */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, var(--wp-primary), var(--wp-secondary))',
          opacity: 0.08,
          mixBlendMode: 'multiply',
        }}
      />

      {/* Optional header overlay */}
      {title ? (
        <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl bg-black/40 px-3 py-2 text-sm text-white backdrop-blur">
          {title}
        </div>
      ) : null}

      {/* Optional CTA */}
      {openUrl ? (
        <a
          className="absolute right-4 top-4 z-10 rounded-xl bg-white/20 px-3 py-2 text-sm text-white backdrop-blur transition hover:bg-white/30"
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {openLabel}
        </a>
      ) : null}

      {/* Map */}
      <iframe
        title={title}
        src={embedSrc}
        width="100%"
        height={height}
        style={{ border: 0, filter: 'saturate(0.85) contrast(1.05)' }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block"
      />
    </div>
  )
}
