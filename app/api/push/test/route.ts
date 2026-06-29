import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUsers } from '@/lib/push'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await admin().auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  await sendPushToUsers([user.id], {
    title: 'Anfiora',
    body: 'Notificacion de prueba. Si la ves, las notificaciones funcionan en este dispositivo.',
    url: '/dashboard',
    tag: 'test',
  })

  return NextResponse.json({ ok: true })
}
