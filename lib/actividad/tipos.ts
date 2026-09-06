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
  principales: number      // las que no cuelgan de otra: los invitados
  dependientes: number     // las que si: sus acompanantes
  restaurado: boolean      // todas sus filas ya se restauraron
  // Quien lo trajo de vuelta y cuando. null si sigue borrado. Los grandes
  // muestran esto en el renglon; el dato ya lo escribiamos, faltaba pintarlo.
  restauracion: { persona: string; cuando: string } | null
}

// Lo que se sabe de la ultima vez que una entidad volvio.
export interface Restauracion {
  cuando: number   // ms, para comparar contra la fecha del borrado
  fecha: string    // el created_at crudo, para pintarlo
  persona: string
}
