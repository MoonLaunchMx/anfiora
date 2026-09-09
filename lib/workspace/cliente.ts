// lib/workspace/cliente.ts
'use client'
import { supabase } from '@/lib/supabase'
import { normalizarPlan } from './planes'
import type { RolWorkspace, WorkspaceListado, WorkspaceResumen } from './tipos'

export async function bearer(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  return { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }
}

// Para el menu: solo necesita saber si administras alguno. Lee con RLS
// (user_id = auth.uid()) y tolera que la columna plan no exista todavia: se
// pide en dos pasos, y si el segundo falla cada workspace cae a 'free'.
export async function misWorkspacesAdministrados(): Promise<WorkspaceListado[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('workspace_members')
    .select('rol, workspaces ( id, name )')
    .eq('user_id', user.id).eq('status', 'active').in('rol', ['dueno', 'admin'])
  if (error || !data) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas = (data as any[]).filter(f => f.workspaces)
  const ids = [...new Set(filas.map(f => f.workspaces.id as string))]

  const planes = new Map<string, string>()
  if (ids.length) {
    const { data: conPlan, error: errPlan } = await supabase.from('workspaces').select('id, plan').in('id', ids)
    if (!errPlan) {
      for (const w of conPlan ?? []) planes.set(w.id as string, (w as { plan?: unknown }).plan as string)
    }
  }

  return filas.map(f => ({
    id: f.workspaces.id, name: f.workspaces.name,
    plan: normalizarPlan(planes.get(f.workspaces.id)), miRol: f.rol,
  }))
}

// Para el header del colaborador en /configuracion: no filtra por rol (a
// diferencia de misWorkspacesAdministrados), solo quiere saber en que
// workspace participa y con que rol. Tolerante a error: nunca debe romper
// el header, en el peor caso no se muestra la linea "Colaborador en...".
// `userId` se recibe cuando quien llama ya pidio la sesion. Sin el, esta
// funcion abre una segunda peticion de sesion en paralelo con la del layout y
// las dos se pelean el mismo candado de gotrue.
export async function miMembresia(userId?: string): Promise<{ rol: RolWorkspace; workspaceName: string } | null> {
  try {
    const user = userId ? { id: userId } : (await supabase.auth.getUser()).data.user
    if (!user) return null
    const { data, error } = await supabase
      .from('workspace_members')
      .select('rol, workspaces ( name )')
      .eq('user_id', user.id).eq('status', 'active')
    if (error || !data) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fila = (data as any[]).find(f => f.workspaces)
    if (!fila) return null
    return { rol: fila.rol as RolWorkspace, workspaceName: String(fila.workspaces.name) }
  } catch {
    return null
  }
}

// Nombre y foto en UN solo viaje. `avatar_url` llega con la migracion del
// Tramo 5, asi que si la columna no existe todavia se reintenta sin ella.
// Importa que sea una sola consulta: dos en serie alargaban la ventana donde
// el candado de sesion de Supabase se pelea entre efectos y rechaza con
// AbortError, y eso dejaba la pantalla colgada en "Cargando".
export async function perfilConFoto(userId: string): Promise<{ nombre: string; foto: string | null }> {
  const conFoto = await supabase.from('users').select('full_name, avatar_url').eq('id', userId).maybeSingle()
  if (!conFoto.error) {
    const fila = conFoto.data as { full_name?: string | null; avatar_url?: string | null } | null
    return { nombre: fila?.full_name ?? '', foto: fila?.avatar_url ?? null }
  }
  const soloNombre = await supabase.from('users').select('full_name').eq('id', userId).maybeSingle()
  const fila = soloNombre.data as { full_name?: string | null } | null
  return { nombre: fila?.full_name ?? '', foto: null }
}

export async function fetchWorkspace(id?: string) {
  const h = await bearer()
  if (!h) throw new Error('Sesión expirada')
  const res = await fetch('/api/workspace' + (id ? `?id=${id}` : ''), { headers: h })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'No se pudo cargar el workspace')
  return res.json() as Promise<{ workspaces: WorkspaceListado[]; activo: WorkspaceResumen | null }>
}

async function conCuerpo(method: string, url: string, body?: unknown) {
  const h = await bearer()
  if (!h) throw new Error('Sesión expirada')
  const res = await fetch(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'Algo salió mal')
  return json
}
export const postJson   = (url: string, body: unknown) => conCuerpo('POST', url, body)
export const patchJson  = (url: string, body: unknown) => conCuerpo('PATCH', url, body)
export const deleteJson = (url: string) => conCuerpo('DELETE', url)
