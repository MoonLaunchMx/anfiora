// Que cosa cuelga de que otra.
//
// Sin esta tabla, un borrado con arrastre sale mal de tres formas: el renglon
// se titula con la consecuencia en vez de con la accion, se archiva en la
// herramienta equivocada, y —lo grave— el orden en que se vuelve a insertar
// queda a merced del reloj.
//
// Y el reloj NO sirve para esto: las filas de una misma transaccion comparten
// created_at hasta el microsegundo, porque Postgres le da a toda la
// transaccion la hora en que empezo. Se midio el 6-sep con un proveedor y sus
// dos pagos: las tres filas decian 13:03:35.684502. Quien quedaba arriba era
// azar.
//
// Se sigue el DATO: cada hijo guarda a quien pertenece.

export interface Dependiente {
  hija: string     // entidad del hijo, como la nombra el disparador
  padre: string    // entidad del padre
  llave: string    // columna del hijo, dentro de old_value, que apunta al padre
  uno: string      // como se le dice a uno, para la pantalla
  varios: string   // y a varios
}

export const DEPENDIENTES: Dependiente[] = [
  { hija: 'party_member', padre: 'guest',          llave: 'guest_id',
    uno: 'acompañante', varios: 'acompañantes' },
  { hija: 'payment',      padre: 'event_supplier', llave: 'event_supplier_id',
    uno: 'pago',        varios: 'pagos' },
]

const POR_HIJA = new Map(DEPENDIENTES.map(d => [d.hija, d]))

// Mesa -> lugares no entra todavia: los lugares no tienen disparador de
// bitacora, asi que no hay nada que agrupar ni que restaurar.
export function dependienteDe(entidad: string | null): Dependiente | null {
  return entidad ? (POR_HIJA.get(entidad) ?? null) : null
}

export function esEntidadHija(entidad: string | null): boolean {
  return dependienteDe(entidad) !== null
}

// A quien pertenece esta fila, si es que cuelga de algo.
export function idPadreDe(
  entidad: string | null,
  oldValue: Record<string, unknown> | null,
): string | null {
  const dep = dependienteDe(entidad)
  if (!dep) return null
  const id = oldValue?.[dep.llave]
  return typeof id === 'string' ? id : null
}

// Los padres van antes que los hijos. Es el orden en que hay que reinsertar
// —el pago no entra si su proveedor ya no existe— y tambien el orden en que se
// lee la historia.
export function rangoDeEntidad(entidad: string | null): number {
  return esEntidadHija(entidad) ? 1 : 0
}
