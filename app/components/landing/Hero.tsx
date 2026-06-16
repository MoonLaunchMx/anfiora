'use client'

import { useEffect, useRef, useState } from 'react'
import { FaWhatsapp, FaInstagram, FaFacebookMessenger, FaTelegramPlane } from 'react-icons/fa'
import { landingCopy, type Lang } from './i18n'
import styles from './Hero.module.css'

type Props = {
  t: (typeof landingCopy)[Lang]
  onRegister: () => void
}

const CHANNEL_ICONS = [FaWhatsapp, FaInstagram, FaFacebookMessenger, FaTelegramPlane]

export default function Hero({ t, onRegister }: Props) {
  const h = t.hero

  const [wordIdx, setWordIdx] = useState(0)
  const [activeChannel, setActiveChannel] = useState(0)
  const [guestText, setGuestText] = useState<string>(h.scenarios[0].guest)
  const [guestVisible, setGuestVisible] = useState(true)
  const [aiText, setAiText] = useState('')

  useEffect(() => {
    const id = setInterval(() => {
      setWordIdx(i => (i + 1) % h.rotating.length)
    }, 2400)
    return () => clearInterval(id)
  }, [h.rotating.length])

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let cancelled = false
    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        if (!cancelled) fn()
      }, ms)
      timers.push(id)
    }

    setActiveChannel(0)
    setGuestText(h.scenarios[0].guest)
    setGuestVisible(true)
    setAiText('')

    let ci = 0

    const typeMsg = (text: string, done: () => void) => {
      let i = 0
      const tick = () => {
        if (cancelled) return
        if (i <= text.length) {
          setAiText(text.slice(0, i))
          i++
          schedule(tick, 26)
        } else {
          setAiText(text)
          done()
        }
      }
      schedule(tick, 500)
    }

    const cycle = () => {
      if (cancelled) return
      const c = h.scenarios[ci]
      setActiveChannel(ci)
      setGuestVisible(false)
      setAiText('')
      schedule(() => {
        if (cancelled) return
        setGuestText(c.guest)
        setGuestVisible(true)
        typeMsg(c.ai, () => {
          schedule(() => {
            ci = (ci + 1) % h.scenarios.length
            cycle()
          }, 2600)
        })
      }, 320)
    }

    cycle()

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [h.scenarios])

  const scrollToPlatform = () => {
    document.getElementById('plataforma')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className={styles.wrap}>
      <div>
        <div className={styles.eyebrow}>
          <span className={styles.dot} />
          {h.eyebrow}
        </div>
        <h1 className={styles.title}>
          <span className={styles.l1}>{h.line1}</span>
          <span className={`${styles.rotrow} ${styles.l1}`}>
            <span className={styles.rot}>
              <span key={wordIdx} className={styles.rotIn}>
                {h.rotating[wordIdx]}
              </span>
            </span>
          </span>
          <span className={styles.l3}>
            {h.line3a}
            <em className={styles.em}>{h.line3em}</em>
          </span>
        </h1>
        <p className={styles.sub}>
          <b>{h.sub1}</b>
          {h.sub2}
        </p>
        <div className={styles.ctaRow}>
          <button className={styles.btnPrimary} onClick={onRegister}>
            {h.cta1}
          </button>
          <button className={styles.btnSecondary} onClick={scrollToPlatform}>
            {h.cta2}
          </button>
        </div>
        <p className={styles.fine}>{h.fine}</p>
      </div>

      <div className={styles.stage}>
        <div className={styles.halo} />
        <div className={styles.orbit}>
          <div className={styles.node}>★</div>
        </div>
        <div className={`${styles.orbit} ${styles.orbitInner}`}>
          <div className={`${styles.node} ${styles.nodeInner}`}>✦</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.aiOrb} />
            <div>
              <div className={styles.who}>{h.agentName}</div>
              <div className={styles.ch}>
                {h.replyLabel} {h.channels[activeChannel]}
              </div>
            </div>
          </div>
          <div className={styles.chips}>
            {h.channels.map((channel, idx) => {
              const IconComponent = CHANNEL_ICONS[idx]
              return (
                <div
                  key={channel}
                  className={`${styles.chip} ${idx === activeChannel ? styles.chipActive : ''}`}
                  title={channel}
                >
                  <IconComponent size={14} />
                </div>
              )
            })}
          </div>
          <div
            className={`${styles.bubble} ${styles.bubbleMe}`}
            style={{ opacity: guestVisible ? 1 : 0 }}
          >
            {guestText}
          </div>
          <div className={styles.bubble}>
            {aiText}
            <span className={styles.cur} />
          </div>
          <div className={styles.tagAi}>★ {h.aiTag}</div>
        </div>
      </div>
    </section>
  )
}
