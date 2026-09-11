import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { estadoDelLink, venceAlCerrar } from '@/lib/reviews/link-cliente'
import { parseRespuestaCliente } from '@/lib/reviews/opinion-publica'

// La opinion del cliente final, acotada por token. Va por service role como
// la mesa de regalos y la puerta publica: supplier_reviews no tiene policy
// para anon, y no se abre. Solo expone nombre del evento y nombres/categorias
// de los proveedores que el planner eligio. Nunca reviews del planner.

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

type Ajustes = {
  event_id: string
  review_token: string | null
  review_expires_at: string | null
  review_event_supplier_ids: string[] | null
}

type FichaRow = { id: string; supplier: { name: string; category_id: string | null } | null }

async function resolver(db: ReturnType<typeof admin>, token: string) {
  if (!token) return null
  const { data: ajustes } = await db
    .from('event_settings')
    .select('event_id, review_token, review_expires_at, review_event_supplier_ids')
    .eq('review_token', token)
    .maybeSingle<Ajustes>()
  if (!ajustes) return null

  const { data: evento } = await db
    .from('events')
    .select('id, name, user_id, event_date, event_end_date')
    .eq('id', ajustes.event_id)
    .maybeSingle()
  if (!evento) return null

  const info = estadoDelLink({
    hoy: hoyISO(),
    ultimoDiaEvento: evento.event_end_date || evento.event_date,
    token: ajustes.review_token,
    expiresAt: ajustes.review_expires_at,
  })
  return { ajustes, evento, info, ids: ajustes.review_event_supplier_ids ?? [] }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = admin()
  const r = await resolver(db, token)
  if (!r) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  let fichas: FichaRow[] = []
  let respuestas: Record<string, unknown>[] = []
  if (r.ids.length > 0) {
    const [fichasRes, respuestasRes] = await Promise.all([
      db.from('event_suppliers').select('id, supplier:suppliers(name, category_id)').in('id', r.ids),
      db.from('supplier_reviews')
        .select('event_supplier_id, precio_valor, calidad, comunicacion, servicio_trato, manejo_imprevistos, recontratacion, cobros_extra, monto_cobros_extra, comentarios')
        .eq('autor', 'cliente').eq('review_type', 'post_evento').in('event_supplier_id', r.ids),
    ])
    fichas = (fichasRes.data ?? []) as unknown as FichaRow[]
    respuestas = (respuestasRes.data ?? []) as Record<string, unknown>[]
  }

  const categoriaIds = [...new Set(fichas.map(f => f.supplier?.category_id).filter((x): x is string => !!x))]
  const { data: categorias } = categoriaIds.length
    ? await db.from('categories').select('id, name').in('id', categoriaIds)
    : { data: [] as { id: string; name: string }[] }
  const nombreCategoria = new Map((categorias ?? []).map(c => [c.id, c.name]))

  // En el orden en que el planner los eligio.
  const porId = new Map(fichas.map(f => [f.id, f]))
  const proveedores = r.ids
    .map(id => porId.get(id))
    .filter((f): f is FichaRow => !!f)
    .map(f => ({
      id: f.id,
      nombre: f.supplier?.name ?? 'Proveedor',
      categoria: f.supplier?.category_id ? (nombreCategoria.get(f.supplier.category_id) ?? '') : '',
    }))

  const guardadas: Record<string, unknown> = {}
  for (const row of respuestas as { event_supplier_id: string }[]) guardadas[row.event_supplier_id] = row

  return NextResponse.json({
    evento: { nombre: r.evento.name },
    vence: r.info.vence,
    vencido: r.info.estado === 'vencida',
    proveedores,
    respuestas: guardadas,
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = admin()
  const r = await resolver(db, token)
  if (!r) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (r.info.estado === 'vencida') return NextResponse.json({ error: 'vencido', vence: r.info.vence }, { status: 410 })

  const body = await req.json().catch(() => null)
  const parsed = parseRespuestaCliente(body)
  if (!parsed.ok) return NextResponse.json({ error: 'bad_request', problemas: parsed.problemas }, { status: 400 })
  const datos = parsed.datos

  // Solo los proveedores que el planner eligio: el token no abre el evento entero.
  if (!r.ids.includes(datos.event_supplier_id)) {
    return NextResponse.json({ error: 'fuera_de_lista' }, { status: 403 })
  }

  const { data: ficha } = await db
    .from('event_suppliers').select('id, supplier_id, event_id')
    .eq('id', datos.event_supplier_id).eq('event_id', r.evento.id).maybeSingle()
  if (!ficha) return NextResponse.json({ error: 'fuera_de_lista' }, { status: 403 })

  const { error } = await db.from('supplier_reviews').upsert({
    user_id: r.evento.user_id,
    supplier_id: ficha.supplier_id,
    event_id: r.evento.id,
    event_supplier_id: ficha.id,
    review_type: 'post_evento',
    autor: 'cliente',
    precio_valor: datos.precio_valor,
    calidad: datos.calidad,
    comunicacion: datos.comunicacion,
    servicio_trato: datos.servicio_trato,
    manejo_imprevistos: datos.manejo_imprevistos,
    razones_seleccion: null,
    motivo_descarte: null,
    recontratacion: datos.recontratacion,
    cobros_extra: datos.cobros_extra,
    monto_cobros_extra: datos.monto_cobros_extra,
    comentarios: datos.comentarios,
    created_by: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'event_supplier_id,review_type,autor' })

  if (error) {
    console.error('Error guardando la opinion del cliente:', error.message ?? error, error)
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// Enviar cierra el link: el cliente ya no edita hasta que el planner lo
// reactive desde Proveedores. El trigger de event_settings deja pasar al
// service role, que es quien escribe aqui.
export async function PUT(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = admin()
  const r = await resolver(db, token)
  if (!r) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (r.info.estado === 'vencida') return NextResponse.json({ ok: true })

  const { error } = await db
    .from('event_settings')
    .update({ review_expires_at: venceAlCerrar(hoyISO()) })
    .eq('review_token', token)

  if (error) {
    console.error('Error cerrando el link de opinion:', error.message ?? error, error)
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
