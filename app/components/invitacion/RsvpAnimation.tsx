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
