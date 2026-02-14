import { useState, useEffect } from 'react'

export default function GuestLogin() {
  const [showMessage, setShowMessage] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowMessage(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: 'var(--wp-background, #F7F3EA)' }}
    >
      {/* Heart animation */}
      <div
        className="relative mb-8"
        style={{ animation: 'heartFloat 3s ease-in-out infinite' }}
      >
        {/* Soft glow */}
        <div
          className="absolute -inset-8 rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, var(--wp-primary, #EC4899) 0%, transparent 70%)',
            animation: 'glowPulse 2s ease-in-out infinite',
          }}
        />
        {/* Main heart */}
        <svg
          viewBox="0 0 24 24"
          className="w-20 h-20 md:w-24 md:h-24 relative z-10"
          style={{
            animation: 'heartBeat 1s ease-in-out infinite',
            filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.15))',
          }}
        >
          <defs>
            <linearGradient id="loginHeartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--wp-primary, #EC4899)" />
              <stop offset="100%" stopColor="var(--wp-secondary, #7C3AED)" />
            </linearGradient>
          </defs>
          <path
            fill="url(#loginHeartGradient)"
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          />
        </svg>
        {/* Small floating hearts */}
        <div className="absolute -top-3 -left-5 opacity-50" style={{ animation: 'floatSmall 2.5s ease-in-out infinite 0.2s' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ fill: 'var(--wp-primary, #EC4899)' }}>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
        <div className="absolute -top-1 -right-6 opacity-40" style={{ animation: 'floatSmall 2.8s ease-in-out infinite 0.5s' }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ fill: 'var(--wp-secondary, #7C3AED)' }}>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
        <div className="absolute -bottom-1 -left-6 opacity-40" style={{ animation: 'floatSmall 2.6s ease-in-out infinite 1s' }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ fill: 'var(--wp-secondary, #7C3AED)' }}>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      </div>

      {/* Message card - fades in after heart animation */}
      <div
        className="max-w-md w-full text-center transition-all duration-700 ease-out"
        style={{
          opacity: showMessage ? 1 : 0,
          transform: showMessage ? 'translateY(0)' : 'translateY(12px)',
        }}
      >
        <h2
          className="text-2xl md:text-3xl font-bold mb-4"
          style={{ color: 'var(--wp-primary, #4B1F4A)' }}
        >
          Zugang nur mit Hochzeitspass
        </h2>

        <div
          className="rounded-2xl border p-6 md:p-8 space-y-4"
          style={{
            backgroundColor: 'rgba(255,255,255,0.7)',
            borderColor: 'var(--wp-primary, #EC4899)',
            borderWidth: '1px',
          }}
        >
          <p className="text-base md:text-lg leading-relaxed" style={{ color: 'var(--wp-primary, #4B1F4A)' }}>
            Diese Seite ist nur über euren persönlichen Hochzeitspass erreichbar.
            Ihr habt den Link in eurer Einladung erhalten.
          </p>

          <p className="text-sm md:text-base leading-relaxed" style={{ color: 'var(--wp-primary, #4B1F4A)', opacity: 0.75 }}>
            Falls ihr Fragen habt oder euer Link nicht funktioniert,
            meldet euch bitte direkt beim Brautpaar &mdash; wir helfen euch gerne weiter!
          </p>
        </div>
      </div>

      {/* Reuse keyframes from HeartLoader */}
      <style>{`
        @keyframes heartBeat {
          0%, 100% { transform: scale(1); }
          14% { transform: scale(1.2); }
          28% { transform: scale(1); }
          42% { transform: scale(1.15); }
          56% { transform: scale(1); }
        }
        @keyframes heartFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-8px) rotate(2deg); }
          50% { transform: translateY(-4px) rotate(0deg); }
          75% { transform: translateY(-10px) rotate(-2deg); }
        }
        @keyframes floatSmall {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
          50% { transform: translateY(-12px) scale(1.1); opacity: 0.7; }
        }
        @keyframes glowPulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.2); opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
