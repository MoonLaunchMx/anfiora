import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { acotarCampo, armarMensajeSolicitud, type DatosSolicitud } from '@/lib/solicitud/mensaje'

export const runtime = 'nodejs'

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
  console.error('[solicitud-acceso] telegram fetch error (2 intentos):', lastErr)
  return null
}

// null (no fabricar un numero cuando el dato no se pudo leer) se queda como
// null: solo un numero valido no-negativo pasa.
function comoNumeroONulo(v: unknown): number | null {
  if (v === null) return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
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
    console.error('[solicitud-acceso] faltan env vars TELEGRAM_SUPPORT_*')
    return NextResponse.json({ ok: false, error: 'no configurado' }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'cuerpo invalido' }, { status: 400 })
  }

  const motivo = body.motivo === 'eventos' || body.motivo === 'invitados' ? body.motivo : null
  const email = acotarCampo(body.email, 'email')
  const nombre = acotarCampo(body.nombre, 'nombre')
  const telefono = acotarCampo(body.telefono, 'telefono')
  if (!motivo || !email || !nombre || !telefono) {
    return NextResponse.json({ ok: false, error: 'faltan datos' }, { status: 400 })
  }

  const datos: DatosSolicitud = {
    nombre,
    email,
    telefono,
    tipoDeCuenta: acotarCampo(body.tipoDeCuenta, 'tipoDeCuenta') || 'planner',
    planActual: acotarCampo(body.planActual, 'planActual') || 'free',
    sello: body.sello === 'fundador' ? 'fundador' : null,
    eventosVigentes: comoNumeroONulo(body.eventosVigentes),
    personasEnEvento: comoNumeroONulo(body.personasEnEvento),
    motivo,
    eventosAlAno: acotarCampo(body.eventosAlAno, 'eventosAlAno'),
    tipoDeEventos: acotarCampo(body.tipoDeEventos, 'tipoDeEventos'),
    tamanoDeEquipo: acotarCampo(body.tamanoDeEquipo, 'tamanoDeEquipo'),
    contactoPreferido: acotarCampo(body.contactoPreferido, 'contactoPreferido'),
    ciudad: acotarCampo(body.ciudad, 'ciudad'),
    mensaje: acotarCampo(body.mensaje, 'mensaje'),
  }

  const text = armarMensajeSolicitud(datos)
  const base = `https://api.telegram.org/bot${token}`

  const res = await postToTelegram(
    `${base}/sendMessage`,
    JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    { 'content-type': 'application/json' }
  )
  if (!res) return NextResponse.json({ ok: false, error: 'envio fallo' }, { status: 502 })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[solicitud-acceso] telegram error:', res.status, detail.slice(0, 200))
    return NextResponse.json({ ok: false, error: 'envio fallo' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
