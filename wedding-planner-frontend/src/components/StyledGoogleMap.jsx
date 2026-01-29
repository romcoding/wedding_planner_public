import { useEffect, useMemo, useRef, useState } from 'react'

let mapsLoaderPromise = null

const loadGoogleMaps = (apiKey) => {
  if (mapsLoaderPromise) return mapsLoaderPromise
  mapsLoaderPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve(window.google.maps)
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google.maps)
    script.onerror = reject
    document.head.appendChild(script)
  })
  return mapsLoaderPromise
}

const parseColor = (value, fallback) => {
  const v = String(value || '').trim()
  if (!v) return fallback
  if (v.startsWith('#')) return v
  const rgbMatch = v.match(/rgba?\(([^)]+)\)/i)
  if (!rgbMatch) return fallback
  const parts = rgbMatch[1].split(',').map((p) => Number(p.trim()))
  if (parts.length < 3) return fallback
  const [r, g, b] = parts
  return `#${[r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')}`
}

const adjustColor = (hex, amount) => {
  const raw = hex.replace('#', '')
  const num = parseInt(raw, 16)
  const r = Math.max(0, Math.min(255, (num >> 16) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount))
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

const getThemeColors = () => {
  if (typeof window === 'undefined') {
    return {
      primary: '#2b3a55',
      secondary: '#7c3aed',
      background: '#f7f3ea',
    }
  }
  const styles = getComputedStyle(document.documentElement)
  return {
    primary: parseColor(styles.getPropertyValue('--wp-primary'), '#0C124D'),
    secondary: parseColor(styles.getPropertyValue('--wp-secondary'), '#9B3926'),
    background: parseColor(styles.getPropertyValue('--wp-background'), '#f7f3ea'),
  }
}

export default function StyledGoogleMap({
  title = 'Map',
  address,
  openUrl,
  openLabel = 'Open in Google Maps',
  height = 300,
  apiKey,
}) {
  const mapRef = useRef(null)
  const [status, setStatus] = useState('loading')

  const mapStyles = useMemo(() => {
    const { primary, secondary, background } = getThemeColors()
    return [
      { elementType: 'geometry', stylers: [{ color: background }] },
      { elementType: 'labels.text.fill', stylers: [{ color: primary }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: background }] },
      { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: background }] },
      { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: background }] },
      { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: primary }] },
      { featureType: 'transit', elementType: 'geometry', stylers: [{ color: background }] },
      // Hide all POIs (restaurants, hotels, etc.)
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      // Keep parks visible for context
      { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: background }] },
      // Hide **all** POI icons (restaurants, hotels, parks, natural features, etc.)
      { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
      // OR: Hide only natural‑feature (landscape) icons
      { featureType: 'poi.natural_feature', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

      // Roads
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: primary }] },
      { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: primary }] },
      { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: primary }] },
      { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: primary }] },
      { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: primary }] },

      // Highways
      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: secondary }] },
      { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: secondary }] },

      // --- Kill footpaths / forest routes / dotted trails ---
      // Most of the dotted stuff is under road.local
      { featureType: 'road.local', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
      { featureType: 'road.local', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },

      // If some dotted lines still remain, they can be in "transit" linework:
      //{ featureType: 'transit.line', elementType: 'geometry', stylers: [{ visibility: 'off' }] },

      // Also hide any remaining small road icons
      { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

      { featureType: 'water', elementType: 'geometry', stylers: [{ color: primary }] },
      { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: primary }] },
    ]
  }, [])

  useEffect(() => {
    let isMounted = true
    if (!apiKey || !address || !mapRef.current) {
      setStatus('error')
      return undefined
    }

    setStatus('loading')
    loadGoogleMaps(apiKey)
      .then(() => {
        if (!isMounted) return
        const map = new window.google.maps.Map(mapRef.current, {
          zoom: 15,
          styles: mapStyles,
          backgroundColor: getThemeColors().background,
          disableDefaultUI: true,
          gestureHandling: 'cooperative',
        })
        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ address }, (results, geocodeStatus) => {
          if (!isMounted) return
          if (geocodeStatus === 'OK' && results?.[0]?.geometry?.location) {
            const loc = results[0].geometry.location
            map.setCenter(loc)
            const { secondary } = getThemeColors()
            const svgMarker = {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                <svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M22 38s-12-7.6-16-15.2C2.6 17.2 5.3 10 12 10c4 0 7.2 2.4 10 5.6C24.8 12.4 28 10 32 10c6.7 0 9.4 7.2 6 12.8C34 30.4 22 38 22 38z"
                    fill="${secondary}"
                    stroke="white"
                    stroke-width="3"
                    stroke-linejoin="round"
                  />
                </svg>
              `)}`,
              scaledSize: new window.google.maps.Size(44, 44),
            }
            new window.google.maps.Marker({
              position: loc,
              map,
              icon: svgMarker,
            })
            setStatus('ready')
          } else {
            setStatus('error')
          }
        })
      })
      .catch(() => {
        if (isMounted) setStatus('error')
      })

    return () => {
      isMounted = false
    }
  }, [address, apiKey, mapStyles])

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-sm"
      style={{ backgroundColor: 'var(--wp-background, #F7F3EA)' }}
    >
      {title ? (
        <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl bg-black/40 px-3 py-2 text-sm text-white backdrop-blur">
          {title}
        </div>
      ) : null}

      {openUrl ? (
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-4 top-4 z-10 rounded-xl px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{
            backgroundColor: getThemeColors().secondary,
            boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
          }}
        >
          {openLabel}
        </a>
      ) : null}

      <div ref={mapRef} style={{ height }} className="w-full" />

      {status === 'error' && (
        <div
          className="absolute inset-0 flex items-center justify-center text-sm text-gray-600"
          style={{ backgroundColor: 'var(--wp-background, #F7F3EA)' }}
        >
          Map unavailable. Try opening in Google Maps.
        </div>
      )}
    </div>
  )
}
