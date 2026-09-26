// Fusiona las tres fuentes del tablero: eventos propios, eventos con fila de
// colaborador y eventos de los workspaces donde la persona es admin.
//
// El admin del workspace entra con nivel total a cualquier evento de su
// agencia (cascada nivelEfectivo, paso 3), asi que en el tablero se pinta como
// compartido con rol admin y el nombre del dueno, igual que un compartido por
// fila. Nada nuevo que dibujar.

export type RolCompartido = 'admin' | 'editor' | 'viewer'

export interface EventoDelTablero {
  id: string
  user_id: string
  name?: string
  is_shared?: boolean
  shared_role?: RolCompartido
  owner_name?: string | null
  [extra: string]: unknown
}

interface Fuentes<T extends EventoDelTablero> {
  propios: T[]
  compartidos: T[]
  delWorkspace: T[]
  yo?: string
}

export function fusionarEventosDelTablero<T extends EventoDelTablero>({ propios, compartidos, delWorkspace, yo }: Fuentes<T>) {
  const propiosIds = new Set(propios.map(e => e.id))
  const porWorkspace = new Map<string, T>()
  for (const e of delWorkspace) {
    if (propiosIds.has(e.id)) continue
    if (yo && e.user_id === yo) continue
    porWorkspace.set(e.id, e)
  }

  const comoAdmin = (e: T): T => ({
    ...e,
    is_shared: true,
    shared_role: 'admin' as const,
    owner_name: e.owner_name ?? null,
  })

  const fusionados: T[] = compartidos.map(e =>
    porWorkspace.has(e.id) ? comoAdmin({ ...e, owner_name: e.owner_name ?? porWorkspace.get(e.id)?.owner_name }) : e,
  )
  const yaListados = new Set(fusionados.map(e => e.id))
  for (const e of porWorkspace.values()) {
    if (yaListados.has(e.id)) continue
    fusionados.push(comoAdmin(e))
  }

  return { mios: propios, compartidos: fusionados }
}
