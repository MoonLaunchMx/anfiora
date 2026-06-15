import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

  if (error || !data) return NextResponse.json({ status: 'invalid' }, { status: 404 })
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
    return NextResponse.json({ error: 'invalid' }, { status: 404 })
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
