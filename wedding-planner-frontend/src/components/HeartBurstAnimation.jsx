import { useEffect, useMemo, useState } from 'react'

function HeartSvg({ color }) {
  return (
    <svg viewBox="0 0 24 24" className="w-full h-full">
      <path
        fill={color}
        d="M12 21s-7.5-4.35-10.2-9.15C.2 8.8 1.5 5.9 4.3 4.7 6.1 3.9 8.2 4.3 9.6 5.7L12 8.1l2.4-2.4c1.4-1.4 3.5-1.8 5.3-1 2.8 1.2 4.1 4.1 2.5 7.15C19.5 16.65 12 21 12 21z"
      />
    </svg>
  )
}

export default function HeartBurstAnimation({ show, onComplete }) {
  const colors = useMemo(
    () => [
      '#4B1F4A', // aubergine
      '#7B1E3A', // bordeaux
    ],
    []
  )

  const [hearts, setHearts] = useState([])
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktop(!!mq.matches)
    update()
    // Safari compatibility: addListener/removeListener
    if (mq.addEventListener) {
      mq.addEventListener('change', update)
      return () => mq.removeEventListener('change', update)
    }
    mq.addListener(update)
    return () => mq.removeListener(update)
  }, [])

  useEffect(() => {
    if (!show) {
      setHearts([])
      return
    }

    const count = 50
    const now = Date.now()
    const items = Array.from({ length: count }).map((_, i) => {
      const duration = 2200 + Math.random() * 1400 // 2.2s - 3.6s
      const delay = Math.random() * 800 // gentle stagger over ~0.8s
      const size = 14 + Math.random() * 26 // 14 - 40px
      const x = Math.random() * 100
      const y = Math.random() * 100 // full screen spread
      const drift = (Math.random() - 0.5) * 26 // -13vw .. 13vw
      const rise = 18 + Math.random() * 38 // 18vh .. 56vh
      return {
        id: `${now}-${i}`,
        x,
        y,
        drift,
        rise,
        size,
        delay,
        duration,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: (Math.random() - 0.5) * 30,
      }
    })

    setHearts(items)

    const maxEnd = Math.max(...items.map((h) => h.delay + h.duration))
    const timer = setTimeout(() => {
      onComplete?.()
    }, maxEnd + 50)

    return () => clearTimeout(timer)
  }, [show, onComplete, colors])

  if (!show || hearts.length === 0) return null

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ zIndex: 9999, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {hearts.map((h) => (
        <div
          key={h.id}
          className="absolute"
          style={{
            left: `${h.x}%`,
            top: `${h.y}%`,
            width: `${h.size}px`,
            height: `${h.size}px`,
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              // Avoid abrupt "pop" on desktop by:
              // 1) applying 0% keyframe during delay (fill-mode: both)
              // 2) keeping transforms inside keyframes (no inline transform mismatch)
              // 3) using a softer desktop keyframe curve
              animation: `${isDesktop ? 'heartFloatDesktop' : 'heartFloat'} ${h.duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${h.delay}ms both`,
              ['--drift']: `${h.drift}vw`,
              ['--rise']: `${h.rise}vh`,
              ['--rot']: `${h.rotation}deg`,
              pointerEvents: 'none',
            }}
          >
            <HeartSvg color={h.color} />
          </div>
        </div>
      ))}
      <style>{`
        @keyframes heartFloat {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) scale(0.4) rotate(var(--rot));
          }
          30% {
            opacity: 1;
            transform: translate3d(0, -6px, 0) scale(1) rotate(var(--rot));
          }
          60% {
            opacity: 0.85;
            transform: translate3d(calc(var(--drift) * 0.7), calc(var(--rise) * -0.7), 0) scale(1.05) rotate(var(--rot));
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--drift), calc(var(--rise) * -1), 0) scale(1.1) rotate(var(--rot));
          }
        }

        /* Desktop-only: a slightly slower, softer fade-in (avoid abrupt "jump in") */
        @keyframes heartFloatDesktop {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) scale(0.4) rotate(var(--rot));
          }
          40% {
            opacity: 1;
            transform: translate3d(0, -8px, 0) scale(1) rotate(var(--rot));
          }
          60% {
            opacity: 0.85;
            transform: translate3d(calc(var(--drift) * 0.7), calc(var(--rise) * -0.7), 0) scale(1.05) rotate(var(--rot));
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--drift), calc(var(--rise) * -1), 0) scale(1.1) rotate(var(--rot));
          }
        }
      `}</style>
    </div>
  )
}

