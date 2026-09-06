// Que cosa cuelga de que otra.
//
// La app borra a los acompanantes en su propia transaccion, asi que el
// disparador les pone otro batch_id y caen en un lote distinto del de sus
// invitados. Sin esta tabla salen como dos movimientos separados: uno que dice
// "Invitado eliminado" y otro que dice "2 acompanantes eliminados", como si no
// tuvieran nada que ver.
//
// Se sigue el DATO y no el reloj: el acompanante guarda de quien cuelga.

export interface Dependiente {
  hija: string    // entidad del hijo, como la nombra el disparador
  padre: string   // entidad del padre
  llave: string   // columna del hijo, dentro de old_value, que apunta al padre
}

export const DEPENDIENTES: Dependiente[] = [
  { hija: 'party_member', padre: 'guest', llave: 'guest_id' },
]

const ENTIDADES_HIJAS = new Set(DEPENDIENTES.map(d => d.hija))

// Proveedor -> pagos NO entra: esos si se borran en la misma transaccion (lo
// resuelve un BEFORE DELETE en el Tramo 3), comparten batch_id y ya llegan
// aqui como un solo movimiento.
export function esEntidadHija(entidad: string | null): boolean {
  return entidad !== null && ENTIDADES_HIJAS.has(entidad)
}
