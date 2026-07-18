import { resolveDoc } from './doc'

export type EstadoPublicacion = 'borrador' | 'publicada' | 'cambios'

// Serializacion estable: mismas llaves en cualquier orden dan la misma cadena,
// para que reordenar el JSON no se lea como un cambio.
function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']'
  const o = v as Record<string, unknown>
  const keys = Object.keys(o).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}'
}

// El contenido de la invitacion, IGNORANDO meta.publicada: esa bandera es
// estado de publicacion, no contenido, y draft/config la comparten tras publicar.
function contenido(raw: unknown): string {
  const doc = resolveDoc(raw, () => 'x')
  return stable({ v: doc.v, theme: doc.theme, sections: doc.sections, fecha_limite: doc.meta.fecha_limite, access: doc.meta.access })
}

export function hayCambiosSinPublicar(draftRaw: unknown, configRaw: unknown): boolean {
  return contenido(draftRaw) !== contenido(configRaw)
}

export function estadoPublicacion(draftRaw: unknown, configRaw: unknown): EstadoPublicacion {
  const config = resolveDoc(configRaw, () => 'x')
  if (!config.meta.publicada) return 'borrador'
  return hayCambiosSinPublicar(draftRaw, configRaw) ? 'cambios' : 'publicada'
}
