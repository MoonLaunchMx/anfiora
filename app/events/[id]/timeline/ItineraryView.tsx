'use client'

import { MomentCard } from './MomentCard'
import { MomentModal } from './MomentModal'
import { GenerateItineraryModal } from './GenerateItineraryModal'
import type { ItineraryController } from './useItinerary'
import { Sparkles, Clock, Eye } from 'lucide-react'

export function ItineraryView({ itin }: { itin: ItineraryController }) {
  const {
    eventInfo, canEdit, moments, sorted, suppliers, visibleCount,
    guestPreview, setGuestPreview, showModal, editMoment, showGenerate, setShowGenerate,
    openNew, openEdit, closeModal, handleSave, handleDelete, toggleVisible,
    applyGenerated,
  } = itin

  const generateModal = showGenerate && (
    <GenerateItineraryModal
      eventType={eventInfo?.event_type ?? null}
      eventCategory={eventInfo?.event_category ?? null}
      eventTime={eventInfo?.event_time ?? null}
      venue={eventInfo?.venue ?? null}
      onClose={() => setShowGenerate(false)}
      onGenerated={applyGenerated}
    />
  )
  const momentModal = showModal && (
    <MomentModal
      editMoment={editMoment}
      suppliers={suppliers}
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
              <button onClick={() => setShowGenerate(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]">
                <Sparkles size={14} />Autogenerar
              </button>
              <button onClick={openNew} className="text-sm text-[#888] hover:text-[#d4a853]">o agrega un momento manual</button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-[#bbb]">El organizador aun no ha creado el itinerario</p>
          )}
        </div>
        {generateModal}
        {momentModal}
      </>
    )
  }

  // ── Vista con momentos ──────────────────────────────────────────────────────
  return (
    <div className="mt-2">
      {/* Info: cuantos momentos ven los invitados + previsualizar */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#ecdcb8] bg-[#fffdf7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#1D1E20]">Visible en la invitacion RSVP</p>
          <p className="text-[11px] text-[#999]">
            Los invitados ven {visibleCount} de {moments.length} momentos{canEdit && !guestPreview ? '. Toca el ojo de cada uno para mostrarlo u ocultarlo.' : ''}
          </p>
        </div>
        <button
          onClick={() => setGuestPreview(p => !p)}
          className={['shrink-0 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition', guestPreview ? 'border-[#d4a853] bg-[#fffbf0] text-[#c49a3a]' : 'border-[#e0e0e0] text-[#888] hover:bg-[#f8f8f8]'].join(' ')}
        >
          <Eye size={13} />{guestPreview ? 'Vista organizador' : 'Ver como invitado'}
        </button>
      </div>

      {/* Hilo del dia */}
      {guestPreview && visibleCount === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e0e0e0] px-6 py-10 text-center">
          <p className="text-sm text-[#888]">Ningun momento es visible para los invitados todavia</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {(guestPreview ? sorted.filter(m => m.visible_to_guests) : sorted).map(m => (
            <MomentCard
              key={m.id}
              moment={m}
              canEdit={canEdit}
              guestPreview={guestPreview}
              onEdit={openEdit}
              onToggleVisible={toggleVisible}
            />
          ))}
        </div>
      )}

      {momentModal}
      {generateModal}
    </div>
  )
}
