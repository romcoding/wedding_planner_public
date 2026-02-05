import { useState, useEffect } from 'react'

export default function HeartLoader({ isLoading = true, onFadeComplete }) {
  const [isVisible, setIsVisible] = useState(true)
  const [isFading, setIsFading] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      // Start fade out
      setIsFading(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
        onFadeComplete?.()
      }, 600) // Match the CSS transition duration
      return () => clearTimeout(timer)
    }
  }, [isLoading, onFadeComplete])

  if (!isVisible) return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#F7F3EA' }}
      aria-label="Loading"
      role="status"
    >
      {/* Animated Heart */}
      <div className="relative">
        {/* Glow effect behind heart */}
        <div
          className="absolute inset-0 blur-xl opacity-40 animate-pulse"
          style={{
            background: 'radial-gradient(circle, var(--wp-primary) 0%, var(--wp-secondary) 50%, transparent 70%)',
            transform: 'scale(1.5)',
          }}
        />
        
        {/* Heart SVG with animation */}
        <svg
          viewBox="0 0 24 24"
          className="w-20 h-20 md:w-28 md:h-28 relative z-10"
          style={{
            animation: 'heartPulse 1.2s ease-in-out infinite',
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))',
          }}
        >
          <defs>
            <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: 'var(--wp-primary)' }}>
                <animate
                  attributeName="stop-color"
                  values="var(--wp-primary); var(--wp-secondary); var(--wp-primary)"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="100%" style={{ stopColor: 'var(--wp-secondary)' }}>
                <animate
                  attributeName="stop-color"
                  values="var(--wp-secondary); var(--wp-primary); var(--wp-secondary)"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </stop>
            </linearGradient>
          </defs>
          <path
            fill="url(#heartGradient)"
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          />
        </svg>
      </div>

      {/* Loading text */}
      <div
        className="mt-6 text-sm md:text-base font-medium tracking-wide animate-pulse"
        style={{ color: 'var(--wp-primary)' }}
      >
        Loading...
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes heartPulse {
          0%, 100% {
            transform: scale(1) rotate(0deg);
          }
          15% {
            transform: scale(1.15) rotate(-2deg);
          }
          30% {
            transform: scale(1) rotate(0deg);
          }
          45% {
            transform: scale(1.1) rotate(2deg);
          }
          60% {
            transform: scale(1) rotate(0deg);
          }
        }
      `}</style>
    </div>
  )
}
