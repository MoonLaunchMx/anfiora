import { NextRequest, NextResponse } from 'next/server'
import { normalizarPermisos } from '@/lib/permisos/resolver'
import { MODULOS } from '@/lib/permisos/catalogo'
import { kitDesde, type BodaElegida } from '@/lib/workspace/invitacion'
import { esAdministrador, rolEnWorkspace, usuarioDeRequest } from '@/lib/workspace/servidor'
import type { RolInvitable } from '@/lib/workspace/tipos'

type Ctx = { params: Promise<{ id: string }> }

// Cualquier escritura de la tanda que falle debe abortar el resto y contestar
// error: antes se ignoraban y el handler regresaba { ok: true } aunque nada
// se hubiera guardado.
class EscrituraFallida extends Error {}

async function escribir(query: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await query
  if (error) throw new EscrituraFallida(error.message)
}

async function cargar(req: NextRequest, id: string) {
  const s = await usuarioDeRequest(req)
  if (!s) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const { data: m } = await s.admin.from('workspace_members').select('*').eq('id', id).maybeSingle()
  if (!m) return { error: NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 }) }
  const miRol = await rolEnWorkspace(s.admin, m.workspace_id, s.user.id)
  if (!esAdministrador(miRol)) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  const { data: eventos } = await s.admin.from('events').select('id').eq('workspace_id', m.workspace_id)
  return { s, m, eventIds: (eventos ?? []).map(e => e.id as string) }
}

const editaAlgo = (p: ReturnType<typeof normalizarPermisos>) =>
  MODULOS.some(k => p[k] === 'editar' || p[k] === 'total')

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const c = await cargar(req, id)
  if ('error' in c) return c.error
  const { s, m, eventIds } = c

  let body: { rol?: RolInvitable; bodas?: BodaElegida[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 }) }

  if (body.rol && body.rol !== m.rol) {
    if (m.es_dueno_principal) return NextResponse.json({ error: 'El dueño principal siempre es dueño' }, { status: 400 })
    if (body.rol !== 'admin' && body.rol !== 'colaborador') return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    const { error } = await s.admin.from('workspace_members').update({ rol: body.rol }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (Array.isArray(body.bodas)) {
    const propias = new Set(eventIds)
    const deseadas = body.bodas
      .filter(b => propias.has(b.eventId))
      .map(b => ({ eventId: b.eventId, permisos: normalizarPermisos(b.permisos) }))
    const { data: actuales, error: errActuales } = await s.admin.from('event_collaborators')
      .select('id, event_id, status').in('event_id', eventIds).eq('email', m.email).neq('tipo', 'cliente')
    if (errActuales) return NextResponse.json({ error: 'No se pudo guardar: ' + errActuales.message }, { status: 500 })
    const porEvento = new Map((actuales ?? []).map(a => [a.event_id, a]))

    try {
      for (const b of deseadas) {
        const vacia = !MODULOS.some(k => b.permisos[k] && b.permisos[k] !== 'ninguno')
        const existente = porEvento.get(b.eventId)
        if (vacia) {
          if (existente && existente.status !== 'revoked') {
            await escribir(s.admin.from('event_collaborators').update({ status: 'revoked' }).eq('id', existente.id))
          }
          continue
        }
        const role = editaAlgo(b.permisos) ? 'editor' : 'viewer'
        if (existente) {
          const status = existente.status === 'revoked' ? (m.user_id ? 'active' : 'pending') : existente.status
          await escribir(s.admin.from('event_collaborators')
            .update({ permisos: b.permisos, role, tipo: 'equipo', status, user_id: m.user_id ?? undefined }).eq('id', existente.id))
        } else {
          await escribir(s.admin.from('event_collaborators').insert({
            event_id: b.eventId, email: m.email, invited_by: s.user.id, tipo: 'equipo', role,
            permisos: b.permisos, status: m.user_id ? 'active' : 'pending', user_id: m.user_id,
          }))
        }
      }
      const deseadosIds = new Set(deseadas.map(d => d.eventId))
      for (const a of actuales ?? []) {
        if (!deseadosIds.has(a.event_id) && a.status !== 'revoked') {
          await escribir(s.admin.from('event_collaborators').update({ status: 'revoked' }).eq('id', a.id))
        }
      }
      // El kit habitual sigue a lo que tiene hoy.
      if (m.rol === 'colaborador') {
        await escribir(s.admin.from('workspace_members').update({ kit_habitual: kitDesde(deseadas) }).eq('id', id))
      }
    } catch (e) {
      if (e instanceof EscrituraFallida) {
        return NextResponse.json({ error: 'No se pudo guardar: ' + e.message }, { status: 500 })
      }
      throw e
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const c = await cargar(req, id)
  if ('error' in c) return c.error
  const { s, m, eventIds } = c
  if (m.es_dueno_principal) return NextResponse.json({ error: 'El dueño principal no se puede quitar' }, { status: 400 })
  if (m.user_id === s.user.id) return NextResponse.json({ error: 'No puedes quitarte a ti mismo' }, { status: 400 })

  const { error } = await s.admin.from('workspace_members').update({ status: 'revoked' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (eventIds.length) {
    const { error: errColab } = await s.admin.from('event_collaborators').update({ status: 'revoked' })
      .in('event_id', eventIds).eq('email', m.email).neq('tipo', 'cliente')
    if (errColab) {
      return NextResponse.json(
        { error: 'La persona quedó fuera del workspace pero no de todas sus bodas: ' + errColab.message },
        { status: 500 },
      )
    }
  }
  return NextResponse.json({ ok: true })
}
