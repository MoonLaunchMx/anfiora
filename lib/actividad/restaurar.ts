import { entidadDeAccion } from './vocabulario'
import type { Movimiento } from './tipos'

// La entidad que escribe el disparador -> la tabla de la que salio. Los
// nombres de entidad vienen del segundo argumento de log_borrado() en los
// .sql del Tramo 3.
export const TABLA_POR_ENTIDAD: Record<string, string> = {
  guest:            'guests',
  party_member:     'party_members',
  table:            'tables',
  timeline_task:    'event_timeline_tasks',
  itinerary_moment: 'event_itinerary_moments',
  budget:           'event_budgets',
  event_supplier:   'event_suppliers',
  payment:          'supplier_payments',
  gift_item:        'gift_registry_items',
  song:             'song_recommendations',
}

export interface Insercion {
  tabla: string
  fila: Record<string, unknown>
  entityId: string
  accionRestauracion: string
}

// `filas` ya viene en created_at descendente desde agrupar(), que es el orden
// padre-primero: el hijo no entra si su padre todavia no existe.
export function planDeRestauracion(mov: Movimiento, soloEstos?: Set<string>): Insercion[] {
  const plan: Insercion[] = []

  for (const f of mov.filas) {
    if (!f.old_value || !f.entity_id) continue
    if (soloEstos && !soloEstos.has(f.entity_id)) continue

    const entidad = f.entity_type ?? entidadDeAccion(f.action)
    const tabla = TABLA_POR_ENTIDAD[entidad]
    if (!tabla) continue

    plan.push({
      tabla,
      fila: f.old_value,
      entityId: f.entity_id,
      accionRestauracion: entidad + '.restored',
    })
  }

  return plan
}

// 23505 = unique_violation. Restaurar dos veces lo mismo choca contra la
// llave primaria, y eso no es un error que reportar: es "ya estaba".
export function esConflictoDeLlave(error: { code?: string } | null): boolean {
  return error?.code === '23505'
}

// Parte el plan en tandas de inserciones seguidas de la MISMA tabla, para
// mandarlas de un viaje en vez de una por una. Restaurar 42 invitados pasaba
// por 42 viajes al servidor.
//
// Corta al cambiar de tabla y NO reordena: dentro de una tabla el orden da
// igual, pero entre tablas es la dependencia (el acompanante no entra si su
// invitado todavia no existe). Juntar tablas separadas rompeeria eso.
export function tandasPorTabla(plan: Insercion[]): Insercion[][] {
  const tandas: Insercion[][] = []
  for (const ins of plan) {
    const ultima = tandas[tandas.length - 1]
    if (ultima && ultima[0].tabla === ins.tabla) ultima.push(ins)
    else tandas.push([ins])
  }
  return tandas
}
