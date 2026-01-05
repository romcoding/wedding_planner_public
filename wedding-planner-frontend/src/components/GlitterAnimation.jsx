import { useEffect, useState } from 'react'

export default function GlitterAnimation({ show, onComplete }) {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (!show) {
      setParticles([])
      return
    }

    // Create more sparkles for extra glittery effect
    const newParticles = []
    const particleCount = 150 // Increased from 50 to 150
    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 1.0, // Longer delay range
        duration: 1.5 + Math.random() * 2.5, // Longer duration
        size: 3 + Math.random() * 10, // Larger size range
        rotation: Math.random() * 360,
        sparkleType: Math.random() > 0.5 ? 'star' : 'circle', // Mix of stars and circles
      })
    }
    setParticles(newParticles)

    // Call onComplete after animation
    const timer = setTimeout(() => {
      if (onComplete) onComplete()
    }, 3000)

    return () => clearTimeout(timer)
  }, [show, onComplete])

  if (!show || particles.length === 0) return null

  return (
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animation: `sparkle ${particle.duration}s ease-out ${particle.delay}s forwards`,
            transform: `rotate(${particle.rotation}deg)`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            zIndex: 9999,
          }}
        >
          {particle.sparkleType === 'star' ? (
            <div 
              className="w-full h-full"
              style={{
                background: `radial-gradient(circle, 
                  rgba(255, 255, 255, 0.9) 0%, 
                  rgba(255, 215, 0, 0.8) 30%, 
                  rgba(255, 192, 203, 0.6) 60%, 
                  transparent 100%)`,
                clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
                animation: `sparkle ${particle.duration}s ease-out ${particle.delay}s forwards, twinkle ${particle.duration * 0.3}s ease-in-out ${particle.delay}s infinite`,
                filter: 'drop-shadow(0 0 4px rgba(255, 215, 0, 0.8))',
              }}
            />
          ) : (
            <div 
              className="w-full h-full rounded-full"
              style={{
                background: `radial-gradient(circle, 
                  rgba(255, 255, 255, 1) 0%, 
                  rgba(255, 215, 0, 0.9) 20%, 
                  rgba(255, 192, 203, 0.7) 50%, 
                  rgba(186, 85, 211, 0.5) 80%, 
                  transparent 100%)`,
                animation: `sparkle ${particle.duration}s ease-out ${particle.delay}s forwards, twinkle ${particle.duration * 0.3}s ease-in-out ${particle.delay}s infinite`,
                boxShadow: '0 0 10px rgba(255, 215, 0, 0.8), 0 0 20px rgba(255, 192, 203, 0.6), 0 0 30px rgba(186, 85, 211, 0.4)',
              }}
            />
          )}
        </div>
      ))}
      <style>{`
        @keyframes sparkle {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0) rotate(0deg);
          }
          20% {
            opacity: 0.8;
            transform: translateY(-10px) scale(0.8) rotate(90deg);
          }
          50% {
            opacity: 1;
            transform: translateY(-40px) scale(1.2) rotate(180deg);
          }
          80% {
            opacity: 0.9;
            transform: translateY(-80px) scale(1) rotate(270deg);
          }
          100% {
            opacity: 0;
            transform: translateY(-150px) scale(0.3) rotate(360deg);
          }
        }
        @keyframes twinkle {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.3);
          }
        }
      `}</style>
    </div>
  )
}

