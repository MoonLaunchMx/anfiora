'use client'
import { useEffect } from 'react'
import type { SiAnimId, NoAnimId } from '@/lib/invite/theme'

type Kind = 'si' | 'no'

const CONFETI_COLORS = ['var(--inv-acento)', '#f4c430', '#ff6b9d', '#6bc1ff', '#39ff88']

function range(n: number) {
  return Array.from({ length: n }, (_, i) => i)
}

function Particles({ animId }: { animId: SiAnimId | NoAnimId }) {
  switch (animId) {
    case 'confeti':
      return (
        <>
          {range(56).map(i => (
            <span
              key={i}
              className="inv-anim-confeti"
              style={{
                left: `${(i * 1.8 + (i % 5) * 3) % 100}%`,
                width: 8 + (i % 5),
                height: 12 + (i % 6),
                background: CONFETI_COLORS[i % CONFETI_COLORS.length],
                animationDelay: `${(i % 8) * 0.07}s`,
                animationDuration: `${1.7 + (i % 5) * 0.22}s`,
              }}
            />
          ))}
        </>
      )
    case 'corazones':
      return (
        <>
          {range(24).map(i => (
            <span
              key={i}
              className="inv-anim-corazon"
              style={{
                left: `${(i * 4.1 + 3) % 96}%`,
                animationDelay: `${(i % 8) * 0.14}s`,
                animationDuration: `${2.1 + (i % 4) * 0.35}s`,
                ['--s' as string]: 0.9 + (i % 4) * 0.28,
              }}
            />
          ))}
        </>
      )
    case 'globos':
      return (
        <>
          {range(16).map(i => (
            <span
              key={i}
              className="inv-anim-globo"
              style={{
                left: `${(i * 6 + 3) % 94}%`,
                background: CONFETI_COLORS[i % CONFETI_COLORS.length],
                animationDelay: `${(i % 6) * 0.16}s`,
                animationDuration: `${2.8 + (i % 4) * 0.35}s`,
                ['--s' as string]: 0.95 + (i % 3) * 0.22,
              }}
            />
          ))}
        </>
      )
    case 'fuegos':
      return (
        <>
          {[
            { top: '34%', left: '50%', delay: 0, color: 'var(--inv-acento)' },
            { top: '24%', left: '24%', delay: 0.15, color: '#ff6b9d' },
            { top: '22%', left: '74%', delay: 0.3, color: '#6bc1ff' },
            { top: '46%', left: '32%', delay: 0.55, color: '#f4c430' },
            { top: '44%', left: '70%', delay: 0.7, color: '#39ff88' },
            { top: '30%', left: '14%', delay: 0.95, color: '#ff6b9d' },
            { top: '30%', left: '86%', delay: 1.1, color: 'var(--inv-acento)' },
          ].map((f, i) => (
            <span key={i} className="inv-anim-fuego" style={{ top: f.top, left: f.left, ['--d' as string]: `${f.delay}s`, ['--c' as string]: f.color }}>
              {range(14).map(j => (
                <i key={j} style={{ ['--a' as string]: `${j * (360 / 14)}deg` }} />
              ))}
            </span>
          ))}
        </>
      )
    case 'lluvia':
      return (
        <>
          {range(48).map(i => (
            <span
              key={i}
              className="inv-anim-lluvia"
              style={{
                left: `${(i * 2.1 + (i % 7)) % 100}%`,
                animationDelay: `${(i % 12) * 0.06}s`,
                animationDuration: `${0.65 + (i % 4) * 0.14}s`,
              }}
            />
          ))}
        </>
      )
    case 'champan':
      return (
        <>
          {range(36).map(i => (
            <span
              key={i}
              className="inv-anim-burbuja"
              style={{
                left: `${(i * 2.9 + (i % 5)) % 100}%`,
                animationDelay: `${(i % 10) * 0.13}s`,
                animationDuration: `${1.8 + (i % 5) * 0.3}s`,
                ['--s' as string]: 0.5 + (i % 4) * 0.3,
              }}
            />
          ))}
        </>
      )
    case 'estrellas':
      return (
        <>
          {range(24).map(i => (
            <span
              key={i}
              className="inv-anim-estrella"
              style={{
                left: `${(i * 4.1 + 3) % 96}%`,
                animationDelay: `${(i % 9) * 0.11}s`,
                animationDuration: `${1.9 + (i % 5) * 0.25}s`,
                ['--s' as string]: 0.7 + (i % 4) * 0.3,
              }}
            />
          ))}
        </>
      )
    case 'emojis': {
      const EM = ['🎉', '🥳', '🎊', '✨', '❤️', '🙌']
      return (
        <>
          {range(26).map(i => (
            <span
              key={i}
              className="inv-anim-emoji"
              style={{
                left: `${(i * 3.6 + 2) % 96}%`,
                animationDelay: `${(i % 9) * 0.1}s`,
                animationDuration: `${2 + (i % 5) * 0.3}s`,
                fontSize: `${18 + (i % 4) * 6}px`,
              }}
            >
              {EM[i % EM.length]}
            </span>
          ))}
        </>
      )
    }
    case 'arcade':
      return (
        <>
          {range(44).map(i => (
            <span
              key={i}
              className="inv-anim-pixel"
              style={{
                left: `${(i * 2.3 + (i % 6)) % 100}%`,
                background: CONFETI_COLORS[i % CONFETI_COLORS.length],
                animationDelay: `${(i % 8) * 0.07}s`,
                animationDuration: `${1.5 + (i % 5) * 0.2}s`,
              }}
            />
          ))}
        </>
      )
    case 'jackpot':
      return (
        <>
          {range(32).map(i => (
            <span
              key={i}
              className="inv-anim-moneda"
              style={{
                left: `${(i * 3.1 + (i % 5)) % 100}%`,
                animationDelay: `${(i % 9) * 0.09}s`,
                animationDuration: `${1.6 + (i % 5) * 0.22}s`,
              }}
            />
          ))}
        </>
      )
    case 'bola-disco':
      return (
        <>
          <span className="inv-anim-discoball" />
          {[
            { top: '22%', left: '16%', c: '#ff2e97', d: '0s' },
            { top: '30%', left: '78%', c: '#39ff88', d: '0.5s' },
            { top: '54%', left: '26%', c: '#2ee0ff', d: '1s' },
            { top: '62%', left: '68%', c: '#ffd85e', d: '0.3s' },
            { top: '40%', left: '50%', c: '#ff2e97', d: '0.8s' },
            { top: '70%', left: '40%', c: '#39ff88', d: '1.3s' },
            { top: '18%', left: '46%', c: '#2ee0ff', d: '1.6s' },
            { top: '48%', left: '86%', c: '#ffd85e', d: '1.1s' },
          ].map((f, i) => (
            <span key={i} className="inv-disco-dot" style={{ top: f.top, left: f.left, animationDelay: f.d, ['--c' as string]: f.c }} />
          ))}
        </>
      )
    case 'nevada':
      return (
        <>
          {range(42).map(i => (
            <span
              key={i}
              className="inv-anim-nieve"
              style={{
                left: `${(i * 2.4 + (i % 7)) % 100}%`,
                animationDelay: `${(i % 12) * 0.12}s`,
                animationDuration: `${3 + (i % 5) * 0.5}s`,
                ['--s' as string]: 0.5 + (i % 4) * 0.3,
              }}
            />
          ))}
        </>
      )
    case 'corazon-roto':
      return <span className="inv-anim-roto">💔</span>
    case 'matorral':
      return (
        <span className="inv-anim-matorral">
          <span className="inv-anim-matorral-bola" />
        </span>
      )
    case 'luces-off':
      return <span className="inv-anim-apagon" />
    case 'scratch':
      return <span className="inv-anim-vinilo" />
    case 'calido':
    default:
      return <span className="inv-anim-glow" />
  }
}

export default function RsvpAnimation({
  open,
  kind,
  animId,
  message,
  onDone,
  styleVars,
}: {
  open: boolean
  kind: Kind
  animId: SiAnimId | NoAnimId
  message: string
  onDone?: () => void
  styleVars?: React.CSSProperties
}) {
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => onDone?.(), 3200)
    return () => clearTimeout(t)
  }, [open, onDone])

  if (!open) return null

  return (
    <div className={`inv-anim-overlay inv-anim-${kind}`} style={styleVars} aria-hidden="true">
      <div className="inv-anim-layer">
        <Particles animId={animId} />
      </div>
      <p className="inv-anim-msg" style={{ fontFamily: 'var(--inv-font-titulo)' }}>
        {message}
      </p>
    </div>
  )
}
