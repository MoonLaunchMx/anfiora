import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { formatFeedbackMessage, isFeedbackType } from '@/lib/feedback'

export const runtime = 'nodejs'

const MAX_LEN = 2000

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_SUPPORT_BOT_TOKEN
  const chatId = process.env.TELEGRAM_SUPPORT_CHAT_ID
  if (!token || !chatId) {
    console.error('[feedback] faltan env vars TELEGRAM_SUPPORT_*')
    return NextResponse.json({ ok: false, error: 'no configurado' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ ok: false, error: 'no autorizado' }, { status: 401 })
  const accessToken = authHeader.replace('Bearer ', '')

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
  if (authError || !user) return NextResponse.json({ ok: false, error: 'no autorizado' }, { status: 401 })

  let body: { type?: unknown; message?: unknown; page?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'json invalido' }, { status: 400 })
  }

  const { type, message, page } = body
  if (!isFeedbackType(type)) return NextResponse.json({ ok: false, error: 'tipo invalido' }, { status: 400 })
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ ok: false, error: 'mensaje vacio' }, { status: 400 })
  }
  if (message.length > MAX_LEN) return NextResponse.json({ ok: false, error: 'mensaje muy largo' }, { status: 400 })
  const pagePath = typeof page === 'string' ? page : ''

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
  })

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[feedback] telegram error:', res.status, detail.slice(0, 200))
      return NextResponse.json({ ok: false, error: 'envio fallo' }, { status: 502 })
    }
  } catch (e) {
    console.error('[feedback] telegram fetch error:', e)
    return NextResponse.json({ ok: false, error: 'envio fallo' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
