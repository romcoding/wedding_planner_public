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

  useEffect(() => {
    if (!show) {
      setHearts([])
      return
    }

    const count = 70
    const now = Date.now()
    const items = Array.from({ length: count }).map((_, i) => {
      const duration = 1800 + Math.random() * 1200 // 1.8s - 3.0s
      const delay = Math.random() * 250 // gentle stagger
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
            transform: `translate(-50%, -50%) rotate(${h.rotation}deg)`,
            animation: `heartFloat ${h.duration}ms ease-out ${h.delay}ms forwards`,
            // pass drift via CSS var
            ['--drift']: `${h.drift}vw`,
            ['--rise']: `${h.rise}vh`,
            pointerEvents: 'none',
          }}
        >
          <HeartSvg color={h.color} />
        </div>
      ))}
      <style>{`
        @keyframes heartFloat {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.75) rotate(0deg);
          }
          25% {
            opacity: 1;
            transform: translate(-50%, -56%) scale(1) rotate(0deg);
          }
          70% {
            opacity: 0.85;
            transform: translate(calc(-50% + calc(var(--drift) * 0.7)), calc(-50% - calc(var(--rise) * 0.7))) scale(1.05) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--drift)), calc(-50% - var(--rise))) scale(1.1) rotate(0deg);
          }
        }
      `}</style>
    </div>
  )
}

