import { useEffect, useState } from 'react'

export default function GlitterAnimation({ show, onComplete }) {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (!show) {
      setParticles([])
      return
    }

    // Create more sparkles for extra glittery effect with multiple colors
    const newParticles = []
    const particleCount = 150
    const colors = ['gold', 'roseGold', 'silver'] // Three color themes
    
    for (let i = 0; i < particleCount; i++) {
      const colorTheme = colors[Math.floor(Math.random() * colors.length)]
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 1.0,
        duration: 1.5 + Math.random() * 2.5,
        size: 8 + Math.random() * 18, // Bigger: 8-26px (was 3-13px)
        rotation: Math.random() * 360,
        sparkleType: Math.random() > 0.5 ? 'star' : 'circle',
        colorTheme: colorTheme,
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
        pointerEvents: 'none',
        animation: 'fadeIn 0.5s ease-in',
        opacity: show ? 1 : 0,
        transition: 'opacity 0.3s ease-out'
      }}
    >
      {particles.map((particle) => {
        // Define color schemes for each theme
        const colorSchemes = {
          gold: {
            star: {
              background: `radial-gradient(circle, 
                rgba(255, 255, 255, 0.95) 0%, 
                rgba(255, 215, 0, 0.9) 25%, 
                rgba(255, 200, 0, 0.7) 50%, 
                rgba(255, 180, 0, 0.5) 75%, 
                transparent 100%)`,
              filter: 'drop-shadow(0 0 6px rgba(255, 215, 0, 1)) drop-shadow(0 0 12px rgba(255, 200, 0, 0.8))',
            },
            circle: {
              background: `radial-gradient(circle, 
                rgba(255, 255, 255, 1) 0%, 
                rgba(255, 215, 0, 0.95) 20%, 
                rgba(255, 200, 0, 0.8) 50%, 
                rgba(255, 180, 0, 0.6) 80%, 
                transparent 100%)`,
              boxShadow: '0 0 15px rgba(255, 215, 0, 1), 0 0 25px rgba(255, 200, 0, 0.8), 0 0 35px rgba(255, 180, 0, 0.6)',
            },
          },
          roseGold: {
            star: {
              background: `radial-gradient(circle, 
                rgba(255, 255, 255, 0.95) 0%, 
                rgba(229, 194, 152, 0.9) 25%, 
                rgba(184, 115, 51, 0.7) 50%, 
                rgba(205, 127, 50, 0.5) 75%, 
                transparent 100%)`,
              filter: 'drop-shadow(0 0 6px rgba(229, 194, 152, 1)) drop-shadow(0 0 12px rgba(184, 115, 51, 0.8))',
            },
            circle: {
              background: `radial-gradient(circle, 
                rgba(255, 255, 255, 1) 0%, 
                rgba(229, 194, 152, 0.95) 20%, 
                rgba(184, 115, 51, 0.8) 50%, 
                rgba(205, 127, 50, 0.6) 80%, 
                transparent 100%)`,
              boxShadow: '0 0 15px rgba(229, 194, 152, 1), 0 0 25px rgba(184, 115, 51, 0.8), 0 0 35px rgba(205, 127, 50, 0.6)',
            },
          },
          silver: {
            star: {
              background: `radial-gradient(circle, 
                rgba(255, 255, 255, 0.95) 0%, 
                rgba(192, 192, 192, 0.9) 25%, 
                rgba(169, 169, 169, 0.7) 50%, 
                rgba(128, 128, 128, 0.5) 75%, 
                transparent 100%)`,
              filter: 'drop-shadow(0 0 6px rgba(192, 192, 192, 1)) drop-shadow(0 0 12px rgba(169, 169, 169, 0.8))',
            },
            circle: {
              background: `radial-gradient(circle, 
                rgba(255, 255, 255, 1) 0%, 
                rgba(192, 192, 192, 0.95) 20%, 
                rgba(169, 169, 169, 0.8) 50%, 
                rgba(128, 128, 128, 0.6) 80%, 
                transparent 100%)`,
              boxShadow: '0 0 15px rgba(192, 192, 192, 1), 0 0 25px rgba(169, 169, 169, 0.8), 0 0 35px rgba(128, 128, 128, 0.6)',
            },
          },
        }
        
        const colors = colorSchemes[particle.colorTheme]
        const style = particle.sparkleType === 'star' ? colors.star : colors.circle
        
        return (
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
                  background: style.background,
                  clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
                  animation: `sparkle ${particle.duration}s ease-out ${particle.delay}s forwards, twinkle ${particle.duration * 0.3}s ease-in-out ${particle.delay}s infinite`,
                  filter: style.filter,
                }}
              />
            ) : (
              <div 
                className="w-full h-full rounded-full"
                style={{
                  background: style.background,
                  animation: `sparkle ${particle.duration}s ease-out ${particle.delay}s forwards, twinkle ${particle.duration * 0.3}s ease-in-out ${particle.delay}s infinite`,
                  boxShadow: style.boxShadow,
                }}
              />
            )}
          </div>
        )
      })}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes sparkle {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0) rotate(0deg);
          }
          5% {
            opacity: 0.1;
            transform: translateY(-2px) scale(0.2) rotate(22.5deg);
          }
          10% {
            opacity: 0.4;
            transform: translateY(-5px) scale(0.5) rotate(45deg);
          }
          15% {
            opacity: 0.6;
            transform: translateY(-8px) scale(0.7) rotate(67.5deg);
          }
          20% {
            opacity: 0.8;
            transform: translateY(-10px) scale(0.9) rotate(90deg);
          }
          25% {
            opacity: 0.9;
            transform: translateY(-15px) scale(1) rotate(112.5deg);
          }
          30% {
            opacity: 0.95;
            transform: translateY(-20px) scale(1.05) rotate(135deg);
          }
          40% {
            opacity: 1;
            transform: translateY(-30px) scale(1.1) rotate(162deg);
          }
          50% {
            opacity: 1;
            transform: translateY(-40px) scale(1.2) rotate(180deg);
          }
          60% {
            opacity: 1;
            transform: translateY(-50px) scale(1.15) rotate(198deg);
          }
          70% {
            opacity: 0.95;
            transform: translateY(-60px) scale(1.1) rotate(225deg);
          }
          80% {
            opacity: 0.8;
            transform: translateY(-80px) scale(0.95) rotate(252deg);
          }
          85% {
            opacity: 0.6;
            transform: translateY(-100px) scale(0.8) rotate(270deg);
          }
          90% {
            opacity: 0.4;
            transform: translateY(-115px) scale(0.6) rotate(292.5deg);
          }
          95% {
            opacity: 0.2;
            transform: translateY(-130px) scale(0.4) rotate(315deg);
          }
          100% {
            opacity: 0;
            transform: translateY(-150px) scale(0.1) rotate(360deg);
          }
        }
        @keyframes twinkle {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.4);
          }
        }
      `}</style>
    </div>
  )
}

