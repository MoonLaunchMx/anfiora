'use client'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CarruselEstilo } from '@/lib/invite/theme'

type Props = {
  fotos: string[]
  estilo: CarruselEstilo
  mini?: boolean
  forceMobile?: boolean
}

const ROTACIONES = [-2.5, 2, -1.5, 2.5, -2, 1.5]

export default function CarruselViewer({ fotos, estilo, mini = false, forceMobile = false }: Props) {
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const [paused, setPaused] = useState(false)
  const reduce = useReducedMotion()
  const n = fotos.length

  useEffect(() => {
    if (index > n - 1) setIndex(0)
  }, [n, index])

  useEffect(() => {
    if (reduce || paused || n <= 1) return
    const interval = mini ? 1700 : 4200
    const t = setInterval(() => {
      setDir(1)
      setIndex(i => (i + 1) % n)
    }, interval)
    return () => clearInterval(t)
  }, [reduce, paused, n, mini, index])

  if (n === 0) return null

  const go = (delta: number) => {
    setDir(delta)
    setIndex(i => (i + delta + n) % n)
  }

  const active = index % n
  const isPolaroid = estilo === 'polaroid'
  const dur = reduce ? 0 : 0.6

  const variantsFor = (): { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition } => {
    switch (estilo) {
      case 'deslizar':
        return {
          initial: { x: `${dir * 100}%`, opacity: 0.4 },
          animate: { x: '0%', opacity: 1 },
          exit: { x: `${-dir * 100}%`, opacity: 0.4 },
        }
      case 'zoom':
        return {
          initial: { opacity: 0, scale: 1.02 },
          animate: { opacity: 1, scale: reduce ? 1 : 1.12 },
          exit: { opacity: 0, scale: 1.14 },
        }
      case 'polaroid':
        return {
          initial: { opacity: 0, y: -40, rotate: dir * 6 },
          animate: { opacity: 1, y: 0, rotate: ROTACIONES[active % ROTACIONES.length] },
          exit: { opacity: 0, y: 30, rotate: dir * -4 },
        }
      case 'fundido':
      default:
        return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    }
  }

  const v = variantsFor()
  const stageBase = 'relative w-full aspect-[4/5]'
  const stagePad = isPolaroid ? 'px-4 py-3' : ''
  const clip = isPolaroid ? '' : 'overflow-hidden'
  const radius = mini ? 'rounded-md' : 'rounded-2xl'
  const arrowVis = forceMobile ? 'hidden' : 'hidden sm:flex'

  return (
    <div
      className="relative w-full select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={`${stageBase} ${stagePad} ${clip} ${isPolaroid ? '' : radius}`}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={active}
            className="absolute inset-0"
            initial={v.initial}
            animate={v.animate}
            exit={v.exit}
            transition={{
              duration: estilo === 'zoom' ? (reduce ? 0 : (mini ? 1.7 : 4.2)) : dur,
              ease: estilo === 'zoom' ? 'linear' : 'easeInOut',
              opacity: { duration: dur },
            }}
            drag={mini || reduce ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) go(1)
              else if (info.offset.x > 60) go(-1)
            }}
          >
            {isPolaroid ? (
              <div className="flex h-full w-full items-center justify-center">
                <div className="rounded-sm bg-white p-2 pb-6 shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fotos[active]} alt="" className="h-full max-h-full w-auto object-cover" loading="lazy" />
                </div>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotos[active]} alt="" className={`h-full w-full object-cover ${clip ? radius : ''}`} loading="lazy" />
            )}
          </motion.div>
        </AnimatePresence>

        {!mini && n > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Foto anterior"
              className={`absolute left-1.5 top-1/2 z-10 h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[#1D1E20] shadow-md backdrop-blur transition hover:bg-white ${arrowVis}`}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Foto siguiente"
              className={`absolute right-1.5 top-1/2 z-10 h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[#1D1E20] shadow-md backdrop-blur transition hover:bg-white ${arrowVis}`}
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {!mini && n > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {fotos.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Foto ${i + 1}`}
              onClick={() => { setDir(i > active ? 1 : -1); setIndex(i) }}
              className="h-2 rounded-full transition-all"
              style={{
                width: i === active ? 18 : 8,
                background: i === active ? 'var(--inv-acento)' : 'rgba(0,0,0,0.18)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
