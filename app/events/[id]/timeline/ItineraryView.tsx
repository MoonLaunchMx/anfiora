'use client'

import { useEffect, useRef } from 'react'
import { MomentCard } from './MomentCard'
import { MomentModal } from './MomentModal'
import { DayLine } from './DayLine'
import { DayTemplateModal } from './DayTemplateModal'
import type { ItineraryController } from './useItinerary'
import { CalendarPlus, Clock, Trash2 } from 'lucide-react'
import { dayLabel, type DayGroup } from '@/lib/itinerary'
import type { ItineraryMoment } from '@/lib/types'
import { useConfirm } from '@/app/components/ui/ConfirmModal'

export function ItineraryView({ itin }: { itin: ItineraryController }) {
  const {
    eventInfo, canEdit, moments, days, inRange, orphans, suppliers, visibleCount, newDate,
    guestPreview, showModal, editMoment, showGenerate, setShowGenerate, templateDate,
    activeDay, setActiveDay,
    openNew, openEdit, openTemplate, closeModal, handleSave, handleDelete, toggleVisible, deleteDay,
    applyTemplate,
  } = itin

  const confirm = useConfirm()

  const askDeleteDay = async (group: DayGroup<ItineraryMoment>) => {
    const { dow, num } = dayLabel(group.date)
    const ok = await confirm({
      title: 'Eliminar el día',
      message: `Se borran los ${group.moments.length} momentos del ${dow} ${num}. No se puede deshacer.`,
      confirmLabel: 'Eliminar el día',
      tone: 'danger',
    })
    if (ok) await deleteDay(group.date)
  }

  // El scroll vive en el contenedor de la pagina (el main del layout de evento
  // es overflow-hidden): el dia activo es el ultimo cuya linea ya llego al tope.
  const rootRef = useRef<HTMLDivElement | null>(null)
  const secRefs = useRef<Record<string, HTMLElement | null>>({})

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
  }, [inRange, days.length, setActiveDay])

  const templateModal = showGenerate && templateDate && (
    <DayTemplateModal
      eventType={eventInfo?.event_type ?? null}
      date={templateDate}
      onClose={() => setShowGenerate(false)}
      onApply={applyTemplate}
    />
  )

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
        {templateModal}
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
          {!guestPreview && orphans.map(group => {
            const { dow, num } = dayLabel(group.date)
            return (
              <section key={group.date} className="relative mt-4">
                <div className="flex h-14 items-center gap-3">
                  <span className="flex items-baseline gap-2 whitespace-nowrap text-[#cc3333]">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{dow}</span>
                    <span className="text-[13px] font-semibold tabular-nums">{num}</span>
                  </span>
                  <span className="h-px min-w-3 flex-1 bg-[#ffc0c0]" />
                  <span className="whitespace-nowrap text-[11px] text-[#cc3333]">Fuera del rango</span>
                </div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ffc0c0] bg-[#fff0f0] px-3.5 py-3">
                  <p className="max-w-[52ch] text-[13px] text-[#cc3333]">
                    Este día ya no está dentro de las fechas del evento. Sus {group.moments.length} momentos no se muestran a los invitados.
                  </p>
                  {canEdit && (
                    <button
                      onClick={() => askDeleteDay(group)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#ffc0c0] bg-white px-3 py-1.5 text-xs font-semibold text-[#cc3333] transition hover:bg-[#fff0f0]"
                    >
                      <Trash2 size={13} />Eliminar el día
                    </button>
                  )}
                </div>
                <div className="flex flex-col pb-2">
                  {group.moments.map(m => (
                    <MomentCard key={m.id} moment={m} canEdit={canEdit} guestPreview={false} onEdit={openEdit} onToggleVisible={toggleVisible} />
                  ))}
                </div>
              </section>
            )
          })}
          {varios && <div className="h-40" />}
        </>
      )}

      {templateModal}
      {momentModal}
    </div>
  )
}
