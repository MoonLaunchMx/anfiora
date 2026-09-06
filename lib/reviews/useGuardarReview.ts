'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermiso } from '@/lib/event-access-context'
import type { BorradorReview } from './validacion'

interface IdentidadReview {
  eventSupplierId: string
  supplierId: string
  eventId: string
  userId: string
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
      user_id: identidad.userId, supplier_id: identidad.supplierId, event_id: identidad.eventId,
      event_supplier_id: identidad.eventSupplierId, autor: 'planner',
      ...borrador,
      ...camposExtra,
      created_by: identidad.userId,
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
