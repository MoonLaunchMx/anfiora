import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { toE164 } from '@/lib/phone'

const PAGE = 500
const SAMPLE = 60

type TableName = 'guests' | 'party_members' | 'users' | 'suppliers'

// Sin apply=true corre en seco: cuenta y muestra ejemplos antes->despues sin escribir.
// Separa los que ya traian lada (pais confiable) de los "pelones" a los que se les
// asume MX (grupo de riesgo si alguno fuera extranjero) y lista esos pelones para revision.
async function normalizeTable(supabase: SupabaseClient, table: TableName, apply: boolean) {
  let from = 0, total = 0, toUpdate = 0, updated = 0, skipped = 0, alreadyOk = 0
  let withCode = 0, assumedMx = 0
  const assumedSamples: Array<{ id: string; before: string; after: string }> = []
  for (;;) {
    const cols = table === 'suppliers' ? 'id, phone, phone_country_code' : 'id, phone'
    const { data: rows, error } = await supabase.from(table).select(cols).range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!rows || rows.length === 0) break
    for (const r of rows as unknown as Array<{ id: string; phone: string | null; phone_country_code?: string | null }>) {
      if (!r.phone) continue
      total++
      // Un numero se considera de "pais confiable" si trae lada explicita: el propio
      // telefono empieza con '+', o (en proveedores) hay phone_country_code guardado.
      const hasExplicitCode = r.phone.trim().startsWith('+') ||
        (table === 'suppliers' && !!r.phone_country_code)
      const raw = table === 'suppliers'
        ? `${r.phone_country_code ?? '+52'} ${r.phone}`
        : r.phone
      const e164 = toE164(raw, 'MX')
      if (!e164) { skipped++; continue }
      if (e164 === r.phone) { alreadyOk++; continue }
      toUpdate++
      if (hasExplicitCode) {
        withCode++
      } else {
        assumedMx++
        if (assumedSamples.length < SAMPLE) assumedSamples.push({ id: r.id, before: r.phone, after: e164 })
      }
      if (apply) {
        const { error: upErr } = await supabase.from(table).update({ phone: e164 }).eq('id', r.id)
        if (upErr) throw new Error(`${table} update ${r.id}: ${upErr.message}`)
        updated++
      }
    }
    from += PAGE
    if (rows.length < PAGE) break
  }
  return { table, total, toUpdate, withCode, assumedMx, updated, skipped, alreadyOk, assumedSamples }
}

export async function POST(request: NextRequest) {
  if (request.headers.get('x-backfill-secret') !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 403 })
  }
  const apply = new URL(request.url).searchParams.get('apply') === 'true'
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  try {
    const report = {
      guests:        await normalizeTable(supabase, 'guests', apply),
      party_members: await normalizeTable(supabase, 'party_members', apply),
      suppliers:     await normalizeTable(supabase, 'suppliers', apply),
      users:         await normalizeTable(supabase, 'users', apply),
    }
    return NextResponse.json({ ok: true, mode: apply ? 'apply' : 'dry-run', report })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
