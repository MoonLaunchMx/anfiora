import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  describeClient,
  formatFeedbackMessage,
  isFeedbackType,
  validateImages,
} from '@/lib/feedback'

export const runtime = 'nodejs'

const MAX_LEN = 2000

// El connect a Telegram falla ~esporadicamente en cold start.
async function postToTelegram(url: string, body: BodyInit, headers?: HeadersInit) {
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    try {
      return await fetch(url, { method: 'POST', headers, body, signal: ctrl.signal })
    } catch (e) {
      lastErr = e
    } finally {
      clearTimeout(timer)
    }
  }
  console.error('[feedback] telegram fetch error (2 intentos):', lastErr)
  return null
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ ok: false, error: 'no autorizado' }, { status: 401 })
  const accessToken = authHeader.replace('Bearer ', '')

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
  if (authError || !user) return NextResponse.json({ ok: false, error: 'no autorizado' }, { status: 401 })

  const token = process.env.TELEGRAM_SUPPORT_BOT_TOKEN
  const chatId = process.env.TELEGRAM_SUPPORT_CHAT_ID
  if (!token || !chatId) {
    console.error('[feedback] faltan env vars TELEGRAM_SUPPORT_*')
    return NextResponse.json({ ok: false, error: 'no configurado' }, { status: 500 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'formulario invalido' }, { status: 400 })
  }

  const type = form.get('type')
  const message = form.get('message')
  if (!isFeedbackType(type)) return NextResponse.json({ ok: false, error: 'tipo invalido' }, { status: 400 })
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ ok: false, error: 'mensaje vacio' }, { status: 400 })
  }
  if (message.length > MAX_LEN) return NextResponse.json({ ok: false, error: 'mensaje muy largo' }, { status: 400 })

  const pageValue = form.get('page')
  const pagePath = (typeof pageValue === 'string' ? pageValue : '').slice(0, 300)

  const images = form.getAll('images').filter((v): v is File => v instanceof File)
  const check = validateImages(images.map(f => ({ type: f.type, size: f.size })))
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: 400 })

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('full_name, plan')
    .eq('id', user.id)
    .single()

  let eventName: string | undefined
  const eventMatch = pagePath.match(/^\/events\/([0-9a-fA-F-]{36})/)
  if (eventMatch) {
    const { data: ev } = await supabaseAdmin
      .from('events')
      .select('name')
      .eq('id', eventMatch[1])
      .single()
    eventName = ev?.name ?? undefined
  }

  const viewportValue = form.get('viewport')
  const client = describeClient(
    req.headers.get('user-agent') ?? '',
    Number(typeof viewportValue === 'string' ? viewportValue : 0)
  )

  const text = formatFeedbackMessage({
    type,
    message,
    page: pagePath,
    user: {
      name: profile?.full_name ?? '',
      email: user.email ?? '',
      plan: profile?.plan ?? 'free',
    },
    eventName,
    client,
    imageCount: images.length,
  })

  const base = `https://api.telegram.org/bot${token}`

  const res = await postToTelegram(
    `${base}/sendMessage`,
    JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    { 'content-type': 'application/json' }
  )
  if (!res) return NextResponse.json({ ok: false, error: 'envio fallo' }, { status: 502 })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[feedback] telegram error:', res.status, detail.slice(0, 200))
    return NextResponse.json({ ok: false, error: 'envio fallo' }, { status: 502 })
  }

  // El reporte ya llego. Las imagenes cuelgan de el; si alguna falla, avisamos en
  // el mismo hilo en vez de tumbar un envio que para el usuario ya fue exitoso.
  let replyTo: number | undefined
  try {
    const sent = await res.json()
    replyTo = sent?.result?.message_id
  } catch {}

  let failed = 0
  for (const image of images) {
    const body = new FormData()
    body.append('chat_id', chatId)
    // Como documento y no como foto: Telegram no recomprime, la captura se lee nitida.
    body.append('document', image, image.name || 'captura.png')
    if (replyTo) body.append('reply_to_message_id', String(replyTo))

    const imgRes = await postToTelegram(`${base}/sendDocument`, body)
    if (!imgRes || !imgRes.ok) {
      failed++
      const detail = imgRes ? await imgRes.text().catch(() => '') : 'sin respuesta'
      console.error('[feedback] telegram sendDocument error:', detail.slice(0, 200))
    }
  }

  if (failed > 0) {
    await postToTelegram(
      `${base}/sendMessage`,
      JSON.stringify({
        chat_id: chatId,
        text: `No se pudo adjuntar ${failed} ${failed === 1 ? 'imagen' : 'imagenes'} de este reporte.`,
        reply_to_message_id: replyTo,
      }),
      { 'content-type': 'application/json' }
    )
  }

  return NextResponse.json({ ok: true })
}
