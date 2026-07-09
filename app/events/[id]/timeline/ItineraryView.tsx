'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ItineraryMoment } from '@/lib/types'
import { sortMoments } from '@/lib/itinerary'
import { useEventAccess } from '@/lib/event-access-context'
import type { GeneratedMoment } from '@/lib/itinerary-ai'
import { MomentCard } from './MomentCard'
import { MomentModal, type MomentDraft } from './MomentModal'
import { GenerateItineraryModal } from './GenerateItineraryModal'
import { Plus, Sparkles, Eye, Clock } from 'lucide-react'

interface ItineraryViewProps {
  eventId: string
  eventInfo: { event_date: string | null; event_type: string | null; event_category: string | null; venue?: string | null } | null
}

export function ItineraryView({ eventId, eventInfo }: ItineraryViewProps) {
  const { canEdit } = useEventAccess()

  const [moments, setMoments]       = useState<ItineraryMoment[]>([])
  const [suppliers, setSuppliers]   = useState<{ id: string; name: string }[]>([])
  const [showModal, setShowModal]   = useState(false)
  const [editMoment, setEditMoment] = useState<ItineraryMoment | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [guestPreview, setGuestPreview] = useState(false)

  useEffect(() => {
    supabase
      .from('event_suppliers')
      .select('id, supplier:supplier_id(id, name)')
      .eq('event_id', eventId)
      .then(({ data }) => {
        setSuppliers((data || []).map((s: any) => ({ id: s.id, name: s.supplier?.name || 'Proveedor' })))
      })
  }, [eventId])

  const fetchMoments = useCallback(async () => {
    const { data } = await supabase
      .from('event_itinerary_moments')
      .select('*, event_supplier:event_supplier_id(id, supplier:supplier_id(id, name))')
      .eq('event_id', eventId)
      .order('position', { ascending: true })
    setMoments((data || []) as ItineraryMoment[])
  }, [eventId])

  useEffect(() => { fetchMoments() }, [fetchMoments])

  const sorted = useMemo(() => sortMoments(moments), [moments])
  const visibleCount = moments.filter(m => m.visible_to_guests).length
  const shareOn = visibleCount > 0

  // ── Operaciones de datos (persistencia en event_itinerary_moments) ──────────
  const createMoment = async (data: MomentDraft) => {
    await supabase.from('event_itinerary_moments').insert({
      event_id: eventId,
      title: data.title,
      start_time: data.start_time,
      duration_min: data.duration_min,
      location: data.location,
      phase: data.phase,
      event_supplier_id: data.event_supplier_id,
      assigned_to_name: data.assigned_to_name,
      notes: data.notes,
      visible_to_guests: data.visible_to_guests,
      position: moments.length,
    })
    await fetchMoments()
  }

  const updateMoment = async (id: string, data: MomentDraft) => {
    await supabase.from('event_itinerary_moments').update({
      title: data.title,
      start_time: data.start_time,
      duration_min: data.duration_min,
      location: data.location,
      phase: data.phase,
      event_supplier_id: data.event_supplier_id,
      assigned_to_name: data.assigned_to_name,
      notes: data.notes,
      visible_to_guests: data.visible_to_guests,
    }).eq('id', id)
    await fetchMoments()
  }

  const deleteMoment = async (id: string) => {
    await supabase.from('event_itinerary_moments').delete().eq('id', id)
    await fetchMoments()
  }

  const toggleVisible = async (m: ItineraryMoment) => {
    setMoments(prev => prev.map(x => x.id === m.id ? { ...x, visible_to_guests: !x.visible_to_guests } : x))
    await supabase.from('event_itinerary_moments').update({ visible_to_guests: !m.visible_to_guests }).eq('id', m.id)
  }

  const setShareAll = async (on: boolean) => {
    setMoments(prev => prev.map(m => ({ ...m, visible_to_guests: on })))
    await supabase.from('event_itinerary_moments').update({ visible_to_guests: on }).eq('event_id', eventId)
  }

  const applyGenerated = async (gen: GeneratedMoment[]) => {
    const base = moments.length
    const rows = gen.map((g, i) => ({
      event_id: eventId,
      title: g.title,
      start_time: g.start_time,
      duration_min: g.duration_min,
      location: g.location,
      phase: g.phase,
      event_supplier_id: null,
      assigned_to_name: null,
      notes: g.notes,
      visible_to_guests: g.visible_to_guests,
      position: base + i,
    }))
    if (rows.length > 0) await supabase.from('event_itinerary_moments').insert(rows)
    setShowGenerate(false)
    await fetchMoments()
  }

  // ── Handlers UI ─────────────────────────────────────────────────────────────
  const openNew  = () => { setEditMoment(null); setShowModal(true) }
  const openEdit = (m: ItineraryMoment) => { setEditMoment(m); setShowModal(true) }
  const handleSave = async (data: MomentDraft) => {
    if (editMoment) await updateMoment(editMoment.id, data)
    else await createMoment(data)
    setShowModal(false); setEditMoment(null)
  }
  const handleDelete = async (m: ItineraryMoment) => {
    await deleteMoment(m.id)
    setShowModal(false); setEditMoment(null)
  }
  const handleShareToggle = () => {
    if (shareOn) {
      if (window.confirm('Esto ocultara el itinerario completo de la invitacion. Podras volver a mostrarlo despues.')) setShareAll(false)
    } else {
      setShareAll(true)
    }
  }

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
        {showGenerate && (
          <GenerateItineraryModal
            eventType={eventInfo?.event_type ?? null}
            eventCategory={eventInfo?.event_category ?? null}
            venue={eventInfo?.venue ?? null}
            onClose={() => setShowGenerate(false)}
            onGenerated={applyGenerated}
          />
        )}
        {showModal && (
          <MomentModal editMoment={null} eventId={eventId} suppliers={suppliers}
            onClose={() => setShowModal(false)} onSave={handleSave} onDelete={handleDelete} />
        )}
      </>
    )
  }

  // ── Vista con momentos ──────────────────────────────────────────────────────
  return (
    <div className="mt-2">
      {/* Barra compartir */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#ecdcb8] bg-[#fffdf7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {canEdit && !guestPreview && (
            <button
              onClick={handleShareToggle}
              className={['relative h-6 w-11 flex-shrink-0 rounded-full transition', shareOn ? 'bg-[#48C9B0]' : 'bg-[#e0e0e0]'].join(' ')}
              aria-label="Compartir en la invitacion"
            >
              <span className={['absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', shareOn ? 'left-[22px]' : 'left-0.5'].join(' ')} />
            </button>
          )}
          <div>
            <p className="text-sm font-medium text-[#1D1E20]">Compartir en la invitacion RSVP</p>
            <p className="text-[11px] text-[#999]">Los invitados ven {visibleCount} de {moments.length} momentos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGuestPreview(p => !p)}
            className={['flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition', guestPreview ? 'border-[#d4a853] bg-[#fffbf0] text-[#c49a3a]' : 'border-[#e0e0e0] text-[#888] hover:bg-[#f8f8f8]'].join(' ')}
          >
            <Eye size={13} />{guestPreview ? 'Vista organizador' : 'Ver como invitado'}
          </button>
          {canEdit && !guestPreview && (
            <button onClick={openNew}
              className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3ab89f]">
              <Plus size={14} />Momento
            </button>
          )}
        </div>
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

      {showModal && (
        <MomentModal editMoment={editMoment} eventId={eventId} suppliers={suppliers}
          onClose={() => { setShowModal(false); setEditMoment(null) }} onSave={handleSave} onDelete={handleDelete} />
      )}
      {showGenerate && (
        <GenerateItineraryModal
          eventType={eventInfo?.event_type ?? null}
          eventCategory={eventInfo?.event_category ?? null}
          venue={eventInfo?.venue ?? null}
          onClose={() => setShowGenerate(false)}
          onGenerated={applyGenerated}
        />
      )}
    </div>
  )
}
