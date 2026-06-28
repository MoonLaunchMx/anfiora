import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const db = admin()
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body invalido' }, { status: 400 })
  }

  const sub = payload?.subscription
  const endpoint: string | undefined = sub?.endpoint
  const p256dh: string | undefined = sub?.keys?.p256dh
  const auth: string | undefined = sub?.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Suscripcion incompleta' }, { status: 400 })
  }

  const db = admin()
  const { error } = await db
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: typeof payload?.userAgent === 'string' ? payload.userAgent : null,
      },
      { onConflict: 'endpoint' }
    )

  if (error) {
    console.error('[push/subscribe] upsert fallido', error.message)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body invalido' }, { status: 400 })
  }

  const endpoint: string | undefined = payload?.endpoint
  if (!endpoint) return NextResponse.json({ error: 'Falta endpoint' }, { status: 400 })

  const db = admin()
  const { error } = await db
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id)

  if (error) {
    console.error('[push/subscribe] delete fallido', error.message)
    return NextResponse.json({ error: 'No se pudo borrar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
