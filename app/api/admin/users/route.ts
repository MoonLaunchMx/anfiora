import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { normalizarPlan } from '@/lib/workspace/planes'
import { normalizarSello, type Sello } from '@/lib/workspace/sello'

const ADMIN_EMAIL = 'diego.garza@moonlaunch.mx'

export async function GET(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Datos de las tablas (solo lectura)
  const [usersRes, eventsRes, guestsRes, partyRes, termsRes, wsRes] = await Promise.all([
    supabaseAdmin.from('users').select('id, email, full_name, plan, created_at, role, event_focus, acquisition_source, utm_source, utm_medium, utm_campaign, utm_content, referrer_domain, device_type, acquired_at').order('created_at', { ascending: false }),
    supabaseAdmin.from('events').select('id, user_id, name, created_at'),
    supabaseAdmin.from('guests').select('id, event_id, rsvp_status'),
    supabaseAdmin.from('party_members').select('id, event_id'),
    supabaseAdmin.from('terms_acceptances').select('user_id, version, accepted_at, ip_address').order('accepted_at', { ascending: false }),
    supabaseAdmin.from('workspaces').select('primary_owner_id, plan, sello'),
  ])

  // La columna sello todavia no existe en produccion (llega con el SQL de la
  // Tarea 12): si el select de arriba fallo por eso, se repite sin ella para
  // no perder el plan de los workspaces mientras tanto. El respaldo no debe
  // quedar mudo: si el error real fuera de permisos o de red, sin el warning
  // nadie se entera de que todos los usuarios salieron sin sello.
  let wsData = wsRes.data
  let wsError = wsRes.error
  if (wsError) {
    console.warn('[adminUsers] select de workspaces con sello fallo, reintentando sin esa columna', wsError.message)
    const fallback = await supabaseAdmin.from('workspaces').select('primary_owner_id, plan')
    wsData = (fallback.data ?? []).map(w => ({ ...w, sello: null }))
    wsError = fallback.error
    if (wsError) {
      console.warn('[adminUsers] el reintento de workspaces tambien fallo', wsError.message)
    }
  }

  // Consentimientos por usuario (ya vienen ordenados por fecha desc)
  const termsByUser: Record<string, { version: string; accepted_at: string; ip_address: string | null }[]> = {}
  for (const t of termsRes.data || []) {
    if (!termsByUser[t.user_id]) termsByUser[t.user_id] = []
    termsByUser[t.user_id].push({ version: t.version, accepted_at: t.accepted_at, ip_address: t.ip_address })
  }

  // Datos de auth (last_sign_in_at, banned_until) paginando
  const authByUserId: Record<string, { last_sign_in_at: string | null; banned: boolean }> = {}
  let page = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    for (const au of data.users) {
      const bannedUntil = (au as { banned_until?: string | null }).banned_until ?? null
      authByUserId[au.id] = {
        last_sign_in_at: au.last_sign_in_at ?? null,
        banned: !!bannedUntil && new Date(bannedUntil).getTime() > Date.now(),
      }
    }
    if (data.users.length < 1000) break
    page++
  }

  // Si el SQL del Tramo 5 no ha corrido, la columna plan no existe y wsError
  // viene lleno: se cae a users.plan sin ruido.
  const planPorDueno = new Map<string, string>()
  const selloPorDueno = new Map<string, Sello>()
  if (!wsError) {
    for (const w of (wsData ?? []) as { primary_owner_id: string; plan: string | null; sello: string | null }[]) {
      planPorDueno.set(w.primary_owner_id, normalizarPlan(w.plan))
      selloPorDueno.set(w.primary_owner_id, normalizarSello(w.sello))
    }
  }

  const users = (usersRes.data || []).map(u => {
    const history = termsByUser[u.id] || []
    return {
      ...u,
      plan:              planPorDueno.get(u.id) ?? normalizarPlan(u.plan),
      sello:             selloPorDueno.get(u.id) ?? null,
      last_sign_in:      authByUserId[u.id]?.last_sign_in_at ?? null,
      banned:            authByUserId[u.id]?.banned ?? false,
      terms_version:     history[0]?.version ?? null,
      terms_accepted_at: history[0]?.accepted_at ?? null,
      terms_history:     history,
    }
  })

  return NextResponse.json({
    users,
    events:       eventsRes.data || [],
    guests:       guestsRes.data || [],
    partyMembers: partyRes.data  || [],
  })
}
