'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermiso } from '@/lib/event-access-context'
import type { BorradorReview } from './validacion'

// OJO, y es la razon de que estos dos campos se llamen distinto: `duenoId` es el
// DUENO DE LA CUENTA (events.user_id), no quien esta tecleando. La columna
// supplier_reviews.user_id es la misma llave que usan `suppliers` y `categories`
// -- el catalogo es del despacho -- y las policies de la tabla la leen asi. Si
// aqui entrara el id de la sesion, la review de un colaborador quedaria colgada
// de el: el dueno no la veria nunca, el score historico del proveedor se
// partiria por persona, y el upsert chocaria con el indice unico contra una fila
// que su propio UPDATE no alcanza. Quien la escribio se guarda en `createdBy`,
// que es exactamente para lo que existe.
interface IdentidadReview {
  eventSupplierId: string
  supplierId: string
  eventId: string
  duenoId: string
  createdBy: string
}

const MENSAJE_ERROR_GUARDADO = 'No se pudo guardar la review. Intenta de nuevo.'

export function useGuardarReview(identidad: IdentidadReview) {
  const permiso = usePermiso('proveedores')
  const [saving, setSaving] = useState(false)

  const guardar = async (
    borrador: BorradorReview,
    camposExtra?: Record<string, unknown>
  ): Promise<string | null> => {
    if (!permiso.editar) return MENSAJE_ERROR_GUARDADO

    setSaving(true)
    const { data, error } = await supabase.from('supplier_reviews').upsert({
      user_id: identidad.duenoId, supplier_id: identidad.supplierId, event_id: identidad.eventId,
      event_supplier_id: identidad.eventSupplierId, autor: 'planner',
      ...borrador,
      ...camposExtra,
      created_by: identidad.createdBy,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_supplier_id,review_type,autor' }).select()

    if (error) {
      console.error('Error guardando review:', error)
      setSaving(false)
      return MENSAJE_ERROR_GUARDADO
    }
    if (!data || data.length === 0) {
      console.error('El upsert de la review no devolvio filas (posible RLS).')
      setSaving(false)
      return MENSAJE_ERROR_GUARDADO
    }
    return null
  }

  return { permiso, saving, guardar }
}
