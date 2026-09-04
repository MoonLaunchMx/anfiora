import { supabase } from '@/lib/supabase'

// ============================================
// Tipos de acciones auditables
// Formato: entidad.accion
// ============================================
export type AuditAction =
  | 'guest.created'
  | 'guest.updated'
  | 'guest.deleted'
  | 'guest.rsvp_updated'
  | 'guest.checked_in'
  | 'guest.payment_confirmed'
  | 'guest.payment_undone'
  | 'party_member.created'
  | 'party_member.deleted'
  | 'party_member.rsvp_updated'
  | 'table.created'
  | 'table.updated'
  | 'table.deleted'
  | 'table.guest_assigned'
  | 'table.guest_removed'
  | 'event.updated'
  | 'event.settings_updated'
  | 'collaborator.invited'
  | 'collaborator.revoked'
  | 'collaborator.accepted'
  | 'collaborator.permissions_updated'

export type AuditEntityType =
  | 'guest'
  | 'party_member'
  | 'table'
  | 'event'
  | 'settings'
  | 'collaborator'

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

// ============================================
// Labels legibles para la UI del audit log
// ============================================
export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  'guest.created': 'Invitado agregado',
  'guest.updated': 'Invitado editado',
  'guest.deleted': 'Invitado eliminado',
  'guest.rsvp_updated': 'RSVP actualizado',
  'guest.checked_in': 'Check-in realizado',
  'guest.payment_confirmed': 'Pago confirmado',
  'guest.payment_undone': 'Pago revertido',
  'party_member.created': 'Acompañante agregado',
  'party_member.deleted': 'Acompañante eliminado',
  'party_member.rsvp_updated': 'RSVP de acompañante actualizado',
  'table.created': 'Mesa creada',
  'table.updated': 'Mesa editada',
  'table.deleted': 'Mesa eliminada',
  'table.guest_assigned': 'Invitado asignado a mesa',
  'table.guest_removed': 'Invitado removido de mesa',
  'event.updated': 'Evento editado',
  'event.settings_updated': 'Configuración actualizada',
  'collaborator.invited': 'Colaborador invitado',
  'collaborator.revoked': 'Acceso revocado',
  'collaborator.accepted': 'Invitación aceptada',
  'collaborator.permissions_updated': 'Accesos del colaborador actualizados',
}