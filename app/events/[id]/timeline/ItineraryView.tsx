'use client'

import { useEffect, useRef, useState } from 'react'
import { MomentCard } from './MomentCard'
import { MomentModal } from './MomentModal'
import { DayLine } from './DayLine'
import type { ItineraryController } from './useItinerary'
import { CalendarPlus, Clock } from 'lucide-react'

export function ItineraryView({ itin }: { itin: ItineraryController }) {
  const {
    eventInfo, canEdit, moments, days, inRange, suppliers, visibleCount, newDate,
    guestPreview, showModal, editMoment,
    openNew, openEdit, openTemplate, closeModal, handleSave, handleDelete, toggleVisible,
  } = itin

  // El scroll vive en el contenedor de la pagina (el main del layout de evento
  // es overflow-hidden): el dia activo es el ultimo cuya linea ya llego al tope.
  const rootRef = useRef<HTMLDivElement | null>(null)
  const secRefs = useRef<Record<string, HTMLElement | null>>({})
  const [activeDay, setActiveDay] = useState<string>('')

  useEffect(() => {
    const stage = rootRef.current?.parentElement
    if (!stage || days.length < 2) return
    let queued = false
    const sync = () => {
      queued = false
      const top = stage.getBoundingClientRect().top
      let current = inRange[0]?.date ?? ''
      for (const g of inRange) {
        const el = secRefs.current[g.date]
        if (el && el.getBoundingClientRect().top <= top + 2) current = g.date
      }
      setActiveDay(current)
    }
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(sync) } }
    stage.addEventListener('scroll', onScroll, { passive: true })
    sync()
    return () => stage.removeEventListener('scroll', onScroll)
  }, [inRange, days.length])

  const momentModal = showModal && (
    <MomentModal
      editMoment={editMoment}
      suppliers={suppliers}
      days={days}
      defaultDate={editMoment?.moment_date || newDate}
      onClose={closeModal}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  )

  // ── Estado vacio ────────────────────────────────────────────────────────────
  if (moments.length === 0) {
    return (
      <>
        <div className="mt-5 rounded-xl border border-dashed border-[#ecdcb8] px-6 py-14 text-center">
          <Clock size={22} className="mx-auto text-[#d4a853]" />
          <p className="mt-3 text-sm text-[#888]">Aun no tienes el itinerario del dia</p>
          {!eventInfo?.event_date ? (
            <p className="mt-3 text-xs text-[#bbb]">Primero define la fecha del evento en Configuracion</p>
          ) : canEdit ? (
            <div className="mt-4 flex flex-col items-center gap-3">
              <button onClick={() => openTemplate()}
                className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]">
                <CalendarPlus size={14} />Armar el día
              </button>
              <button onClick={() => openNew()} className="text-sm text-[#888] hover:text-[#d4a853]">o agrega un momento manual</button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-[#bbb]">El organizador aun no ha creado el itinerario</p>
          )}
        </div>
        {momentModal}
      </>
    )
  }

  const varios = days.length > 1

  // ── Vista con momentos ──────────────────────────────────────────────────────
  return (
    <div ref={rootRef} className="mt-2">
      {canEdit && (
        <p className="mb-4 text-xs text-[#999]">
          {guestPreview
            ? 'Estás viendo la invitación como la ve un invitado.'
            : <>Los invitados ven <span className="font-medium text-[#666]">{visibleCount} de {moments.length}</span> momentos en la invitación. Toca el ojo de cada tarjeta para mostrar u ocultar.</>}
        </p>
      )}

      {guestPreview && visibleCount === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e0e0e0] px-6 py-10 text-center">
          <p className="text-sm text-[#888]">Ningun momento es visible para los invitados todavia</p>
        </div>
      ) : (
        <>
          {inRange.map(group => {
            const visibles = group.moments.filter(m => m.visible_to_guests)
            const shown = guestPreview ? visibles : group.moments
            if (guestPreview && shown.length === 0) return null
            return (
              <section key={group.date} ref={el => { secRefs.current[group.date] = el }} className="relative">
                {varios && (
                  <DayLine
                    date={group.date}
                    active={activeDay === group.date}
                    count={group.moments.length}
                    visibleCount={visibles.length}
                    canEdit={canEdit && !guestPreview}
                    onAdd={() => openNew(group.date)}
                  />
                )}
                {shown.length === 0 ? (
                  <p className="pb-4 pl-1 text-xs text-[#bbb]">Nada planeado todavía</p>
                ) : (
                  <div className="flex flex-col pb-2">
                    {shown.map(m => (
                      <MomentCard key={m.id} moment={m} canEdit={canEdit} guestPreview={guestPreview} onEdit={openEdit} onToggleVisible={toggleVisible} />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
          {varios && <div className="h-40" />}
        </>
      )}

      {momentModal}
    </div>
  )
}
