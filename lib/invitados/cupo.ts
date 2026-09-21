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

export function parseErrorInvitados(msg: string): { personas: number; limite: number } | null {
  const m = msg.match(/INVITADOS_LIMITE:(\d+):(\d+)/)
  return m ? { personas: Number(m[1]), limite: Number(m[2]) } : null
}

export function esErrorDeInvitados(error: { message: string } | null): boolean {
  return !!error && parseErrorInvitados(error.message) !== null
}
