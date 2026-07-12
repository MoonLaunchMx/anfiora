'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { isDressCodeConfigured, resolveNivelLabel, resolveNivelDesc } from '@/lib/dresscode'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'dress_code' }>['content']

export default function DressCodeSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const dc = ctx.dressCode
  const fotos = dc && isDressCodeConfigured(dc)
    ? [
        ...dc.fotos_ellas.map((url, i) => ({ id: `dcfoto-fotos_ellas-${i}`, url })),
        ...dc.fotos_ellos.map((url, i) => ({ id: `dcfoto-fotos_ellos-${i}`, url })),
      ]
    : []
  const total = fotos.length

  const [zoom, setZoom] = useState<number | null>(null)

  const go = (dir: 1 | -1) =>
    setZoom(v => (v === null || total === 0 ? v : (v + dir + total) % total))

  useEffect(() => {
    document.body.style.overflow = zoom !== null ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [zoom])

  useEffect(() => {
    if (zoom === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(null)
      else if (e.key === 'ArrowRight') setZoom(v => (v === null || total === 0 ? v : (v + 1) % total))
      else if (e.key === 'ArrowLeft') setZoom(v => (v === null || total === 0 ? v : (v - 1 + total) % total))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom, total])

  if (!dc || !isDressCodeConfigured(dc)) {
    if (ctx.mode !== 'preview') return null
    return (
      <SectionShell variant="band" className="text-center">
        <p className="rounded-xl border border-dashed border-[#e0e0e0] bg-white px-4 py-6 text-xs text-[#bbb]">
          Configúralo en Estilo → Dress code
        </p>
      </SectionShell>
    )
  }

  const label = resolveNivelLabel(dc)
  const desc = resolveNivelDesc(dc)
  const ellasCount = dc.fotos_ellas.length
  const guiaCount = [dc.guia_ellas?.trim(), dc.guia_ellos?.trim()].filter(Boolean).length
  const fotosGrupos = [dc.fotos_ellas.length > 0, dc.fotos_ellos.length > 0].filter(Boolean).length

  return (
    <SectionShell variant="band" className="text-center">
      <h2 className="px-2 text-xl font-semibold lg:text-2xl" style={{ color: 'var(--inv-texto-titulo)', fontFamily: 'var(--inv-font-titulo)' }}>
        {content.titulo}
      </h2>

      {label && <p className="mt-5 text-2xl font-semibold tracking-tight" style={{ color: 'var(--inv-texto)' }}>{label}</p>}
      {desc && <p className="text-xs text-[#999]">{desc}</p>}

      {dc.colores_sugeridos.length > 0 && (
        <>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-[#999]">Colores sugeridos</p>
          <div className="mt-2 flex justify-center gap-2">
            {dc.colores_sugeridos.map((c, i) => (
              <span
                key={i}
                className="h-7 w-7 rounded-full border border-black/10"
                style={{ background: c.hex }}
                title={c.nombre}
              />
            ))}
          </div>
        </>
      )}

      {dc.colores_evitar.length > 0 && (
        <>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-[#999]">Evita</p>
          <div className="mt-2 flex justify-center gap-2">
            {dc.colores_evitar.map((c, i) => (
              <span
                key={i}
                className="h-7 w-7 rounded-full border border-[#e0e0e0]"
                style={{ background: c.hex }}
                title={c.nombre}
              />
            ))}
          </div>
        </>
      )}

      {dc.recomendaciones.length > 0 && (
        <p
          className="mx-auto mt-6 max-w-md rounded-xl border px-4 py-3 text-center text-xs leading-relaxed"
          style={{ color: 'var(--inv-texto)', background: 'var(--inv-acento-bg)', borderColor: 'var(--inv-acento-borde)' }}
        >
          {dc.recomendaciones.join('. ')}.
        </p>
      )}

      {dc.nota_libre.trim() && (
        <p className="mx-auto mt-3 max-w-md text-center text-xs leading-relaxed opacity-70" style={{ color: 'var(--inv-texto)' }}>{dc.nota_libre}</p>
      )}

      {(dc.guia_ellas?.trim() || dc.guia_ellos?.trim()) && (
        <div className={`mx-auto mt-5 grid max-w-md gap-2 text-center ${guiaCount === 2 ? 'sm:grid-cols-2' : ''}`}>
          {dc.guia_ellas?.trim() && (
            <div className="rounded-xl bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#999]">{dc.label_ellas}</p>
              <p className="mt-0.5 text-xs opacity-70" style={{ color: 'var(--inv-texto)' }}>{dc.guia_ellas}</p>
            </div>
          )}
          {dc.guia_ellos?.trim() && (
            <div className="rounded-xl bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#999]">{dc.label_ellos}</p>
              <p className="mt-0.5 text-xs opacity-70" style={{ color: 'var(--inv-texto)' }}>{dc.guia_ellos}</p>
            </div>
          )}
        </div>
      )}

      {total > 0 && (
        <div className={`mx-auto mt-6 grid max-w-md gap-4 ${fotosGrupos === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {([['fotos_ellas', dc.label_ellas, 0], ['fotos_ellos', dc.label_ellos, ellasCount]] as ['fotos_ellas' | 'fotos_ellos', string, number][]).map(([field, titulo, base]) =>
            dc[field].length > 0 ? (
              <div key={field}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#999]">{titulo}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {dc[field].map((url, i) => (
                    <motion.img
                      key={i}
                      layoutId={`dcfoto-${field}-${i}`}
                      src={url}
                      alt=""
                      onClick={() => setZoom(base + i)}
                      whileTap={{ scale: 0.94 }}
                      className="h-20 w-20 cursor-pointer rounded-lg object-cover transition hover:brightness-95"
                    />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}

      <AnimatePresence>
        {zoom !== null && fotos[zoom] && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-6"
            onClick={() => setZoom(null)}
          >
            <motion.div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            <button
              type="button"
              onClick={e => { e.stopPropagation(); setZoom(null) }}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>

            <div className="relative z-10 w-fit">
              {total > 1 && (
                <>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); go(-1) }}
                    className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
                    aria-label="Anterior"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); go(1) }}
                    className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
                    aria-label="Siguiente"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}

              <motion.img
                key={fotos[zoom].id}
                layoutId={fotos[zoom].id}
                src={fotos[zoom].url}
                alt=""
                drag={total > 1 ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onClick={e => { e.stopPropagation(); if (total > 1) go(1) }}
                onDragEnd={(_e, info) => {
                  if (info.offset.x < -60) go(1)
                  else if (info.offset.x > 60) go(-1)
                }}
                className="block max-h-[85vh] max-w-[90vw] cursor-pointer rounded-2xl object-contain shadow-2xl"
                transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              />
            </div>

            {total > 1 && (
              <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs font-medium text-white/70">
                {zoom + 1} / {total}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </SectionShell>
  )
}
