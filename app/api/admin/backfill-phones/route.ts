import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { toE164 } from '@/lib/phone'

const PAGE = 500

async function normalizeTable(
  supabase: SupabaseClient,
  table: 'guests' | 'party_members' | 'users' | 'suppliers',
) {
  let from = 0, updated = 0, skipped = 0
  for (;;) {
    const cols = table === 'suppliers' ? 'id, phone, phone_country_code' : 'id, phone'
    const { data: rows, error } = await supabase.from(table).select(cols).range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!rows || rows.length === 0) break
    for (const r of rows as unknown as Array<{ id: string; phone: string | null; phone_country_code?: string | null }>) {
      if (!r.phone) continue
      const raw = table === 'suppliers'
        ? `${r.phone_country_code ?? '+52'} ${r.phone}`
        : r.phone
      const e164 = toE164(raw, 'MX')
      if (!e164) { skipped++; continue }
      if (e164 === r.phone) continue
      const patch: Record<string, string> = { phone: e164 }
      const { error: upErr } = await supabase.from(table).update(patch).eq('id', r.id)
      if (upErr) throw new Error(`${table} update ${r.id}: ${upErr.message}`)
      updated++
    }
    from += PAGE
    if (rows.length < PAGE) break
  }
  return { updated, skipped }
}

export async function POST(request: NextRequest) {
  if (request.headers.get('x-backfill-secret') !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 403 })
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  try {
    const report = {
      guests:        await normalizeTable(supabase, 'guests'),
      party_members: await normalizeTable(supabase, 'party_members'),
      suppliers:     await normalizeTable(supabase, 'suppliers'),
      users:         await normalizeTable(supabase, 'users'),
    }
    return NextResponse.json({ ok: true, report })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
