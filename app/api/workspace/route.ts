import { NextRequest, NextResponse } from 'next/server'
import { normalizarPermisos } from '@/lib/permisos/resolver'
import { bodasDelWorkspace, esAdministrador, planDeFila, usuarioDeRequest } from '@/lib/workspace/servidor'
import type { Cliente, Miembro, RolWorkspace, WorkspaceListado, WorkspaceResumen } from '@/lib/workspace/tipos'

export async function GET(req: NextRequest) {
  const s = await usuarioDeRequest(req)
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { user, admin } = s

  const { data: mem } = await admin
    .from('workspace_members').select('workspace_id, rol, es_dueno_principal')
    .eq('user_id', user.id).eq('status', 'active').in('rol', ['dueno', 'admin'])
  const filas = (mem ?? []) as { workspace_id: string; rol: RolWorkspace; es_dueno_principal: boolean }[]
  if (filas.length === 0) return NextResponse.json({ workspaces: [], activo: null })

  const { data: wss } = await admin.from('workspaces').select('*').in('id', filas.map(f => f.workspace_id))
  const porId = new Map((wss ?? []).map(w => [w.id as string, w as Record<string, unknown>]))
  const workspaces: WorkspaceListado[] = filas
    .filter(f => porId.has(f.workspace_id))
    .map(f => ({
      id: f.workspace_id, name: String(porId.get(f.workspace_id)!.name),
      plan: planDeFila(porId.get(f.workspace_id)), miRol: f.rol,
    }))

  const pedido = req.nextUrl.searchParams.get('id')
  const propio = filas.find(f => f.es_dueno_principal)?.workspace_id
  const activoId = pedido ?? propio ?? workspaces[0]?.id
  const mia = filas.find(f => f.workspace_id === activoId)
  if (!activoId || !mia || !esAdministrador(mia.rol)) {
    return NextResponse.json({ error: 'No administras ese workspace' }, { status: 403 })
  }
  const ws = porId.get(activoId)!

  const [bodas, { data: miembrosRaw }] = await Promise.all([
    bodasDelWorkspace(admin, activoId),
    admin.from('workspace_members').select('*').eq('workspace_id', activoId).neq('status', 'revoked')
      .order('invited_at', { ascending: true }),
  ])
  const eventIds = bodas.map(b => b.id)
  const { data: colabs } = eventIds.length
    ? await admin.from('event_collaborators')
        .select('id, event_id, email, user_id, status, invite_token, tipo, permisos')
        .in('event_id', eventIds).neq('status', 'revoked')
    : { data: [] }
  const nombreBoda = new Map(bodas.map(b => [b.id, b.name]))

  const userIds = [...new Set([
    ...(miembrosRaw ?? []).map(m => m.user_id).filter(Boolean),
    ...(colabs ?? []).map(c => c.user_id).filter(Boolean),
  ])] as string[]
  const { data: perfiles } = userIds.length
    ? await admin.from('users').select('id, full_name').in('id', userIds)
    : { data: [] }
  const nombre = new Map((perfiles ?? []).map(p => [p.id, p.full_name as string | null]))

  const miembros: Miembro[] = (miembrosRaw ?? []).map(m => ({
    id: m.id, email: m.email, user_id: m.user_id, nombre: m.user_id ? nombre.get(m.user_id) ?? null : null,
    rol: m.rol, es_dueno_principal: m.es_dueno_principal, status: m.status,
    invite_token: m.invite_token, invited_at: m.invited_at, accepted_at: m.accepted_at,
    bodas: (colabs ?? [])
      .filter(c => c.tipo !== 'cliente' && c.email.toLowerCase() === m.email.toLowerCase())
      .map(c => ({
        eventId: c.event_id, name: nombreBoda.get(c.event_id) ?? 'Boda', collaboratorId: c.id,
        status: c.status, permisos: normalizarPermisos(c.permisos),
      })),
  }))

  const correosEquipo = new Set(miembros.map(m => m.email.toLowerCase()))
  const clientes: Cliente[] = (colabs ?? [])
    .filter(c => c.tipo === 'cliente' && !correosEquipo.has(c.email.toLowerCase()))
    .map(c => ({
      id: c.id, email: c.email, user_id: c.user_id, status: c.status, invite_token: c.invite_token,
      eventId: c.event_id, eventName: nombreBoda.get(c.event_id) ?? 'Boda',
      permisos: normalizarPermisos(c.permisos),
    }))

  const activo: WorkspaceResumen = {
    id: activoId, name: String(ws.name), plan: planDeFila(ws), miRol: mia.rol,
    esDuenoPrincipal: mia.es_dueno_principal, miembros, clientes, bodas,
  }
  return NextResponse.json({ workspaces, activo })
}
