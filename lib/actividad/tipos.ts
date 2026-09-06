import type { Modulo } from '@/lib/permisos/catalogo'

// La fila cruda de event_audit_log. user_email es NOT NULL en la base;
// user_id y user_name aceptan NULL (los borrados por service role corren
// sin auth.uid()).
export interface FilaAudit {
  id: string
  event_id: string
  user_id: string | null
  user_email: string
  user_name: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  entity_label: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  modulo: string | null
  batch_id: string | null
  created_at: string
}

export interface Movimiento {
  clave: string            // estable entre repintados: batch_id, o id de la primera fila
  accion: string           // action de la primera fila
  etiquetaAccion: string   // de AUDIT_ACTION_LABEL, o la action cruda si no hay
  modulo: Modulo | null    // null = movimiento que no pertenece a una herramienta (equipo, evento)
  persona: string          // user_name, o user_email si no hay nombre
  personaId: string | null
  cuando: string           // created_at mas reciente del grupo
  esBorrado: boolean
  batchId: string | null
  filas: FilaAudit[]       // ordenadas created_at DESC = padre primero al restaurar
  total: number            // filas.length, para no recalcularlo en la pantalla
  restaurado: boolean      // todas sus filas ya se restauraron
}
