'use client'

import { useState, type CSSProperties } from 'react'
import { landingCopy, type Lang } from './i18n'
import styles from './SectionPain.module.css'

type Props = {
  t: (typeof landingCopy)[Lang]
  onPlans?: () => void
}

const MODS = [
  { key: 'invitaciones', color: '#e06b6b', x: -150, y: -120 },
  { key: 'galeria', color: '#6b8be0', x: 150, y: -128 },
  { key: 'regalos', color: '#c77dff', x: 0, y: -176 },
  { key: 'playlist', color: '#1DB954', x: -194, y: 6 },
  { key: 'mesas', color: '#d4a853', x: 190, y: 6 },
  { key: 'presupuesto', color: '#e08a3c', x: -150, y: 120 },
  { key: 'pagos', color: '#2a9d8f', x: 150, y: 124 },
  { key: 'proveedores', color: '#48C9B0', x: 0, y: 178 },
]

export default function SectionPain({ t, onPlans }: Props) {
  const p = t.pain
  const [calm, setCalm] = useState(false)
  const [active, setActive] = useState(0)

  const mod = p.mods[active]

  return (
    <section className={styles.sec}>
      <div className={styles.head}>
        <h2 className={styles.h2}>{p.title}</h2>
      </div>

      <div className={styles.grid}>
        <div
          className={`${styles.stage} ${calm ? styles.calm : ''}`}
          onClick={() => setCalm(c => !c)}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setCalm(c => !c)
            }
          }}
        >
          <svg className={styles.threads} viewBox="0 0 440 440" preserveAspectRatio="none">
            <path d="M60,90 C180,40 240,210 360,120 C430,80 300,270 380,340" />
            <path d="M80,360 C160,300 120,170 260,220 C370,255 280,80 410,140" />
            <path d="M40,200 C150,160 200,310 300,250 C390,210 340,370 230,360" />
            <path d="M120,60 C210,160 90,260 200,330 C300,395 365,300 385,215" />
            <path d="M70,300 C190,335 220,140 350,180 C420,200 300,360 240,300" />
            <path d="M150,40 C120,160 300,180 280,300 C270,370 120,330 100,220" />
          </svg>

          <span className={`${styles.pulse} ${styles.p1}`} />
          <span className={`${styles.pulse} ${styles.p2}`} />
          <span className={`${styles.pulse} ${styles.p3}`} />

          <div className={styles.chips}>
            {MODS.map((m, i) => (
              <div
                key={m.key}
                className={`${styles.chip} ${i === active ? styles.hot : ''}`}
                style={
                  {
                    '--x': `${m.x}px`,
                    '--y': `${m.y}px`,
                    '--c': m.color,
                  } as CSSProperties
                }
              >
                <i />
                <div className={styles.ct}>
                  <span className={styles.cn}>{p.mods[i].name}</span>
                  <span className={styles.cp}>{p.mods[i].free ? '' : p.mods[i].price}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.hub}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/isotipo-flat.svg" alt="Anfiora" />
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.tabs}>
            {p.mods.map((m, i) => (
              <button
                key={MODS[i].key}
                className={`${styles.tab} ${i === active ? styles.tabActive : ''}`}
                onClick={() => setActive(i)}
              >
                {m.name}
              </button>
            ))}
          </div>

          <div className={styles.panel}>
            <p className={styles.pd}>{mod.desc}</p>
            <span className={`${styles.price} ${mod.free ? styles.free : ''}`}>
              {mod.free ? mod.price : `${p.pricePrefix}${mod.price}`}
            </span>
          </div>

          <div className={styles.close}>
            <p className={styles.closeTitle}>{p.ctaTitle}</p>
            <button className={styles.btnPrimary} onClick={onPlans}>
              {p.ctaButton}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
