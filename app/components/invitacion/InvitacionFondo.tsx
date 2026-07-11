'use client'
import type { Theme } from '@/lib/invite/theme'

type ConfetiPza = { left: number; delay: number; dur: number; color: string; w: number; h: number }

const CONFETI: ConfetiPza[] = [
  { left: 4, delay: 0, dur: 5.0, color: 'var(--inv-acento)', w: 8, h: 12 },
  { left: 10, delay: 1.8, dur: 6.2, color: '#f4c430', w: 7, h: 10 },
  { left: 16, delay: 3.1, dur: 5.5, color: '#ff6b9d', w: 9, h: 9 },
  { left: 22, delay: 0.7, dur: 6.8, color: 'var(--inv-acento)', w: 7, h: 13 },
  { left: 28, delay: 2.6, dur: 5.2, color: '#6bc1ff', w: 8, h: 8 },
  { left: 34, delay: 4.3, dur: 6.5, color: '#f4c430', w: 7, h: 11 },
  { left: 40, delay: 1.2, dur: 5.8, color: '#ff6b9d', w: 9, h: 10 },
  { left: 46, delay: 3.6, dur: 6.9, color: 'var(--inv-acento)', w: 7, h: 12 },
  { left: 52, delay: 0.4, dur: 5.3, color: '#6bc1ff', w: 8, h: 9 },
  { left: 58, delay: 2.2, dur: 6.4, color: '#f4c430', w: 7, h: 13 },
  { left: 64, delay: 4.0, dur: 5.6, color: '#ff6b9d', w: 9, h: 8 },
  { left: 70, delay: 1.5, dur: 6.7, color: 'var(--inv-acento)', w: 7, h: 11 },
  { left: 76, delay: 3.3, dur: 5.1, color: '#6bc1ff', w: 8, h: 10 },
  { left: 82, delay: 0.9, dur: 6.1, color: '#f4c430', w: 7, h: 12 },
  { left: 88, delay: 2.9, dur: 5.7, color: '#ff6b9d', w: 9, h: 9 },
  { left: 94, delay: 4.5, dur: 6.6, color: 'var(--inv-acento)', w: 7, h: 13 },
  { left: 7, delay: 2.4, dur: 6.0, color: '#6bc1ff', w: 8, h: 8 },
  { left: 19, delay: 4.7, dur: 5.4, color: 'var(--inv-acento)', w: 7, h: 11 },
  { left: 31, delay: 1.0, dur: 6.6, color: '#f4c430', w: 9, h: 10 },
  { left: 43, delay: 3.8, dur: 5.9, color: '#ff6b9d', w: 7, h: 12 },
  { left: 55, delay: 0.2, dur: 6.3, color: '#6bc1ff', w: 8, h: 9 },
  { left: 67, delay: 2.7, dur: 5.5, color: '#f4c430', w: 7, h: 13 },
  { left: 79, delay: 5.0, dur: 6.8, color: 'var(--inv-acento)', w: 9, h: 8 },
  { left: 91, delay: 1.7, dur: 5.2, color: '#ff6b9d', w: 7, h: 11 },
  { left: 13, delay: 3.5, dur: 6.5, color: 'var(--inv-acento)', w: 8, h: 10 },
  { left: 37, delay: 0.6, dur: 5.8, color: '#6bc1ff', w: 7, h: 12 },
  { left: 61, delay: 4.2, dur: 6.2, color: '#f4c430', w: 9, h: 9 },
  { left: 85, delay: 2.1, dur: 5.6, color: '#ff6b9d', w: 7, h: 13 },
]

type PartPos = { left: number; delay: number; dur: number; scale: number }

const PARTICLES: PartPos[] = [
  { left: 5, delay: 0, dur: 9, scale: 1 },
  { left: 14, delay: 2.4, dur: 11, scale: 0.8 },
  { left: 23, delay: 4.1, dur: 8.5, scale: 1.15 },
  { left: 32, delay: 1.2, dur: 10.5, scale: 0.9 },
  { left: 41, delay: 3.6, dur: 9.5, scale: 1.05 },
  { left: 50, delay: 5.2, dur: 8, scale: 0.75 },
  { left: 59, delay: 0.6, dur: 11.5, scale: 1.2 },
  { left: 68, delay: 2.9, dur: 9, scale: 0.85 },
  { left: 77, delay: 4.7, dur: 10, scale: 1 },
  { left: 86, delay: 1.7, dur: 8.8, scale: 1.1 },
  { left: 93, delay: 3.3, dur: 11, scale: 0.8 },
  { left: 10, delay: 6.0, dur: 9.6, scale: 0.95 },
  { left: 37, delay: 5.5, dur: 10.2, scale: 1.15 },
  { left: 64, delay: 6.4, dur: 8.6, scale: 0.9 },
  { left: 82, delay: 5.8, dur: 11.2, scale: 1.05 },
]

const BOKEH: PartPos[] = [
  { left: 8, delay: 0, dur: 8, scale: 1.2 },
  { left: 20, delay: 1.2, dur: 9.5, scale: 1.8 },
  { left: 33, delay: 2.4, dur: 8.5, scale: 1 },
  { left: 47, delay: 0.6, dur: 10, scale: 1.5 },
  { left: 60, delay: 1.8, dur: 9, scale: 1.1 },
  { left: 72, delay: 3, dur: 8, scale: 2 },
  { left: 85, delay: 0.9, dur: 9.8, scale: 1.3 },
  { left: 93, delay: 2.1, dur: 8.8, scale: 0.9 },
  { left: 14, delay: 3.4, dur: 9.2, scale: 1.6 },
  { left: 40, delay: 2.7, dur: 8.3, scale: 1.1 },
  { left: 66, delay: 1.4, dur: 9.6, scale: 1.4 },
  { left: 79, delay: 3.6, dur: 8.6, scale: 1 },
]

export default function InvitacionFondo({ theme }: { theme: Theme }) {
  const { tipo, efectoId } = theme.fondo
  if (tipo !== 'animado' || efectoId === 'none') return null

  return (
    <div className={`inv-fondo inv-fondo-${efectoId}`} aria-hidden="true">
      {efectoId === 'aurora' && (
        <>
          <span className="inv-blob inv-blob-1" />
          <span className="inv-blob inv-blob-2" />
          <span className="inv-blob inv-blob-3" />
        </>
      )}
      {efectoId === 'estrellas' && (
        <>
          <span className="inv-stars inv-stars-a" />
          <span className="inv-stars inv-stars-b" />
        </>
      )}
      {efectoId === 'confeti' &&
        CONFETI.map((c, i) => (
          <span
            key={i}
            className="inv-confeti-pza"
            style={{
              left: `${c.left}%`,
              width: c.w,
              height: c.h,
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.dur}s`,
            }}
          />
        ))}
      {efectoId === 'olas' && (
        <>
          <span className="inv-sol" />
          <svg className="inv-ola inv-ola-top inv-ola-1" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path d="M0 60 C 240 110 480 10 720 60 C 960 110 1200 10 1440 60 L1440 120 L0 120 Z" />
          </svg>
          <svg className="inv-ola inv-ola-top inv-ola-2" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path d="M0 70 C 240 20 480 120 720 70 C 960 20 1200 120 1440 70 L1440 120 L0 120 Z" />
          </svg>
          <svg className="inv-ola inv-ola-1" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path d="M0 60 C 240 110 480 10 720 60 C 960 110 1200 10 1440 60 L1440 120 L0 120 Z" />
          </svg>
          <svg className="inv-ola inv-ola-2" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path d="M0 70 C 240 20 480 120 720 70 C 960 20 1200 120 1440 70 L1440 120 L0 120 Z" />
          </svg>
        </>
      )}
      {(efectoId === 'petalos' || efectoId === 'hojas') &&
        PARTICLES.map((p, i) => (
          <span
            key={i}
            className={efectoId === 'petalos' ? 'inv-petalo' : 'inv-hoja'}
            style={{
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              ['--inv-part-scale' as string]: p.scale,
            }}
          />
        ))}
      {efectoId === 'bokeh' &&
        BOKEH.map((b, i) => (
          <span
            key={i}
            className="inv-bokeh"
            style={{
              left: `${b.left}%`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.dur}s`,
              ['--inv-part-scale' as string]: b.scale,
            }}
          />
        ))}
      {efectoId === 'bola-disco' && (
        <>
          <span className="inv-disco-rays" />
          <span className="inv-disco-ball" />
          <span className="inv-disco-dot" style={{ top: '20%', left: '14%', animationDelay: '0s', ['--c' as string]: '#ff2e97' }} />
          <span className="inv-disco-dot" style={{ top: '34%', left: '72%', animationDelay: '0.7s', ['--c' as string]: '#39ff88' }} />
          <span className="inv-disco-dot" style={{ top: '52%', left: '24%', animationDelay: '1.3s', ['--c' as string]: '#2ee0ff' }} />
          <span className="inv-disco-dot" style={{ top: '64%', left: '60%', animationDelay: '0.4s', ['--c' as string]: '#ffd85e' }} />
          <span className="inv-disco-dot" style={{ top: '78%', left: '38%', animationDelay: '1.9s', ['--c' as string]: '#ff2e97' }} />
          <span className="inv-disco-dot" style={{ top: '46%', left: '48%', animationDelay: '1s', ['--c' as string]: '#39ff88' }} />
          <span className="inv-disco-dot" style={{ top: '86%', left: '80%', animationDelay: '2.3s', ['--c' as string]: '#2ee0ff' }} />
          <span className="inv-disco-dot" style={{ top: '28%', left: '42%', animationDelay: '1.6s', ['--c' as string]: '#ffd85e' }} />
          <span className="inv-disco-dot" style={{ top: '70%', left: '88%', animationDelay: '0.9s', ['--c' as string]: '#ff2e97' }} />
          <span className="inv-disco-dot" style={{ top: '58%', left: '8%', animationDelay: '2.1s', ['--c' as string]: '#39ff88' }} />
        </>
      )}
      {efectoId === 'papel-arrugado' && (
        <svg className="inv-papel-svg" xmlns="http://www.w3.org/2000/svg">
          <filter id="inv-crumple">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.014" numOctaves="4" seed="7" result="n" />
            <feDiffuseLighting in="n" lightingColor="#fff" surfaceScale="2.2" result="l">
              <feDistantLight azimuth="235" elevation="58" />
            </feDiffuseLighting>
            <feColorMatrix in="l" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.33 0.33 0.33 0 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#inv-crumple)" />
        </svg>
      )}
    </div>
  )
}
