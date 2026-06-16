'use client'

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { landingCopy, type Lang } from './i18n'
import styles from './SectionPlatform.module.css'

type Props = {
  t: (typeof landingCopy)[Lang]
}

type ModKey =
  | 'invitados'
  | 'checkin'
  | 'album'
  | 'playlist'
  | 'mesas'
  | 'regalos'
  | 'donaciones'
  | 'finanzas'
  | 'proveedores'

type CatKey = 'social' | 'corp' | 'impact'

const ICONS: Record<string, JSX.Element> = {
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3M21 14v7h-7" />
    </>
  ),
  photo: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  table: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  gift: (
    <>
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </>
  ),
  money: (
    <>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  vendor: (
    <>
      <path d="M20 7h-9M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  ),
}

const MOD_ICON: Record<ModKey, string> = {
  invitados: 'users',
  checkin: 'qr',
  album: 'photo',
  playlist: 'music',
  mesas: 'table',
  regalos: 'gift',
  donaciones: 'heart',
  finanzas: 'money',
  proveedores: 'vendor',
}

const CATS: { key: CatKey; keys: ModKey[] }[] = [
  { key: 'social', keys: ['invitados', 'album', 'playlist', 'mesas', 'regalos', 'finanzas'] },
  { key: 'corp', keys: ['invitados', 'checkin', 'finanzas', 'proveedores'] },
  { key: 'impact', keys: ['invitados', 'checkin', 'donaciones', 'finanzas', 'proveedores'] },
]

const PH = [
  'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=260&h=320&fit=crop&q=60',
  'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=260&h=320&fit=crop&q=60',
  'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=260&h=320&fit=crop&q=60',
  'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=260&h=320&fit=crop&q=60',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=260&h=320&fit=crop&q=60',
  'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=260&h=320&fit=crop&q=60',
]

const G = 'var(--g, #2a9d8f)'
const Y = 'var(--y, #d9a93f)'
const R = 'var(--r, #e07b7b)'
const E = 'var(--e, #e3ddd2)'

function TableEl({ x, y, num, cols }: { x: number; y: number; num: string; cols: string[] }) {
  const n = cols.length
  return (
    <div className={styles.dtblw} style={{ left: x, top: y }}>
      <div className={styles.dtbl}>{num}</div>
      {cols.map((c, i) => {
        const a = (i / n) * 2 * Math.PI - Math.PI / 2
        const dx = Math.cos(a) * 34
        const dy = Math.sin(a) * 34
        return (
          <span
            key={i}
            className={styles.gd}
            style={{ background: c, transform: `translate(${dx}px, ${dy}px)` }}
          />
        )
      })}
    </div>
  )
}

function Song({
  c1,
  c2,
  sn,
  ar,
  stage,
}: {
  c1: string
  c2: string
  sn: string
  ar: string
  stage: string
}) {
  return (
    <div className={styles.srow}>
      <div className={styles.cov} style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }} />
      <div className={styles.meta}>
        <div className={styles.sn}>{sn}</div>
        <div className={styles.ar}>{ar}</div>
      </div>
      <span className={styles.stg}>{stage}</span>
    </div>
  )
}

function Greg({
  sw,
  n,
  p,
  cls,
  lbl,
}: {
  sw: string
  n: string
  p: string
  cls: string
  lbl: string
}) {
  return (
    <div className={styles.grow}>
      <div className={styles.sw} style={{ background: sw }} />
      <div className={styles.gm}>
        <div className={styles.gn}>{n}</div>
        <div className={styles.gp}>{p}</div>
      </div>
      <span className={`${styles.gst} ${cls}`}>{lbl}</span>
    </div>
  )
}

function QrAnim() {
  const cells = useMemo(
    () => Array.from({ length: 49 }, () => Math.random() > 0.45),
    []
  )
  return (
    <div className={styles.qrwrap}>
      <div className={styles.qrgrid}>
        {cells.map((on, i) => (
          <span key={i} style={on ? undefined : { opacity: 0 }} />
        ))}
      </div>
      <div className={styles.scanline} />
      <div className={styles.qrok}>
        <div className={styles.qrokCircle}>
          <svg viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>
    </div>
  )
}

function renderAnim(key: ModKey) {
  switch (key) {
    case 'invitados':
      return (
        <div className={styles.gcard}>
          <div className={styles.glayer}>
            <div className={styles.av} style={{ background: 'linear-gradient(135deg,#cfeee5,#9ad9c7)' }} />
            <div className={styles.nm2}>Ana Martínez</div>
            <span className={`${styles.stat} ${styles.statOk}`}>Confirmado</span>
          </div>
          <div className={styles.glayer}>
            <div className={styles.av} style={{ background: 'linear-gradient(135deg,#f3e2c0,#dcc081)' }} />
            <div className={styles.nm2}>Carlos Ruiz</div>
            <span className={`${styles.stat} ${styles.statPe}`}>Pendiente</span>
          </div>
          <div className={styles.glayer}>
            <div className={styles.av} style={{ background: 'linear-gradient(135deg,#f5d6c6,#e7a98e)' }} />
            <div className={styles.nm2}>Sofía López</div>
            <span className={`${styles.stat} ${styles.statNo}`}>Declinó</span>
          </div>
        </div>
      )
    case 'checkin':
      return <QrAnim />
    case 'album':
      return (
        <div className={styles.album}>
          <div className={styles.albumTrack}>
            {PH.map((url, i) => (
              <div key={i} className={styles.ph} style={{ backgroundImage: `url(${url})` }} />
            ))}
          </div>
        </div>
      )
    case 'playlist':
      return (
        <div className={styles.plcard}>
          <div className={styles.plhead}>
            <span className={styles.plheadT}>Playlist del evento</span>
            <span className={styles.plheadC}>5 canciones</span>
          </div>
          <Song c1="#dcc081" c2="#b8923c" sn="Sabor a Mí" ar="Luis Miguel" stage="Cena" />
          <Song c1="#e7a98e" c2="#c66b46" sn="Beautiful Things" ar="Benson Boone" stage="Brindis" />
          <Song c1="#1DB954" c2="#0a8f3c" sn="Die With A Smile" ar="Lady Gaga, Bruno Mars" stage="Vals" />
          <Song c1="#a7b2e0" c2="#5566b8" sn="Espresso" ar="Sabrina Carpenter" stage="Fiesta" />
          <Song c1="#8fd3bf" c2="#3f9f82" sn="Birds of a Feather" ar="Billie Eilish" stage="Entrada" />
        </div>
      )
    case 'mesas':
      return (
        <div className={styles.cv}>
          <div className={styles.cin}>
            <TableEl x={14} y={12} num="1" cols={[G, G, G, Y, G, G, E, G]} />
            <TableEl x={234} y={12} num="2" cols={[G, Y, G, G, R, G, Y, G]} />
            <div className={styles.pista} style={{ left: 128, top: 104, width: 88, height: 54 }}>
              Pista
            </div>
            <div className={styles.spk} style={{ left: 130, top: 84 }} />
            <div className={styles.spk} style={{ left: 199, top: 84 }} />
            <TableEl x={14} y={164} num="3" cols={[G, G, E, E, G, Y, G, G]} />
            <TableEl x={234} y={164} num="4" cols={[G, G, G, G, G, Y, G, G]} />
          </div>
        </div>
      )
    case 'regalos':
      return (
        <div className={styles.regcard}>
          <div className={styles.reghead}>Mesa de regalos</div>
          <div className={styles.fondo}>
            <div className={styles.ftop}>
              <span>Fondo de luna de miel</span>
              <b>$18,400</b>
            </div>
            <div className={styles.bar}>
              <i style={{ width: '46%' }} />
            </div>
            <div className={styles.fsub}>46% de $40,000</div>
          </div>
          <Greg sw="linear-gradient(135deg,#cfeee5,#8fd3bf)" n="Juego de copas" p="$1,200" cls={styles.gstRes} lbl="Reservado" />
          <Greg sw="linear-gradient(135deg,#f3e2c0,#dcc081)" n="Set de sábanas" p="$2,400" cls={styles.gstDisp} lbl="Disponible" />
          <Greg sw="linear-gradient(135deg,#d8ddf2,#a7b2e0)" n="Cafetera premium" p="$3,800" cls={styles.gstDisp} lbl="Disponible" />
        </div>
      )
    case 'donaciones':
      return (
        <div className={styles.regcard}>
          <div className={styles.reghead}>Mesa de donaciones</div>
          <div className={styles.fondo}>
            <div className={styles.ftop}>
              <span>Recaudado</span>
              <b>$128,500</b>
            </div>
            <div className={styles.bar}>
              <i style={{ width: '64%' }} />
            </div>
            <div className={styles.fsub}>64% de la meta · $200,000</div>
          </div>
          <Greg sw="linear-gradient(135deg,#cfeee5,#8fd3bf)" n="Donativo libre" p="elige tu monto" cls={styles.gstDon} lbl="Donar" />
          <Greg sw="linear-gradient(135deg,#f3e2c0,#dcc081)" n="Apadrina una causa" p="$500" cls={styles.gstDon} lbl="Donar" />
          <Greg sw="linear-gradient(135deg,#f5d6c6,#e7a98e)" n="Kit escolar" p="$1,200" cls={styles.gstDon} lbl="Donar" />
        </div>
      )
    case 'finanzas':
      return (
        <div className={styles.fincard}>
          <div className={styles.finrow}>
            <span>Presupuesto</span>
            <b>$248,000</b>
          </div>
          <div className={styles.bar}>
            <i />
          </div>
          <div className={styles.finrow}>
            <span>Pagado</span>
            <b>$183,500</b>
          </div>
          <div className={styles.fintag}>
            <span className={styles.d} />
            Se actualiza con cada pago
          </div>
        </div>
      )
    case 'proveedores':
      return (
        <div className={styles.vlist}>
          <div className={styles.vrow}>
            <div className={styles.vav} style={{ background: 'linear-gradient(135deg,#f5d6c6,#e7a98e)' }} />
            <div className={styles.vnm}>Banquetes del Valle</div>
            <div className={styles.stars}>★★★★★</div>
          </div>
          <div className={styles.vrow}>
            <div className={styles.vav} style={{ background: 'linear-gradient(135deg,#cfeee5,#8fd3bf)' }} />
            <div className={styles.vnm}>Flores &amp; Co.</div>
            <div className={styles.stars}>★★★★☆</div>
          </div>
          <div className={styles.vrow}>
            <div className={styles.vav} style={{ background: 'linear-gradient(135deg,#d8ddf2,#a7b2e0)' }} />
            <div className={styles.vnm}>DJ Lumen</div>
            <div className={styles.stars}>★★★★★</div>
          </div>
        </div>
      )
  }
}

export default function SectionPlatform({ t }: Props) {
  const p = t.platform
  const [cat, setCat] = useState(0)
  const [activeKey, setActiveKey] = useState<ModKey>('invitados')

  const segRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pill, setPill] = useState<{ left: number; width: number }>({ left: 0, width: 0 })

  useLayoutEffect(() => {
    const measure = () => {
      const b = segRefs.current[cat]
      if (b) setPill({ left: b.offsetLeft, width: b.offsetWidth })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [cat])

  const selectCat = (i: number) => {
    setCat(i)
    if (!CATS[i].keys.includes(activeKey)) setActiveKey(CATS[i].keys[0])
  }

  const keys = CATS[cat].keys
  const catLabels: CatKey[] = ['social', 'corp', 'impact']

  return (
    <section id="plataforma" className={styles.sec}>
      <div className={styles.head}>
        <div className={styles.kicker}>{p.eyebrow}</div>
        <h2 className={styles.h2}>
          {p.title1}
          <em>{p.titleEm}</em>.
        </h2>
      </div>

      <div className={styles.segwrap}>
        <div className={styles.seg}>
          <span className={styles.pill} style={{ left: pill.left, width: pill.width }} />
          {CATS.map((c, i) => (
            <button
              key={c.key}
              ref={el => {
                segRefs.current[i] = el
              }}
              className={`${styles.segBtn} ${i === cat ? styles.segActive : ''}`}
              onClick={() => selectCat(i)}
            >
              {p.cats[catLabels[i]]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.studio}>
        <div className={styles.list}>
          {keys.map(k => {
            const m = p.mods[k]
            const showBadge = k === 'checkin'
            return (
              <button
                key={k}
                className={`${styles.item} ${k === activeKey ? styles.active : ''}`}
                onClick={() => setActiveKey(k)}
              >
                <span className={styles.ic}>
                  <svg className={styles.icn} viewBox="0 0 24 24">
                    {ICONS[MOD_ICON[k]]}
                  </svg>
                </span>
                <span className={styles.nm}>{m.name}</span>
                {showBadge && <span className={styles.bd}>{p.soon}</span>}
              </button>
            )
          })}
        </div>

        <div className={styles.detail}>
          <div key={activeKey} className={styles.screen}>
            {renderAnim(activeKey)}
          </div>
          <p className={styles.ddesc}>{p.mods[activeKey].desc}</p>
        </div>
      </div>
    </section>
  )
}
