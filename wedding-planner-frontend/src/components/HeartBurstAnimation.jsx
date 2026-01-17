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

    const count = 40
    const now = Date.now()
    const items = Array.from({ length: count }).map((_, i) => {
      const duration = 900 + Math.random() * 700 // 0.9s - 1.6s
      const delay = Math.random() * 120 // small stagger
      const size = 12 + Math.random() * 20 // 12 - 32px
      const x = Math.random() * 100
      const y = 70 + Math.random() * 25 // cluster lower part of screen
      const drift = (Math.random() - 0.5) * 20 // -10vw .. 10vw
      return {
        id: `${now}-${i}`,
        x,
        y,
        drift,
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
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9999 }}>
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
          }}
        >
          <HeartSvg color={h.color} />
        </div>
      ))}
      <style>{`
        @keyframes heartFloat {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.85) rotate(0deg);
          }
          12% {
            opacity: 0.95;
            transform: translate(-50%, -55%) scale(1) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--drift)), -95%) scale(1.1) rotate(0deg);
          }
        }
      `}</style>
    </div>
  )
}

