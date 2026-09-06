import {
  ACCIONES_RESTAURACION, AUDIT_ACTION_LABEL, esBorrado, type AuditAction,
} from './vocabulario'
import { MODULOS, type Modulo } from '@/lib/permisos/catalogo'
import type { FilaAudit, Movimiento, Restauracion } from './tipos'
import {
  dependienteDe, esEntidadHija, idPadreDe, rangoDeEntidad,
} from './dependientes'

// Cuanto silencio parte una tanda de ediciones en dos. Diez minutos separa
// "estuvo capturando confirmaciones" de "volvio despues de comer".
export const VENTANA_MS = 10 * 60 * 1000

const ES_MODULO = new Set<string>(MODULOS)

const ts = (f: FilaAudit) => new Date(f.created_at).getTime()

function moduloValido(m: string | null): Modulo | null {
  return m && ES_MODULO.has(m) ? (m as Modulo) : null
}

// entity_id -> cuando volvio por ULTIMA vez, en ms.
//
// Tiene que ser "cuando" y no solo "si": una entidad se puede borrar,
// restaurar y volver a borrar. Con un simple conjunto de ids, el borrado nuevo
// heredaba el "Restaurado" del anterior y se quedaba sin boton para deshacerlo.
export function mapaDeRestauraciones(filas: FilaAudit[]): Map<string, Restauracion> {
  const mapa = new Map<string, Restauracion>()
  for (const f of filas) {
    if (!f.entity_id) continue
    if (!(ACCIONES_RESTAURACION as readonly string[]).includes(f.action)) continue
    const cuando = ts(f)
    const previa = mapa.get(f.entity_id)
    if (previa === undefined || cuando > previa.cuando) {
      mapa.set(f.entity_id, {
        cuando,
        fecha: f.created_at,
        persona: f.user_name ?? f.user_email,
      })
    }
  }
  return mapa
}

function armar(filas: FilaAudit[], restaurados: Map<string, Restauracion>): Movimiento {
  // PRIMERO la jerarquia, y solo despues el reloj.
  //
  // Las filas de una misma transaccion comparten created_at hasta el
  // microsegundo, asi que ordenar por fecha dejaba arriba a quien cayera
  // primero: un proveedor con dos pagos salia titulado "Pago eliminado", y —lo
  // grave— se reinsertaban en ese mismo orden de azar, con el pago intentando
  // entrar antes que su proveedor.
  const orden = [...filas].sort(
    (a, b) => rangoDeEntidad(a.entity_type) - rangoDeEntidad(b.entity_type) || ts(b) - ts(a),
  )

  // Con el orden ya puesto, la cabeza es la primera: un padre si lo hay.
  const cabeza = orden[0]

  // Cuenta como dependiente solo si su padre viene en el MISMO movimiento. Un
  // acompanante borrado por su cuenta es el principal de su propio renglon, no
  // un huerfano.
  const presentes = new Set(orden.map(f => f.entity_id).filter((x): x is string => x !== null))
  const colgados = orden.filter(f => {
    const id = idPadreDe(f.entity_type, f.old_value)
    return id !== null && presentes.has(id)
  })
  const dependientes = colgados.length

  const dep = colgados.length > 0 ? dependienteDe(colgados[0].entity_type) : null
  const arrastreTexto = dep
    ? `+${dependientes} ${dependientes === 1 ? dep.uno : dep.varios}`
    : null
  const borrado = esBorrado(cabeza.action)

  // Solo cuenta la restauracion POSTERIOR a cada borrado. Si volvio antes, es
  // que se volvio a borrar y hay que poder deshacerlo otra vez.
  const vueltas = orden.map(f =>
    f.entity_id ? restaurados.get(f.entity_id) : undefined)
  const restaurado = borrado && vueltas.every((v, i) => v !== undefined && v.cuando > ts(orden[i]))
  const ultima = restaurado
    ? vueltas.reduce<Restauracion | undefined>(
        (max, v) => (v && (!max || v.cuando > max.cuando) ? v : max), undefined)
    : undefined

  return {
    clave: cabeza.batch_id ?? cabeza.id,
    accion: cabeza.action,
    etiquetaAccion: AUDIT_ACTION_LABEL[cabeza.action as AuditAction] ?? cabeza.action,
    modulo: moduloValido(cabeza.modulo),
    persona: cabeza.user_name ?? cabeza.user_email,
    personaId: cabeza.user_id,
    cuando: cabeza.created_at,
    esBorrado: borrado,
    batchId: cabeza.batch_id,
    filas: orden,
    total: orden.length,
    principales: orden.length - dependientes,
    dependientes,
    arrastreTexto,
    restaurado,
    // La mas reciente de las que lo trajeron de vuelta: si el lote se restauro
    // en dos tandas, la que cierra la historia es la ultima.
    restauracion: restaurado && ultima
      ? { persona: ultima.persona, cuando: ultima.fecha }
      : null,
  }
}

const esRestauracion = (accion: string) =>
  (ACCIONES_RESTAURACION as readonly string[]).includes(accion)

export function agrupar(filas: FilaAudit[], restaurados: Map<string, Restauracion>): Movimiento[] {
  if (filas.length === 0) return []

  const porLote = new Map<string, FilaAudit[]>()
  const sueltas: FilaAudit[] = []

  // Las restauraciones NO se dibujan: ya las conto mapaDeRestauraciones(), y
  // su efecto se ve en el borrado, que pasa a decir "Restaurado". Pintarlas
  // aparte contaria la misma historia dos veces. En la base siguen estando.
  filas = filas.filter(f => !esRestauracion(f.action))

  // Donde cayo el borrado de cada entidad, para que sus hijos lo alcancen.
  const loteDeEntidad = new Map<string, string>()
  for (const f of filas) {
    if (f.batch_id && f.entity_id && esBorrado(f.action) && !esEntidadHija(f.entity_type)) {
      loteDeEntidad.set(f.entity_id, f.batch_id)
    }
  }

  // El acompanante se va al lote de SU invitado. La app los borra en
  // transacciones distintas, asi que por batch_id solos saldrian como dos
  // renglones —"Invitado eliminado" y "2 acompanantes eliminados"— como si no
  // tuvieran nada que ver. Si su invitado no esta en la bitacora, se queda
  // donde estaba: es un borrado por su cuenta.
  const loteDe = (f: FilaAudit): string | null => {
    if (!f.batch_id) return null
    const idPadre = idPadreDe(f.entity_type, f.old_value)
    if (idPadre) return loteDeEntidad.get(idPadre) ?? f.batch_id
    return f.batch_id
  }

  // Los borrados vienen del disparador y siempre traen batch_id: una
  // transaccion es un lote. Las ediciones vienen de logAction() y no traen
  // nada, asi que se agrupan por parecido.
  for (const f of filas) {
    const lote = esBorrado(f.action) ? loteDe(f) : null
    if (lote) {
      const previas = porLote.get(lote)
      if (previas) previas.push(f)
      else porLote.set(lote, [f])
    } else {
      sueltas.push(f)
    }
  }

  const grupos: FilaAudit[][] = [...porLote.values()]

  const ordenadas = [...sueltas].sort((a, b) => ts(b) - ts(a))
  let actual: FilaAudit[] = []

  const mismaTanda = (a: FilaAudit, b: FilaAudit) =>
    a.user_id === b.user_id &&
    a.action === b.action &&
    a.modulo === b.modulo &&
    Math.abs(ts(a) - ts(b)) <= VENTANA_MS

  for (const f of ordenadas) {
    // Se compara contra la ultima de la tanda, no contra la primera: asi una
    // captura larga se mantiene junta mientras no haya un hueco real.
    if (actual.length > 0 && mismaTanda(actual[actual.length - 1], f)) {
      actual.push(f)
    } else {
      if (actual.length > 0) grupos.push(actual)
      actual = [f]
    }
  }
  if (actual.length > 0) grupos.push(actual)

  return grupos
    .map(g => armar(g, restaurados))
    .sort((a, b) => new Date(b.cuando).getTime() - new Date(a.cuando).getTime())
}
