import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkUserDeletable, executeUserDeletion } from '@/lib/admin/delete-user'

const ADMIN_EMAIL = 'diego.garza@moonlaunch.mx'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verificar que quien llama es el admin
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

  if (authError || !user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { userId, action, emailConfirm } = await req.json()
  if (!userId || !action) return NextResponse.json({ error: 'Faltan parametros' }, { status: 400 })

  if (action === 'delete') {
    const { data: target } = await supabaseAdmin
      .from('users')
      .select('id, email, plan')
      .eq('id', userId)
      .maybeSingle()

    const check = checkUserDeletable({
      actorId: user.id,
      target: target as { id: string; email: string; plan: string } | null,
      emailConfirm: typeof emailConfirm === 'string' ? emailConfirm : '',
    })
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

    const result = await executeUserDeletion(supabaseAdmin, userId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'ban') {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: '876600h' // 100 anos = efectivamente permanente
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'unban') {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: 'none'
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Accion no reconocida' }, { status: 400 })
}
