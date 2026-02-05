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
      }, 700) // Match the CSS transition duration
      return () => clearTimeout(timer)
    }
  }, [isLoading, onFadeComplete])

  if (!isVisible) return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-700 ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#F7F3EA' }}
      aria-label="Loading"
      role="status"
    >
      {/* Animated Heart Container - with floating movement */}
      <div 
        className="relative"
        style={{
          animation: 'heartFloat 3s ease-in-out infinite',
        }}
      >
        {/* Soft glow effect */}
        <div
          className="absolute -inset-8 rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, var(--wp-primary, #EC4899) 0%, transparent 70%)',
            animation: 'glowPulse 2s ease-in-out infinite',
          }}
        />
        
        {/* Main Heart SVG */}
        <svg
          viewBox="0 0 24 24"
          className="w-24 h-24 md:w-32 md:h-32 relative z-10"
          style={{
            animation: 'heartBeat 1s ease-in-out infinite',
            filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.2))',
          }}
        >
          <defs>
            <linearGradient id="heartLoaderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--wp-primary, #EC4899)" />
              <stop offset="100%" stopColor="var(--wp-secondary, #7C3AED)" />
            </linearGradient>
          </defs>
          <path
            fill="url(#heartLoaderGradient)"
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          />
        </svg>

        {/* Small floating hearts around */}
        <div className="absolute -top-4 -left-6 opacity-60" style={{ animation: 'floatSmall 2.5s ease-in-out infinite 0.2s' }}>
          <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ fill: 'var(--wp-primary, #EC4899)' }}>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
        <div className="absolute -top-2 -right-8 opacity-50" style={{ animation: 'floatSmall 2.8s ease-in-out infinite 0.5s' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ fill: 'var(--wp-secondary, #7C3AED)' }}>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
        <div className="absolute -bottom-2 -right-4 opacity-40" style={{ animation: 'floatSmall 3s ease-in-out infinite 0.8s' }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ fill: 'var(--wp-primary, #EC4899)' }}>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
        <div className="absolute bottom-0 -left-8 opacity-50" style={{ animation: 'floatSmall 2.6s ease-in-out infinite 1s' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ fill: 'var(--wp-secondary, #7C3AED)' }}>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      </div>

      {/* Loading text */}
      <div
        className="mt-8 text-base md:text-lg font-medium tracking-wide"
        style={{ 
          color: 'var(--wp-primary, #EC4899)',
          animation: 'fadeInOut 1.5s ease-in-out infinite',
        }}
      >
        Loading...
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes heartBeat {
          0%, 100% {
            transform: scale(1);
          }
          14% {
            transform: scale(1.2);
          }
          28% {
            transform: scale(1);
          }
          42% {
            transform: scale(1.15);
          }
          56% {
            transform: scale(1);
          }
        }

        @keyframes heartFloat {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          25% {
            transform: translateY(-8px) rotate(2deg);
          }
          50% {
            transform: translateY(-4px) rotate(0deg);
          }
          75% {
            transform: translateY(-10px) rotate(-2deg);
          }
        }

        @keyframes floatSmall {
          0%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0.4;
          }
          50% {
            transform: translateY(-12px) scale(1.1);
            opacity: 0.7;
          }
        }

        @keyframes glowPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.5;
          }
        }

        @keyframes fadeInOut {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
