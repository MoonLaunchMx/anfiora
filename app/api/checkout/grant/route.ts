import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { ANFITRION_PLANS, ORGANIZADOR_PLANS } from '@/lib/pricing'

// Tiers de anfitrion comprables (excluye free, incluye el ilimitado de Sin Limites).
const VALID_ANFITRION = new Set<string>([
  ...ANFITRION_PLANS.filter(p => p.price > 0).map(p => p.id),
  'ilimitado',
])

export async function POST(req: NextRequest) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { tipo, plan } = await req.json()

  // Suscripcion planner: el permiso vive en el usuario.
  if (tipo === 'organizador') {
    if (!ORGANIZADOR_PLANS.some(p => p.id === plan)) {
      return NextResponse.json({ error: 'Plan invalido' }, { status: 400 })
    }
    const { error } = await admin.from('users').update({ plan }).eq('id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Pago unico anfitrion: el permiso vive en el evento activo del usuario.
  if (!VALID_ANFITRION.has(plan)) {
    return NextResponse.json({ error: 'Plan invalido' }, { status: 400 })
  }
  const { data: ev } = await admin
    .from('events')
    .select('id')
    .eq('user_id', user.id)
    .or('event_status.is.null,event_status.not.in.(completed,cancelled)')
    .order('created_at', { ascending: false })
    .limit(1)
  const eventId = ev?.[0]?.id
  if (!eventId) return NextResponse.json({ error: 'Sin evento activo' }, { status: 400 })
  const { error } = await admin.from('events').update({ plan_tier: plan }).eq('id', eventId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, eventId })
}
