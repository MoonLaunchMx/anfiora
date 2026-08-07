// Saber si una escritura a Supabase de verdad ocurrio.
//
// Hay DOS formas de fallar y solo una levanta error:
//   - INSERT/upsert rechazado por RLS  -> error 42501.
//   - UPDATE filtrado por RLS          -> cero filas y NINGUN error.
// Por eso quien llama debe pedir las filas con .select(): sin ellas, el segundo
// caso es indistinguible del exito. Es el bug que dejo la invitacion diciendo
// "Publicada" sin haber guardado nada.

export type ResultadoEscritura =
  | { ok: true }
  | { ok: false; tipo: 'permiso' | 'error'; motivo: string }

type ErrorLike = { code?: string; message?: string }

const SIN_PERMISO =
  'No tienes permiso para guardar estos cambios. Pídele al organizador que te dé acceso de editor.'

const FALLO_GENERICO = 'No se pudieron guardar los cambios. Vuelve a intentarlo.'

function esFaltaDePermiso(error: ErrorLike): boolean {
  return error.code === '42501' || /row-level security/i.test(error.message ?? '')
}

export function interpretarEscritura(
  res: { error: ErrorLike | null | undefined; data: unknown[] | null | undefined },
): ResultadoEscritura {
  const { error, data } = res

  if (error) {
    if (esFaltaDePermiso(error)) {
      // El candado de configuracion (trigger guard_event_config) usa 42501 con un
      // mensaje que ya esta escrito para el usuario: se muestra tal cual.
      const propio = error.message?.startsWith('Solo el administrador')
      return { ok: false, tipo: 'permiso', motivo: propio ? error.message! : SIN_PERMISO }
    }
    return { ok: false, tipo: 'error', motivo: error.message || FALLO_GENERICO }
  }

  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, tipo: 'permiso', motivo: SIN_PERMISO }
  }

  return { ok: true }
}
