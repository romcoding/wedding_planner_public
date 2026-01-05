import { useEffect, useState } from 'react'

export default function GlitterAnimation({ show, onComplete }) {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (!show) {
      setParticles([])
      return
    }

    // Create sparkles
    const newParticles = []
    for (let i = 0; i < 50; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1 + Math.random() * 1.5,
        size: 4 + Math.random() * 6,
        rotation: Math.random() * 360,
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
          <div 
            className="w-full h-full bg-gradient-to-br from-yellow-300 via-pink-300 to-purple-300 rounded-full shadow-lg"
            style={{
              animation: `sparkle ${particle.duration}s ease-out ${particle.delay}s forwards`,
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes sparkle {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: translateY(-20px) scale(1) rotate(180deg);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) scale(0.5) rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}

