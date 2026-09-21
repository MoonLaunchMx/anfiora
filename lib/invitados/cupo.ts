export function contarPersonas(invitados: number, acompanantes: number): number {
  return invitados + acompanantes
}

export function lugaresLibres(personas: number, limite: number | null): number | null {
  if (limite === null) return null
  return Math.max(0, limite - personas)
}

// Una edicion que borra acompanantes y agrega otros en la misma operacion
// nunca se mide con lugaresLibres: esa cuenta cupo NUEVO contra el total de
// ANTES, y una cuenta que ya paso el tope siempre tiene cero lugares libres,
// aunque este intercambio la deje mas chica. La regla real es otra: lo unico
// que se bloquea es que la cuenta CREZCA mas alla de lo que ya tenia y siga
// por encima del tope. Intercambiar, o de plano achicar, siempre se deja pasar.
export function bloqueaPorTope(personasAntes: number, personasDespues: number, limite: number | null): boolean {
  if (limite === null) return false
  return personasDespues > personasAntes && personasDespues > limite
}

// Borrar acompanantes viejos e insertar los nuevos son DOS escrituras
// separadas (no una transaccion), y el disparador de la base juzga el TOTAL
// del evento en cada una, no si la operacion "crece". Mirar solo el
// crecimiento (porInsertar <= porBorrar) esta mal: en una cuenta de 213 con
// tope 50, quitar 5 y agregar 1 no crece, pero borrar primero deja el total
// en 208 -- SIGUE arriba de 50 -- y el insert se rechaza igual. Peor: la
// restauracion (devolver lo borrado) es OTRO insert, y tambien se rechaza
// por la misma razon, perdiendo los 5 acompanantes para siempre.
//
// La pregunta correcta es: "despues de borrar, ¿los nuevos caben debajo del
// tope?" -- total - porBorrar + porInsertar <= limite. Si caben, borrar
// primero es seguro (libera lugar y el insert entra: la cuenta de 50 de 50
// que cambia un acompanante por otro baja a 49 y sube a 50, nunca ve el
// muro). Si NO caben, insertar primero: falla sin haber borrado nada, y el
// aviso de tope es honesto, porque esa cuenta de verdad no puede hacer ese
// intercambio en NINGUN orden mientras siga tan arriba del tope.
export function borrarPrimero(total: number, porBorrar: number, porInsertar: number, limite: number | null): boolean {
  if (limite === null) return true
  return total - porBorrar + porInsertar <= limite
}

// La importacion nunca rechaza el archivo completo: entran las filas que
// caben, en orden, sin partir ninguna (una fila es un invitado + sus
// acompanantes, todos entran juntos o ninguno). tamanos[i] es 1 + los
// acompanantes de esa fila.
export function cuantasFilasCaben(
  tamanos: number[],
  personas: number,
  limite: number | null,
): { filas: number; personasImportadas: number; personasFuera: number } {
  const totalPersonas = tamanos.reduce((a, b) => a + b, 0)
  const libres = lugaresLibres(personas, limite)
  if (libres === null) return { filas: tamanos.length, personasImportadas: totalPersonas, personasFuera: 0 }
  let filas = 0
  let personasImportadas = 0
  for (const t of tamanos) {
    if (personasImportadas + t > libres) break
    personasImportadas += t
    filas++
  }
  return { filas, personasImportadas, personasFuera: totalPersonas - personasImportadas }
}

export function parseErrorInvitados(msg: string): { personas: number; limite: number } | null {
  const m = msg.match(/INVITADOS_LIMITE:(\d+):(\d+)/)
  return m ? { personas: Number(m[1]), limite: Number(m[2]) } : null
}

export function esErrorDeInvitados(error: { message: string } | null): boolean {
  return !!error && parseErrorInvitados(error.message) !== null
}
