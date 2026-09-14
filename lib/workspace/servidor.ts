// lib/workspace/servidor.ts
// Solo se importa desde rutas de API. Nunca desde un componente.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { resolveFeatures, type EnabledFeatures } from '@/lib/features'
import { normalizarPlan, type PlanId } from './planes'
import type { BodaDelWorkspace, RolWorkspace } from './tipos'

export function clienteAdmin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function usuarioDeRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const admin = clienteAdmin()
  const { data: { user }, error } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (error || !user) return null
  return { user, admin }
}

export async function rolEnWorkspace(admin: SupabaseClient, workspaceId: string, userId: string): Promise<RolWorkspace | null> {
  const { data } = await admin
    .from('workspace_members').select('rol')
    .eq('workspace_id', workspaceId).eq('user_id', userId).eq('status', 'active')
    .maybeSingle()
  return (data?.rol as RolWorkspace) ?? null
}

export function esAdministrador(rol: RolWorkspace | null): boolean {
  return rol === 'dueno' || rol === 'admin'
}

export async function bodasDelWorkspace(admin: SupabaseClient, workspaceId: string): Promise<BodaDelWorkspace[]> {
  const { data: eventos } = await admin
    .from('events').select('id, name, event_date, event_status, event_type')
    .eq('workspace_id', workspaceId)
    .order('event_date', { ascending: true })
  const ids = (eventos ?? []).map(e => e.id)
  const { data: settings } = ids.length
    ? await admin.from('event_settings').select('event_id, enabled_features').in('event_id', ids)
    : { data: [] as { event_id: string; enabled_features: unknown }[] }
  const porEvento = new Map((settings ?? []).map(s => [s.event_id, s.enabled_features]))
  return (eventos ?? []).map(e => ({
    id: e.id, name: e.name, event_date: e.event_date, event_status: e.event_status,
    features: resolveFeatures(e.event_type, (porEvento.get(e.id) ?? null) as EnabledFeatures | null),
  }))
}

// Mientras no corra el SQL del tramo, workspaces.plan no existe: se cae al
// plan del dueno principal en users.plan. Este fallback muere cuando el SQL
// del tramo agregue la columna y ws.plan siempre venga definida.
export async function planDelWorkspace(admin: SupabaseClient, ws: Record<string, unknown>): Promise<PlanId> {
  if (ws.plan !== undefined) return normalizarPlan(ws.plan)
  const { data, error } = await admin.from('users').select('plan').eq('id', ws.primary_owner_id as string).maybeSingle()
  if (error) return 'free'
  return normalizarPlan(data?.plan)
}
