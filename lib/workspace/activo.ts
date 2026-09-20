import type { RolWorkspace } from './tipos'

export type FilaMembresia = {
  workspace_id: string
  rol: RolWorkspace
  es_dueno_principal: boolean
}

export type EleccionActivo =
  | { ok: true; activoId: string; mia: FilaMembresia }
  | { ok: false; razon: 'sin-permiso' | 'workspace-ausente' }

export function esAdministrador(rol: RolWorkspace | null): boolean {
  return rol === 'dueno' || rol === 'admin'
}

// Elige que workspace se abre, entre los que el usuario administra.
//
// `existentes` son los ids que la consulta a workspaces devolvio de verdad. Se
// pide aparte a proposito: una membresia no garantiza que su workspace haya
// llegado, y confundir "no llego" con "no te toca" fue justo lo que reviento en
// produccion. Por eso las dos negativas viajan con razon distinta.
export function elegirActivo(
  filas: FilaMembresia[],
  existentes: Set<string>,
  pedido: string | null,
): EleccionActivo {
  const candidato = pedido
    ?? filas.find(f => f.es_dueno_principal)?.workspace_id
    ?? filas[0]?.workspace_id

  if (!candidato) return { ok: false, razon: 'sin-permiso' }

  const mia = filas.find(f => f.workspace_id === candidato)
  if (!mia || !esAdministrador(mia.rol)) return { ok: false, razon: 'sin-permiso' }

  if (!existentes.has(candidato)) return { ok: false, razon: 'workspace-ausente' }

  return { ok: true, activoId: candidato, mia }
}
