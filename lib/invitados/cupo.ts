export function contarPersonas(invitados: number, acompanantes: number): number {
  return invitados + acompanantes
}

export function lugaresLibres(personas: number, limite: number | null): number | null {
  if (limite === null) return null
  return Math.max(0, limite - personas)
}

export function cuantasCaben(
  porAgregar: number,
  personas: number,
  limite: number | null,
): { caben: number; sobran: number } {
  const libres = lugaresLibres(personas, limite)
  if (libres === null) return { caben: porAgregar, sobran: 0 }
  const caben = Math.min(porAgregar, libres)
  return { caben, sobran: porAgregar - caben }
}

// Una edicion que borra acompanantes y agrega otros en la misma operacion
// nunca se mide con lugaresLibres/cuantasCaben: esas cuentan cupo NUEVO
// contra el total de ANTES, y una cuenta que ya paso el tope siempre tiene
// cero lugares libres, aunque este intercambio la deje mas chica. La regla
// real es otra: lo unico que se bloquea es que la cuenta CREZCA mas alla de
// lo que ya tenia y siga por encima del tope. Intercambiar, o de plano
// achicar, siempre se deja pasar.
export function bloqueaPorTope(personasAntes: number, personasDespues: number, limite: number | null): boolean {
  if (limite === null) return false
  return personasDespues > personasAntes && personasDespues > limite
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
