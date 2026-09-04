import { MODULOS_CONFIG, type Modulo, type Nivel } from './catalogo'

export const MODULO_POR_RUTA: Record<string, Modulo> = Object.fromEntries(
  MODULOS_CONFIG.flatMap(m => m.rutas.map(r => [r, m.key])),
)

export function moduloDeRutaNav(path: string): Modulo | null {
  return MODULO_POR_RUTA[path] ?? null
}

type EntradaNav =
  | { type: 'item'; path: string }
  | { type: 'group'; defaultPath: string; children: { path: string }[] }

// Una ruta que no es modulo (configuracion) pasa derecho: su candado es otro.
export function filtrarPorPermiso<T extends EntradaNav>(
  entries: T[],
  nivel: (m: Modulo) => Nivel,
): T[] {
  const permitida = (path: string) => {
    const m = moduloDeRutaNav(path)
    return m === null || nivel(m) !== 'ninguno'
  }

  const out: T[] = []
  for (const entry of entries) {
    if (entry.type === 'item') {
      if (permitida(entry.path)) out.push(entry)
      continue
    }
    const children = entry.children.filter(c => permitida(c.path))
    if (children.length === 0) continue
    out.push({
      ...entry,
      children,
      defaultPath: children.some(c => c.path === entry.defaultPath)
        ? entry.defaultPath
        : children[0].path,
    })
  }
  return out
}
