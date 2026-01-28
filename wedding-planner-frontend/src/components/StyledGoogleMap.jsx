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
    primary: parseColor(styles.getPropertyValue('--wp-primary'), '#2b3a55'),
    secondary: parseColor(styles.getPropertyValue('--wp-secondary'), '#7c3aed'),
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
      { elementType: 'geometry', stylers: [{ color: adjustColor(background, 4) }] },
      { elementType: 'labels.text.fill', stylers: [{ color: adjustColor(primary, -10) }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: adjustColor(background, 12) }] },
      { featureType: 'poi', elementType: 'geometry', stylers: [{ color: adjustColor(background, -4) }] },
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: adjustColor(background, 10) }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: adjustColor(primary, 40) }] },
      { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: adjustColor(primary, 20) }] },
      { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: adjustColor(primary, -20) }] },
      { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: adjustColor(primary, 25) }] },
      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: adjustColor(secondary, 10) }] },
      { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: adjustColor(secondary, -10) }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: adjustColor(secondary, 60) }] },
      { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: adjustColor(primary, -20) }] },
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
          disableDefaultUI: true,
          gestureHandling: 'cooperative',
        })
        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ address }, (results, geocodeStatus) => {
          if (!isMounted) return
          if (geocodeStatus === 'OK' && results?.[0]?.geometry?.location) {
            map.setCenter(results[0].geometry.location)
            new window.google.maps.Marker({
              position: results[0].geometry.location,
              map,
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
    <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-white/60 shadow-sm">
      {title ? (
        <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl bg-black/40 px-3 py-2 text-sm text-white backdrop-blur">
          {title}
        </div>
      ) : null}

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

      <div ref={mapRef} style={{ height }} className="w-full" />

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-gray-600">
          Map unavailable. Try opening in Google Maps.
        </div>
      )}
    </div>
  )
}
