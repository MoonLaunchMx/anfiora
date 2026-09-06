import { supabase } from '@/lib/supabase'
import type { AuditAction, AuditEntityType } from '@/lib/actividad/vocabulario'

// El vocabulario vive en lib/actividad/vocabulario.ts, que es puro. Aqui se
// reexporta para no mover a ningun consumidor de sitio.
export type { AuditAction, AuditEntityType }
export {
  AUDIT_ACTION_LABEL,
  ACCIONES_BORRADO,
  ACCIONES_RESTAURACION,
  entidadDeAccion,
  esBorrado,
} from '@/lib/actividad/vocabulario'

// ============================================
// Payload que recibe logAction()
// ============================================
interface LogActionParams {
  eventId: string
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string
  entityLabel?: string   // nombre legible: "Juan García", "Mesa 5", etc.
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
}

// ============================================
// Función principal — llamar después de cada mutación exitosa
// Si falla el log, NO interrumpe el flujo principal (silent fail)
// ============================================
export async function logAction(params: LogActionParams): Promise<void> {
  try {
    // Obtener usuario actual de la sesión activa
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    // Obtener nombre del usuario desde la tabla users
    const { data: profile } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single()

    await supabase.from('event_audit_log').insert({
      event_id: params.eventId,
      user_id: user.id,
      user_email: user.email ?? '',
      user_name: profile?.full_name ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      entity_label: params.entityLabel ?? null,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
    })
  } catch {
    // Silent fail — el log nunca debe romper la operación principal
    console.warn('[audit] Error al registrar acción:', params.action)
  }
}

// ============================================
// Helper para leer el log de un evento (usado en /admin)
// ============================================
export async function getEventAuditLog(eventId: string, limit = 100) {
  const { data, error } = await supabase
    .from('event_audit_log')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[audit] Error al leer log:', error)
    return []
  }

  return data
}
