import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { CURRENT_LEGAL_VERSION, LEGAL_DOCUMENT } from '@/lib/legal'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: existing } = await supabaseAdmin
    .from('terms_acceptances')
    .select('id')
    .eq('user_id', user.id)
    .eq('version', CURRENT_LEGAL_VERSION)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, already: true })
  }

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null
  const userAgent = req.headers.get('user-agent') || null

  const { error } = await supabaseAdmin.from('terms_acceptances').insert({
    user_id:    user.id,
    document:   LEGAL_DOCUMENT,
    version:    CURRENT_LEGAL_VERSION,
    ip_address: ip,
    user_agent: userAgent,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
