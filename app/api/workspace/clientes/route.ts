import { NextRequest, NextResponse } from 'next/server'
import { aplicarKit, permisosDeRol } from '@/lib/permisos/resolver'
import { normalizarCorreo, validarCliente } from '@/lib/workspace/invitacion'
import { bodasDelWorkspace, esAdministrador, rolEnWorkspace, usuarioDeRequest } from '@/lib/workspace/servidor'

export async function POST(req: NextRequest) {
  const s = await usuarioDeRequest(req)
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { user, admin } = s

  let body: { workspaceId?: string; eventId?: string; email?: string; puntoDePartida?: 'ver' | 'editar' }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 }) }
  const { workspaceId, eventId, email } = body
  const punto = body.puntoDePartida === 'editar' ? 'editor' : 'viewer'
  if (!workspaceId || !eventId || !email) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const miRol = await rolEnWorkspace(admin, workspaceId, user.id)
  if (!esAdministrador(miRol)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const bodas = await bodasDelWorkspace(admin, workspaceId)
  const boda = bodas.find(b => b.id === eventId)
  if (!boda) return NextResponse.json({ error: 'Esa boda no es de este workspace' }, { status: 400 })

  const [{ data: miembros, error: errMiembros }, { data: colaboradores, error: errColab }] = await Promise.all([
    admin.from('workspace_members').select('email, status').eq('workspace_id', workspaceId),
    admin.from('event_collaborators').select('email, event_id, tipo, status').in('event_id', bodas.map(b => b.id)),
  ])
  if (errMiembros) return NextResponse.json({ error: 'No se pudo leer el equipo: ' + errMiembros.message }, { status: 500 })
  if (errColab) return NextResponse.json({ error: 'No se pudo leer los accesos: ' + errColab.message }, { status: 500 })

  const v = validarCliente({ email, eventId, colaboradores: colaboradores ?? [], miembros: miembros ?? [] })
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const { data: fila, error } = await admin.from('event_collaborators').insert({
    event_id: eventId, email: normalizarCorreo(email), invited_by: user.id, status: 'pending',
    tipo: 'cliente', role: punto, permisos: aplicarKit(permisosDeRol(punto), boda.features),
  }).select('id, invite_token').single()
  if (error || !fila) return NextResponse.json({ error: 'No se pudo crear la invitación: ' + (error?.message ?? '') }, { status: 500 })

  return NextResponse.json({ ok: true, collaboratorId: fila.id, inviteToken: fila.invite_token })
}
