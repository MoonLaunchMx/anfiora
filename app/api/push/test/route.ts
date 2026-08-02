import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTestPush } from '@/lib/push'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await admin().auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Sin tag: cada prueba crea su propia notificacion en vez de reemplazar la
  // anterior, que hacia parecer que la segunda nunca habia llegado.
  await sendTestPush(user.id, {
    title: 'Anfiora',
    body: 'Notificacion de prueba. Si la ves, las notificaciones funcionan en este dispositivo.',
    url: '/dashboard',
    ttl: 60,
  })

  return NextResponse.json({ ok: true })
}
