'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ItineraryMoment } from '@/lib/types'
import { eventDays, groupByDay } from '@/lib/itinerary'
import { useEventAccess } from '@/lib/event-access-context'
import { interpretarEscritura } from '@/lib/invite/persistencia'
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

const NO_SE_PUDO_LEER = 'No se pudo cargar el itinerario. Revisa tu conexión y vuelve a intentarlo.'

// Lo que devuelve cualquier consulta de Supabase una vez que le pedimos .select().
type RespuestaSupabase = { error: { code?: string; message?: string } | null; data: unknown[] | null }

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
  const [activeDay, setActiveDay] = useState<string>('')
  const [fallo, setFallo] = useState<string | null>(null)

  const fetchMoments = useCallback(async () => {
    const { data, error } = await supabase
      .from('event_itinerary_moments')
      .select('*, event_supplier:event_supplier_id(id, supplier:supplier_id(id, name))')
      .eq('event_id', eventId)
      .order('moment_date', { ascending: true })
      .order('position', { ascending: true })
    // Una lectura fallida y un itinerario vacio se ven igual si no separamos los casos:
    // el planner creeria que no hay nada y lo armaria encima de lo que si existe.
    if (error) { setFallo(NO_SE_PUDO_LEER); return }
    setFallo(null)
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
        const filas = (data || []) as unknown as { id: string; supplier: { name?: string } | null }[]
        setSuppliers(filas.map(s => ({ id: s.id, name: s.supplier?.name || 'Proveedor' })))
      })
  }, [active, eventId, fetchMoments])

  const days = useMemo(
    () => eventDays(eventInfo?.event_date ?? null, eventInfo?.event_end_date ?? null),
    [eventInfo?.event_date, eventInfo?.event_end_date],
  )
  const { inRange, orphans } = useMemo(() => groupByDay(moments, days), [moments, days])
  const visibleCount = moments.filter(m => m.visible_to_guests).length

  // ── Persistencia en event_itinerary_moments ────────────────────────────────
  // Toda escritura pasa por aqui. El .select() de cada llamada no es decorativo:
  // un UPDATE o un DELETE filtrado por RLS devuelve cero filas y NINGUN error, asi
  // que sin contar las filas un guardado rechazado se ve igual que uno exitoso.
  const escribir = async (op: PromiseLike<RespuestaSupabase>): Promise<boolean> => {
    const resultado = interpretarEscritura(await op)
    if (!resultado.ok) { setFallo(resultado.motivo); return false }
    setFallo(null)
    return true
  }

  const createMoment = async (data: MomentDraft) => {
    const ok = await escribir(supabase.from('event_itinerary_moments').insert({
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
    }).select('id'))
    if (ok) await fetchMoments()
    return ok
  }

  const updateMoment = async (id: string, data: MomentDraft) => {
    const ok = await escribir(supabase.from('event_itinerary_moments').update({
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
    }).eq('id', id).select('id'))
    if (ok) await fetchMoments()
    return ok
  }

  const deleteMoment = async (id: string) => {
    const ok = await escribir(supabase.from('event_itinerary_moments').delete().eq('id', id).select('id'))
    if (ok) await fetchMoments()
    return ok
  }

  const toggleVisible = async (m: ItineraryMoment) => {
    const siguiente = !m.visible_to_guests
    setMoments(prev => prev.map(x => x.id === m.id ? { ...x, visible_to_guests: siguiente } : x))
    const ok = await escribir(
      supabase.from('event_itinerary_moments').update({ visible_to_guests: siguiente }).eq('id', m.id).select('id'),
    )
    // El ojo ya se pinto: si la escritura no paso hay que devolverlo a como estaba,
    // o la pantalla se queda diciendo algo que la base nunca guardo.
    if (!ok) setMoments(prev => prev.map(x => x.id === m.id ? { ...x, visible_to_guests: !siguiente } : x))
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
    if (rows.length === 0) { setShowGenerate(false); return true }
    const ok = await escribir(supabase.from('event_itinerary_moments').insert(rows).select('id'))
    if (!ok) return false
    setShowGenerate(false)
    await fetchMoments()
    return true
  }

  const deleteDay = async (date: string) => {
    const ok = await escribir(
      supabase.from('event_itinerary_moments').delete().eq('event_id', eventId).eq('moment_date', date).select('id'),
    )
    if (ok) await fetchMoments()
    return ok
  }

  // ── Handlers UI ─────────────────────────────────────────────────────────────
  const openNew    = (date?: string) => { setEditMoment(null); setNewDate(date || days[0] || ''); setShowModal(true) }
  const openEdit   = (m: ItineraryMoment) => { setEditMoment(m); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditMoment(null) }
  const openTemplate = (date?: string) => { setTemplateDate(date || activeDay || days[0] || ''); setShowGenerate(true) }

  // El modal solo se cierra si la escritura paso. Si no, se queda abierto con lo que
  // el usuario escribio y el aviso flota encima explicando por que no se guardo.
  const handleSave = async (data: MomentDraft) => {
    const ok = editMoment ? await updateMoment(editMoment.id, data) : await createMoment(data)
    if (ok) closeModal()
  }
  const handleDelete = async (m: ItineraryMoment) => {
    if (await deleteMoment(m.id)) closeModal()
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
    activeDay,
    setActiveDay,
    showGenerate,
    setShowGenerate,
    fallo,
    descartarFallo: () => setFallo(null),
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
