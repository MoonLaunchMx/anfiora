// Vocabulario de la bitacora. Puro a proposito: NO importa el cliente de
// Supabase. `lib/audit.ts` si lo hace, y montarlo cuesta variables de entorno
// que las pruebas no tienen — por eso lo que se prueba vive aqui y audit.ts
// solo lo reexporta.

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
  // Borrados que escriben los disparadores de Postgres (Tramo 3).
  | 'timeline_task.deleted'
  | 'itinerary_moment.deleted'
  | 'budget.deleted'
  | 'event_supplier.deleted'
  | 'payment.deleted'
  | 'gift_item.deleted'
  | 'song.deleted'
  // Restauraciones que escribe la pantalla de Actividad (Tramo 4).
  | 'guest.restored'
  | 'party_member.restored'
  | 'table.restored'
  | 'timeline_task.restored'
  | 'itinerary_moment.restored'
  | 'budget.restored'
  | 'event_supplier.restored'
  | 'payment.restored'
  | 'gift_item.restored'
  | 'song.restored'

export type AuditEntityType =
  | 'guest'
  | 'party_member'
  | 'table'
  | 'event'
  | 'settings'
  | 'collaborator'
  | 'timeline_task'
  | 'itinerary_moment'
  | 'budget'
  | 'event_supplier'
  | 'payment'
  | 'gift_item'
  | 'song'

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
  'timeline_task.deleted':     'Tarea eliminada',
  'itinerary_moment.deleted':  'Momento del itinerario eliminado',
  'budget.deleted':            'Partida eliminada',
  'event_supplier.deleted':    'Proveedor quitado de la boda',
  'payment.deleted':           'Pago eliminado',
  'gift_item.deleted':         'Regalo eliminado',
  'song.deleted':              'Canción eliminada',
  'guest.restored':            'Invitado restaurado',
  'party_member.restored':     'Acompañante restaurado',
  'table.restored':            'Mesa restaurada',
  'timeline_task.restored':    'Tarea restaurada',
  'itinerary_moment.restored': 'Momento del itinerario restaurado',
  'budget.restored':           'Partida restaurada',
  'event_supplier.restored':   'Proveedor restaurado',
  'payment.restored':          'Pago restaurado',
  'gift_item.restored':        'Regalo restaurado',
  'song.restored':             'Canción restaurada',
}

// ============================================
// Borrado y restauracion
// Los borrados NO los escribe logAction(): los escriben los disparadores de
// Postgres del Tramo 3, que son SECURITY DEFINER y no fallan en silencio.
// Aqui solo se nombran para poder leerlos y restaurarlos.
// ============================================
export const ACCIONES_BORRADO = [
  'guest.deleted', 'party_member.deleted', 'table.deleted',
  'timeline_task.deleted', 'itinerary_moment.deleted', 'budget.deleted',
  'event_supplier.deleted', 'payment.deleted', 'gift_item.deleted', 'song.deleted',
] as const satisfies readonly AuditAction[]

export const ACCIONES_RESTAURACION = ACCIONES_BORRADO
  .map(a => a.replace('.deleted', '.restored')) as unknown as readonly AuditAction[]

export function entidadDeAccion(accion: string): string {
  return accion.split('.')[0] ?? ''
}

export function esBorrado(accion: string): boolean {
  return (ACCIONES_BORRADO as readonly string[]).includes(accion)
}
