// lib/workspace/cliente.ts
'use client'
import { supabase } from '@/lib/supabase'
import { normalizarPlan, type PlanId } from './planes'
import { normalizarSello, resolverLimiteInvitados, type Sello } from './sello'
import type { RolWorkspace, WorkspaceListado, WorkspaceResumen } from './tipos'

export async function bearer(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  return { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }
}

// Para herramientas que existen o no segun el plan (hoy: el Rolodex). El plan
// sale del workspace que la persona administra (dueno o admin), igual que el
// resto del muro. null = no se pudo leer: quien llama nunca debe esconder
// la herramienta en ese caso, solo cuando SI se confirmo free sin sello.
export async function planDelWorkspaceActivo(): Promise<{ plan: PlanId; sello: Sello } | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: mem } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id).eq('status', 'active').in('rol', ['dueno', 'admin'])
    .limit(1)
    .maybeSingle()
  const workspaceId = (mem as { workspace_id?: string } | null)?.workspace_id ?? null
  if (!workspaceId) return null

  const conSello = await supabase.from('workspaces').select('plan, sello').eq('id', workspaceId).maybeSingle()
  if (!conSello.error && conSello.data) {
    const ws = conSello.data as { plan?: string; sello?: string }
    return { plan: normalizarPlan(ws.plan), sello: normalizarSello(ws.sello) }
  }
  // La columna sello puede no existir todavia en este ambiente: se pide el
  // plan solo, sin dejar que ese hueco tumbe la lectura.
  const soloPlan = await supabase.from('workspaces').select('plan').eq('id', workspaceId).maybeSingle()
  if (!soloPlan.error && soloPlan.data) {
    return { plan: normalizarPlan((soloPlan.data as { plan?: string }).plan), sello: null }
  }
  return null
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

// El tope de invitados es el del DUENO del evento, nunca el de quien esta
// escribiendo: un colaborador invitado no arrastra su plan al evento ajeno.
// Dos fuentes, que pueden no estar de acuerdo (la logica de a cual creerle
// vive en resolverLimiteInvitados, pura y probada en sello.test.ts):
// - `plan_del_evento` (RPC, SECURITY DEFINER): responde igual para el dueno
//   que para un colaborador, pero su COALESCE cae a 'free' por default
//   cuando el evento no tiene workspace detras — un 'free' de aqui es
//   ambiguo, no se sabe si es real o el default.
// - Lectura directa de `workspaces` por `primary_owner_id`: mas confiable
//   (trae tambien el sello) pero puede no encontrar fila por RLS (un
//   colaborador no siempre puede leer el workspace ajeno) o porque la
//   columna `sello` todavia no existe (la crea la Tarea 12).
// wsEncontrado solo es true cuando esa lectura directa SI devolvio una fila
// real, sin error — ni un error de columna faltante ni un RLS que la deja
// en cero filas cuentan como "encontrada".
export async function limiteInvitadosDelEvento(eventId: string, ownerId: string): Promise<number | null> {
  let rpcPlan: string | null = null
  try {
    const { data, error } = await supabase.rpc('plan_del_evento', { evento: eventId })
    if (!error && typeof data === 'string') rpcPlan = data
  } catch {}

  let wsEncontrado = false
  let wsPlan: string | null = null
  let wsSello: unknown = null
  try {
    const conSello = await supabase.from('workspaces').select('plan, sello').eq('primary_owner_id', ownerId).maybeSingle()
    if (!conSello.error && conSello.data) {
      const fila = conSello.data as { plan?: string | null; sello?: string | null }
      wsEncontrado = true
      wsPlan = fila.plan ?? null
      wsSello = fila.sello ?? null
    } else if (conSello.error) {
      // La columna sello puede no existir todavia: se reintenta solo con
      // plan antes de darse por vencido.
      const soloPlan = await supabase.from('workspaces').select('plan').eq('primary_owner_id', ownerId).maybeSingle()
      if (!soloPlan.error && soloPlan.data) {
        wsEncontrado = true
        wsPlan = (soloPlan.data as { plan?: string | null }).plan ?? null
      }
    }
  } catch {}

  return resolverLimiteInvitados(rpcPlan, wsEncontrado, wsPlan, wsSello)
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
