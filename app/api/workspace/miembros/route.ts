import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { contarAsientos, puedeInvitar } from '@/lib/workspace/asientos'
import { filasDeAlta, validarAltaEquipo, type BodaElegida } from '@/lib/workspace/invitacion'
import { esAdministrador, planDelWorkspace, rolEnWorkspace, usuarioDeRequest } from '@/lib/workspace/servidor'
import type { RolInvitable } from '@/lib/workspace/tipos'

export async function POST(req: NextRequest) {
  const s = await usuarioDeRequest(req)
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { user, admin } = s

  let body: { workspaceId?: string; email?: string; rol?: RolInvitable; bodas?: BodaElegida[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 }) }
  const { workspaceId, email, rol } = body
  const bodas = Array.isArray(body.bodas) ? body.bodas : []
  if (!workspaceId || !email || (rol !== 'admin' && rol !== 'colaborador')) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const miRol = await rolEnWorkspace(admin, workspaceId, user.id)
  if (!esAdministrador(miRol)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const [{ data: ws, error: errWs }, { data: miembros, error: errMiembros }] = await Promise.all([
    admin.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
    admin.from('workspace_members').select('id, email, status, user_id').eq('workspace_id', workspaceId),
  ])
  if (errWs) return NextResponse.json({ error: 'No se pudo leer el workspace: ' + errWs.message }, { status: 500 })
  if (errMiembros) return NextResponse.json({ error: 'No se pudo leer el equipo: ' + errMiembros.message }, { status: 500 })
  if (!ws) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 })

  const v = validarAltaEquipo({ email, miembros: miembros ?? [] })
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const permiso = puedeInvitar(await planDelWorkspace(admin, ws), contarAsientos(miembros ?? []))
  if (!permiso.ok) {
    return NextResponse.json({ error: 'Para trabajar en equipo necesitas Pro', motivo: 'plan' }, { status: 402 })
  }

  // Solo bodas de este workspace.
  const { data: propias, error: errPropias } = await admin.from('events').select('id').eq('workspace_id', workspaceId)
  if (errPropias) return NextResponse.json({ error: 'No se pudo verificar las bodas del workspace: ' + errPropias.message }, { status: 500 })
  const ids = new Set((propias ?? []).map(e => e.id))
  const bodasValidas = bodas.filter(b => ids.has(b.eventId))

  const token = randomUUID()
  const { miembro, colaboradores } = filasDeAlta({
    workspaceId, email, rol, bodas: bodasValidas, invitedBy: user.id, token,
  })

  // Un correo revocado antes se reactiva sobre su misma fila (unique
  // workspace_id, email). El disparador guard_workspace_members prohibe
  // desligar user_id una vez puesto, asi que nunca se manda user_id: null.
  //
  // SIEMPRE vuelve a 'pending' con token nuevo, aunque esa cuenta ya haya
  // aceptado antes. Reactivar de un jalon era el estandar de las SaaS grandes,
  // pero ellas AVISAN por correo y Anfiora todavia no manda ninguno: la persona
  // se encontraba con acceso nuevo sin que nadie se lo dijera. Mientras no haya
  // correo, el enlace es el unico aviso que existe.
  const revocada = (miembros ?? []).find(m => m.email.toLowerCase() === miembro.email && m.status === 'revoked')
  const escritura = revocada
    ? admin.from('workspace_members').update(
        { rol: miembro.rol, kit_habitual: miembro.kit_habitual, invited_by: miembro.invited_by, status: 'pending', invite_token: token, accepted_at: null },
      ).eq('id', revocada.id).select('id').single()
    : admin.from('workspace_members').insert(miembro).select('id').single()
  const { data: fila, error } = await escritura
  if (error || !fila) return NextResponse.json({ error: 'No se pudo crear la invitación: ' + (error?.message ?? '') }, { status: 500 })

  if (colaboradores.length > 0) {
    // Sus eventos tambien nacen pendientes, como el miembro: se activan todos
    // juntos cuando acepta el enlace. Antes se activaban solos si la cuenta ya
    // existia, y la persona no se enteraba de que habia recuperado el acceso.

    // Filas viejas del mismo correo en esas bodas se reemplazan.
    const { error: errDel } = await admin.from('event_collaborators').delete()
      .in('event_id', colaboradores.map(c => c.event_id)).eq('email', miembro.email).neq('status', 'active')
      .or('tipo.is.null,tipo.neq.cliente')
    if (errDel) return NextResponse.json({ error: 'No se pudo preparar la invitación: ' + errDel.message }, { status: 500 })
    const { error: errC } = await admin.from('event_collaborators').insert(colaboradores)
    if (errC) return NextResponse.json({ error: 'La persona quedó invitada pero sus bodas no: ' + errC.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, miembroId: fila.id, inviteToken: token })
}
