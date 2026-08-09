'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ItineraryMoment } from '@/lib/types'
import { eventDays, groupByDay } from '@/lib/itinerary'
import { useEventAccess } from '@/lib/event-access-context'
import type { TemplateMoment } from '@/lib/itinerary-templates'
import type { MomentDraft } from './MomentModal'

export interface ItineraryEventInfo {
  event_date: string | null
  event_end_date: string | null
  event_type: string | null
  event_category: string | null
  event_time?: string | null
  venue?: string | null
}

// Estado compartido del itinerario: lo consumen tanto la barra superior
// (ItineraryToolbar, montada en el header de la pagina) como el cuerpo
// (ItineraryView). Vive en el hook para que ambos vean el mismo estado.
export function useItinerary(eventId: string, eventInfo: ItineraryEventInfo | null, active: boolean) {
  const { canEdit } = useEventAccess()

  const [moments, setMoments]       = useState<ItineraryMoment[]>([])
  const [suppliers, setSuppliers]   = useState<{ id: string; name: string }[]>([])
  const [showModal, setShowModal]   = useState(false)
  const [editMoment, setEditMoment] = useState<ItineraryMoment | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [guestPreview, setGuestPreview] = useState(false)
  const [newDate, setNewDate] = useState<string>('')
  const [templateDate, setTemplateDate] = useState<string>('')

  const fetchMoments = useCallback(async () => {
    const { data } = await supabase
      .from('event_itinerary_moments')
      .select('*, event_supplier:event_supplier_id(id, supplier:supplier_id(id, name))')
      .eq('event_id', eventId)
      .order('moment_date', { ascending: true })
      .order('position', { ascending: true })
    setMoments((data || []) as ItineraryMoment[])
  }, [eventId])

  useEffect(() => {
    if (!active) return
    fetchMoments()
    supabase
      .from('event_suppliers')
      .select('id, supplier:supplier_id(id, name)')
      .eq('event_id', eventId)
      .then(({ data }) => {
        setSuppliers((data || []).map((s: any) => ({ id: s.id, name: s.supplier?.name || 'Proveedor' })))
      })
  }, [active, eventId, fetchMoments])

  const days = useMemo(
    () => eventDays(eventInfo?.event_date ?? null, eventInfo?.event_end_date ?? null),
    [eventInfo?.event_date, eventInfo?.event_end_date],
  )
  const { inRange, orphans } = useMemo(() => groupByDay(moments, days), [moments, days])
  const visibleCount = moments.filter(m => m.visible_to_guests).length

  // ── Persistencia en event_itinerary_moments ────────────────────────────────
  const createMoment = async (data: MomentDraft) => {
    await supabase.from('event_itinerary_moments').insert({
      event_id: eventId,
      title: data.title,
      moment_date: data.moment_date,
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
      moment_date: data.moment_date,
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

  const applyTemplate = async (gen: TemplateMoment[]) => {
    const base = moments.length
    const rows = gen.map((g, i) => ({
      event_id: eventId,
      moment_date: g.moment_date,
      title: g.title,
      start_time: g.start_time,
      duration_min: g.duration_min,
      location: null,
      phase: g.phase,
      event_supplier_id: null,
      assigned_to_name: null,
      notes: null,
      visible_to_guests: g.visible_to_guests,
      position: base + i,
    }))
    if (rows.length > 0) await supabase.from('event_itinerary_moments').insert(rows)
    setShowGenerate(false)
    await fetchMoments()
  }

  const deleteDay = async (date: string) => {
    await supabase.from('event_itinerary_moments').delete().eq('event_id', eventId).eq('moment_date', date)
    await fetchMoments()
  }

  // ── Handlers UI ─────────────────────────────────────────────────────────────
  const openNew    = (date?: string) => { setEditMoment(null); setNewDate(date || days[0] || ''); setShowModal(true) }
  const openEdit   = (m: ItineraryMoment) => { setEditMoment(m); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditMoment(null) }
  const openTemplate = (date?: string) => { setTemplateDate(date || days[0] || ''); setShowGenerate(true) }

  const handleSave = async (data: MomentDraft) => {
    if (editMoment) await updateMoment(editMoment.id, data)
    else await createMoment(data)
    closeModal()
  }
  const handleDelete = async (m: ItineraryMoment) => {
    await deleteMoment(m.id)
    closeModal()
  }
  return {
    eventInfo,
    canEdit,
    moments,
    days,
    inRange,
    orphans,
    suppliers,
    visibleCount,
    guestPreview,
    setGuestPreview,
    showModal,
    editMoment,
    newDate,
    templateDate,
    showGenerate,
    setShowGenerate,
    openNew,
    openEdit,
    openTemplate,
    closeModal,
    handleSave,
    handleDelete,
    toggleVisible,
    applyTemplate,
    deleteDay,
  }
}

export type ItineraryController = ReturnType<typeof useItinerary>
