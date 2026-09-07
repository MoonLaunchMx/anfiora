export type FilaMiembroDespacho = { rol: string } | null

// falla cerrado: un permiso que no se pudo verificar es un permiso negado.
// esDueno se resuelve fuera, contra workspaces.primary_owner_id -- no contra
// workspace_members -- para que el dueño de su propio despacho nunca quede
// bloqueado de sus propios ajustes por una lectura de membresia caida.
export function puedeAdministrarCategorias(
  filaMiembro: FilaMiembroDespacho,
  error: unknown,
  esDueno: boolean,
): boolean {
  if (esDueno) return true
  if (error) return false
  if (!filaMiembro) return false
  return filaMiembro.rol === 'dueno' || filaMiembro.rol === 'admin'
}
