import { entidadDeAccion } from './vocabulario'
import type { FilaAudit, Movimiento, Restauracion } from './tipos'

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

// De una fila de bitacora a algo insertable. null si no hay nada que regresar:
// sin old_value no hay contenido, sin entity_id no se podria marcar despues, y
// una entidad fuera del mapa de tablas no se adivina.
export function insercionDeFila(f: FilaAudit): Insercion | null {
  if (!f.old_value || !f.entity_id) return null
  const entidad = f.entity_type ?? entidadDeAccion(f.action)
  const tabla = TABLA_POR_ENTIDAD[entidad]
  if (!tabla) return null
  return {
    tabla,
    fila: f.old_value,
    entityId: f.entity_id,
    accionRestauracion: entidad + '.restored',
  }
}

// `filas` ya viene en created_at descendente desde agrupar(), que es el orden
// padre-primero: el hijo no entra si su padre todavia no existe.
export function planDeRestauracion(mov: Movimiento, soloEstos?: Set<string>): Insercion[] {
  const plan: Insercion[] = []

  for (const f of mov.filas) {
    if (soloEstos && (!f.entity_id || !soloEstos.has(f.entity_id))) continue
    const ins = insercionDeFila(f)
    if (ins) plan.push(ins)
  }

  return plan
}

// Lo que se fue colgando de otra cosa y quedo en un lote aparte.
//
// La app borra a los acompanantes en su propia transaccion, asi que el
// disparador les pone otro batch_id y caen en un movimiento distinto del de
// sus invitados. Restaurar a los invitados sin ellos es perdida silenciosa: el
// planner los ve de vuelta en la lista y no se entera de que perdio lugares
// hasta el dia del evento.
//
// Se sigue el DATO, no el reloj: el acompanante guarda de quien cuelga.
interface Dependiente {
  hija: string    // entidad del hijo, como la nombra el disparador
  padre: string   // entidad del padre
  llave: string   // columna del hijo que apunta al padre
}

export const DEPENDIENTES: Dependiente[] = [
  { hija: 'party_member', padre: 'guest', llave: 'guest_id' },
]

export function arrastrados(
  plan: Insercion[],
  filas: FilaAudit[],
  restaurados: Map<string, Restauracion>,
): FilaAudit[] {
  const padresPorEntidad = new Map<string, Set<string>>()
  for (const ins of plan) {
    const entidad = entidadDeAccion(ins.accionRestauracion)
    const set = padresPorEntidad.get(entidad) ?? new Set<string>()
    set.add(ins.entityId)
    padresPorEntidad.set(entidad, set)
  }

  const yaEnPlan = new Set(plan.map(p => p.entityId))
  const out: FilaAudit[] = []

  for (const dep of DEPENDIENTES) {
    const padres = padresPorEntidad.get(dep.padre)
    if (!padres) continue

    for (const f of filas) {
      if (f.action !== `${dep.hija}.deleted`) continue
      if (!f.entity_id || yaEnPlan.has(f.entity_id)) continue

      // Si ya volvio despues de este borrado, no hay nada que arrastrar.
      const volvio = restaurados.get(f.entity_id)
      if (volvio && volvio.cuando > new Date(f.created_at).getTime()) continue

      const idPadre = f.old_value?.[dep.llave]
      if (typeof idPadre === 'string' && padres.has(idPadre)) out.push(f)
    }
  }

  return out
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
