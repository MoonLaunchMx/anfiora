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

  let payload: { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; userAgent?: string }
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

  const userAgent = typeof payload?.userAgent === 'string' ? payload.userAgent : null

  const db = admin()
  const { error } = await db
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
      },
      { onConflict: 'endpoint' }
    )

  if (error) {
    console.error('[push/subscribe] upsert fallido', error.message)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// Rotacion de endpoint: el navegador dispara `pushsubscriptionchange` y el SW
// re-suscribe. El SW no tiene sesion, asi que la identidad se hereda de la
// suscripcion anterior (buscamos su user_id por el endpoint viejo) y migramos
// la fila al endpoint nuevo, borrando el huerfano. Sin esto, los endpoints
// rotados quedan vivos en paralelo y el dispositivo recibe el push duplicado.
export async function PUT(req: NextRequest) {
  let payload: {
    oldEndpoint?: string
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body invalido' }, { status: 400 })
  }

  const oldEndpoint = typeof payload?.oldEndpoint === 'string' ? payload.oldEndpoint : null
  const sub = payload?.subscription
  const endpoint: string | undefined = sub?.endpoint
  const p256dh: string | undefined = sub?.keys?.p256dh
  const auth: string | undefined = sub?.keys?.auth

  if (!endpoint || !p256dh || !auth || !oldEndpoint) {
    return NextResponse.json({ error: 'Rotacion incompleta' }, { status: 400 })
  }

  const db = admin()
  const { data: old } = await db
    .from('push_subscriptions')
    .select('user_id')
    .eq('endpoint', oldEndpoint)
    .maybeSingle()

  if (!old?.user_id) return NextResponse.json({ ok: true })

  const { error } = await db
    .from('push_subscriptions')
    .upsert(
      { user_id: old.user_id, endpoint, p256dh, auth },
      { onConflict: 'endpoint' }
    )

  if (error) {
    console.error('[push/subscribe] rotacion fallida', error.message)
    return NextResponse.json({ error: 'No se pudo rotar' }, { status: 500 })
  }

  if (oldEndpoint !== endpoint) {
    await db.from('push_subscriptions').delete().eq('endpoint', oldEndpoint)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let payload: { endpoint?: string }
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
