import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { filasParaActivar } from '@/lib/workspace/invitacion'

// API de invitaciones de colaborador, acotada por token. Usa service role para
// no abrir RLS anon en event_collaborators: solo expone los datos de ESA
// invitacion (nunca el invite_token ni otras filas), y la aceptacion exige
// sesion valida (Bearer) antes de escribir.

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const ROLE_LABELS: Record<string, string> = {
  admin:  'Administrador',
  editor: 'Editor',
  viewer: 'Solo lectura',
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ status: 'invalid' }, { status: 404 })

  const db = admin()
  const { data, error } = await db
    .from('event_collaborators')
    .select('id, event_id, email, role, status, events(name, event_date, venue)')
    .eq('invite_token', token)
    .maybeSingle()

  if (error || !data) {
    const { data: m } = await db
      .from('workspace_members')
      .select('id, workspace_id, email, rol, status, user_id, workspaces ( name )')
      .eq('invite_token', token)
      .maybeSingle()
    if (!m || m.status === 'revoked') return NextResponse.json({ status: 'invalid' }, { status: 404 })
    if (m.status === 'active') return NextResponse.json({ status: 'already_used', kind: 'workspace', event_id: null })

    const { data: eventosWs, error: errEventosWs } = await db
      .from('events').select('id').eq('workspace_id', m.workspace_id)
    if (errEventosWs) return NextResponse.json({ status: 'invalid' }, { status: 404 })
    const idsWs = (eventosWs ?? []).map(e => e.id as string)
    const { data: bodas } = idsWs.length
      ? await db
          .from('event_collaborators').select('event_id, events ( name )')
          .eq('email', m.email).eq('status', 'pending').or('tipo.is.null,tipo.neq.cliente').in('event_id', idsWs)
      : { data: [] }
    const { data: existing } = await db.from('users').select('id').ilike('email', m.email).maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = m.workspaces as any
    return NextResponse.json({
      status: 'pending', kind: 'workspace', account_exists: !!existing,
      invite: {
        workspace_id: m.workspace_id, workspace_name: ws?.name ?? 'Workspace',
        email: m.email, rol: m.rol, rolLabel: m.rol === 'admin' ? 'Administrador' : 'Colaborador',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bodas: (bodas ?? []).map((b: any) => ({ id: b.event_id, name: b.events?.name ?? 'Boda' })),
      },
    })
  }
  if (data.status === 'revoked') return NextResponse.json({ status: 'invalid' }, { status: 404 })
  if (data.status === 'active') return NextResponse.json({ status: 'already_used', event_id: data.event_id })

  // Si el correo invitado ya tiene cuenta, el front muestra "iniciar sesion";
  // si no, muestra "crear cuenta". Solo se consulta el correo de esta invitacion.
  const invitedEmail = (data.email || '').trim().toLowerCase()
  let accountExists = false
  if (invitedEmail) {
    const { data: existing } = await db
      .from('users')
      .select('id')
      .ilike('email', invitedEmail)
      .maybeSingle()
    accountExists = !!existing
  }

  return NextResponse.json({
    status: 'pending',
    kind: 'event',
    account_exists: accountExists,
    invite: {
      event_id: data.event_id,
      email:    data.email,
      role:     data.role,
      roleLabel: ROLE_LABELS[data.role] || data.role,
      event:    data.events,
    },
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'invalid' }, { status: 404 })

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'no_autorizado' }, { status: 401 })

  const db = admin()
  const accessToken = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await db.auth.getUser(accessToken)
  if (authError || !user) return NextResponse.json({ error: 'no_autorizado' }, { status: 401 })

  const { data: invite } = await db
    .from('event_collaborators')
    .select('id, event_id, email, role, status')
    .eq('invite_token', token)
    .maybeSingle()

  if (!invite || invite.status === 'revoked') {
    const { data: m } = await db.from('workspace_members')
      .select('id, workspace_id, email, rol, status, user_id').eq('invite_token', token).maybeSingle()
    if (!m || m.status === 'revoked') return NextResponse.json({ error: 'invalid' }, { status: 404 })

    const invitedEmail = (m.email || '').trim().toLowerCase()
    const sessionEmail = (user.email || '').trim().toLowerCase()
    if (invitedEmail && sessionEmail !== invitedEmail) {
      return NextResponse.json({ error: 'email_mismatch', invited: m.email, your_email: user.email }, { status: 403 })
    }

    const { data: eventos } = await db.from('events').select('id').eq('workspace_id', m.workspace_id)
    const eventIds = (eventos ?? []).map(e => e.id as string)

    if (m.status === 'pending') {
      const { error: e1 } = await db.from('workspace_members')
        .update({ user_id: user.id, status: 'active', accepted_at: new Date().toISOString() })
        .eq('id', m.id).eq('status', 'pending')
      if (e1) return NextResponse.json({ error: 'no_guardado' }, { status: 500 })
    }

    const { data: colabs, error: e2 } = eventIds.length
      ? await db.from('event_collaborators').select('id, email, status, event_id, tipo').in('event_id', eventIds)
      : { data: [], error: null }
    if (e2) return NextResponse.json({ error: 'no_guardado' }, { status: 500 })

    const ids = filasParaActivar({ email: m.email, colaboradores: colabs ?? [], eventosDelWorkspace: eventIds })
    if (ids.length) {
      const { error: e3 } = await db.from('event_collaborators')
        .update({ user_id: user.id, status: 'active', accepted_at: new Date().toISOString() }).in('id', ids)
      if (e3) return NextResponse.json({ error: 'no_guardado' }, { status: 500 })
    }

    // Aterriza en la primera boda que le toque; el admin, en la primera del workspace.
    const primera = m.rol === 'admin'
      ? eventIds[0] ?? null
      : (colabs ?? []).find(c => ids.includes(c.id))?.event_id
        ?? (colabs ?? []).find(c => c.email.toLowerCase() === invitedEmail && c.status === 'active')?.event_id
        ?? null
    return NextResponse.json({ ok: true, kind: 'workspace', event_id: primera })
  }

  // La invitacion solo la acepta el correo al que fue enviada.
  const invitedEmail = (invite.email || '').trim().toLowerCase()
  const sessionEmail = (user.email || '').trim().toLowerCase()
  if (invitedEmail && sessionEmail !== invitedEmail) {
    return NextResponse.json(
      { error: 'email_mismatch', invited: invite.email, your_email: user.email },
      { status: 403 },
    )
  }

  if (invite.status === 'active') {
    return NextResponse.json({ ok: true, event_id: invite.event_id, role: invite.role, already: true })
  }

  const { error } = await db
    .from('event_collaborators')
    .update({
      user_id:     user.id,
      status:      'active',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: 'no_guardado' }, { status: 500 })

  return NextResponse.json({ ok: true, event_id: invite.event_id, role: invite.role })
}
