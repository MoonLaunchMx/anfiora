import { NextRequest, NextResponse } from 'next/server'
import { normalizarPermisos } from '@/lib/permisos/resolver'
import { bodasDelWorkspace, esAdministrador, planDelWorkspace, rolEnWorkspace, usuarioDeRequest } from '@/lib/workspace/servidor'
import type { AccesoSuelto, Cliente, Miembro, RolWorkspace, WorkspaceListado, WorkspaceResumen } from '@/lib/workspace/tipos'

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
  const workspaces: WorkspaceListado[] = await Promise.all(
    filas
      .filter(f => porId.has(f.workspace_id))
      .map(async f => ({
        id: f.workspace_id, name: String(porId.get(f.workspace_id)!.name),
        plan: await planDelWorkspace(admin, porId.get(f.workspace_id)!), miRol: f.rol,
      })),
  )

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

  // avatar_url la agrega la migracion del Tramo 5: se pide aparte para que su
  // ausencia deje al equipo sin foto, no sin cargar.
  const foto = new Map<string, string | null>()
  if (userIds.length) {
    const { data: conFoto, error: errFoto } = await admin.from('users').select('id, avatar_url').in('id', userIds)
    if (!errFoto) {
      for (const p of conFoto ?? []) foto.set(p.id as string, ((p as { avatar_url?: unknown }).avatar_url as string) ?? null)
    }
  }

  const miembros: Miembro[] = (miembrosRaw ?? []).map(m => ({
    id: m.id, email: m.email, user_id: m.user_id, nombre: m.user_id ? nombre.get(m.user_id) ?? null : null,
    avatar_url: m.user_id ? foto.get(m.user_id) ?? null : null,
    rol: m.rol, es_dueno_principal: m.es_dueno_principal, status: m.status,
    invite_token: m.invite_token, invited_at: m.invited_at, accepted_at: m.accepted_at,
    bodas: (colabs ?? [])
      .filter(c => c.tipo !== 'cliente' && c.email.toLowerCase() === m.email.toLowerCase())
      .map(c => ({
        eventId: c.event_id, name: nombreBoda.get(c.event_id) ?? 'Evento', collaboratorId: c.id,
        status: c.status, permisos: normalizarPermisos(c.permisos),
      })),
  }))

  const correosEquipo = new Set(miembros.map(m => m.email.toLowerCase()))
  const clientes: Cliente[] = (colabs ?? [])
    .filter(c => c.tipo === 'cliente' && !correosEquipo.has(c.email.toLowerCase()))
    .map(c => ({
      id: c.id, email: c.email, user_id: c.user_id, status: c.status, invite_token: c.invite_token,
      eventId: c.event_id, eventName: nombreBoda.get(c.event_id) ?? 'Evento',
      permisos: normalizarPermisos(c.permisos),
    }))

  // Filas de colaborador que no pertenecen ni a un miembro ni a un cliente:
  // invitaciones sueltas de antes de que existiera el workspace. Se exponen
  // para que el alta pueda AVISAR que ese correo ya tiene acceso, en vez de
  // sumarselo por debajo al aceptar.
  const correosCliente = new Set(clientes.map(c => c.email.toLowerCase()))
  const accesosSueltos: AccesoSuelto[] = (colabs ?? [])
    .filter(c => c.tipo !== 'cliente'
      && !correosEquipo.has(c.email.toLowerCase())
      && !correosCliente.has(c.email.toLowerCase()))
    .map(c => ({
      email: c.email,
      eventId: c.event_id,
      eventName: nombreBoda.get(c.event_id) ?? 'Evento',
      status: c.status,
    }))

  const activo: WorkspaceResumen = {
    id: activoId, name: String(ws.name), plan: await planDelWorkspace(admin, ws),
    logoUrl: (ws.logo_url as string) ?? null,
    tagline: (ws.tagline as string) ?? null, miRol: mia.rol,
    esDuenoPrincipal: mia.es_dueno_principal, miembros, clientes, accesosSueltos, bodas,
  }
  return NextResponse.json({ workspaces, activo })
}

// Guarda el logo del workspace. Solo la ruta publica del bucket de la app: si
// se aceptara cualquier URL, el logo se volveria un hueco para meter enlaces
// a donde sea en pantallas que ve gente sin sesion.
const MARCA_BUCKET = '/object/public/event-media/'

export async function PATCH(req: NextRequest) {
  const s = await usuarioDeRequest(req)
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { user, admin } = s

  let body: { workspaceId?: string; logoUrl?: string | null; name?: string; tagline?: string | null }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 }) }

  const { workspaceId } = body
  if (!workspaceId) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  // El nombre del workspace y el logo se guardan por la misma puerta. Se
  // aceptan por separado: mandar uno no borra el otro.
  const cambios: Record<string, string | null> = {}

  if (body.name !== undefined) {
    const nombre = String(body.name).trim()
    if (nombre.length < 2) return NextResponse.json({ error: 'El nombre necesita al menos 2 letras' }, { status: 400 })
    if (nombre.length > 60) return NextResponse.json({ error: 'El nombre no puede pasar de 60 caracteres' }, { status: 400 })
    cambios.name = nombre
  }

  // El eslogan sirve para el whitelabel de Agency: es la linea que va a salir
  // en lo que el planner le manda a sus clientes. Vacio se guarda como null.
  if (body.tagline !== undefined) {
    const frase = String(body.tagline ?? '').trim()
    if (frase.length > 90) return NextResponse.json({ error: 'El eslogan no puede pasar de 90 caracteres' }, { status: 400 })
    cambios.tagline = frase.length > 0 ? frase : null
  }

  if (body.logoUrl !== undefined) {
    if (body.logoUrl !== null && typeof body.logoUrl !== 'string') {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }
  }

  const logoUrl = body.logoUrl
  if (typeof logoUrl === 'string' && !(logoUrl.startsWith('https://') && logoUrl.includes(MARCA_BUCKET))) {
    return NextResponse.json({ error: 'Esa imagen no es del almacenamiento de Anfiora' }, { status: 400 })
  }
  if (body.logoUrl !== undefined) cambios.logo_url = logoUrl ?? null

  if (Object.keys(cambios).length === 0) return NextResponse.json({ error: 'No hay nada que guardar' }, { status: 400 })

  const miRol = await rolEnWorkspace(admin, workspaceId, user.id)
  if (!esAdministrador(miRol)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // Un update que no alcanza ninguna fila no devuelve error: se cuentan.
  const { data, error } = await admin
    .from('workspaces').update(cambios).eq('id', workspaceId).select('id')
  if (error) return NextResponse.json({ error: 'No se pudo guardar: ' + error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'No se guardó el cambio' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
