import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkPlanChange, interpretPlanUpdate, type PlanChangeTarget } from '@/lib/admin/change-plan'
import { hayLugarDeFundador, LUGARES_FUNDADOR, normalizarSello } from '@/lib/workspace/sello'

const ADMIN_EMAIL = 'diego.garza@moonlaunch.mx'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

  if (authError || !user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { userId, plan } = body
  const selloProvisto = body.sello !== undefined

  if (!userId || (!plan && !selloProvisto)) {
    return NextResponse.json({ error: 'Faltan parametros' }, { status: 400 })
  }

  let newPlan: string | null = null

  if (plan) {
    const { data: target } = await supabaseAdmin
      .from('users')
      .select('id, email, plan')
      .eq('id', userId)
      .maybeSingle()

    const check = checkPlanChange({ target: target as PlanChangeTarget | null, newPlan: plan })
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

    newPlan = String(plan).trim().toLowerCase()

    // users.plan se sigue escribiendo por compatibilidad (nadie lo lee ya), y el
    // plan de verdad va al workspace de esa persona. Si el SQL del Tramo 5 no ha
    // corrido, la segunda escritura falla y se reporta como aviso: el cambio en
    // users.plan basta mientras tanto porque /api/admin/users cae a esa columna.
    const { data: rows, error } = await supabaseAdmin
      .from('users')
      .update({ plan: newPlan })
      .eq('id', userId)
      .select('id, plan')

    const result = interpretPlanUpdate({ error, rows })
    if (!result.ok) {
      console.error('[updatePlan] no se guardo el cambio', JSON.stringify({ userId, newPlan, error }))
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
  }

  let sello: 'fundador' | null = null
  if (selloProvisto) {
    sello = normalizarSello(body.sello)
    if (sello === 'fundador') {
      const { count } = await supabaseAdmin
        .from('workspaces')
        .select('id', { count: 'exact', head: true })
        .eq('sello', 'fundador')
      if (!hayLugarDeFundador(count ?? 0)) {
        return NextResponse.json(
          { error: 'Ya no hay lugares de partner fundador: son ' + LUGARES_FUNDADOR },
          { status: 400 },
        )
      }
    }
  }

  let warning: string | null = null
  const { data: wsId, error: errWs } = await supabaseAdmin.rpc('asegurar_workspace', { uid: userId })

  if (errWs || !wsId) {
    warning = 'El workspace no se pudo actualizar (falta correr el SQL del Tramo 5)'
    console.warn('[updatePlan]', warning, errWs?.message)
  } else {
    if (plan) {
      const { error: errPlan } = await supabaseAdmin
        .from('workspaces').update({ plan: newPlan }).eq('id', wsId)
      if (errPlan) {
        warning = 'El workspace existe pero no acepto el plan: ' + errPlan.message
        console.warn('[updatePlan]', warning)
      }
    }

    if (selloProvisto) {
      // Igual que con el plan, el exito se decide por filas afectadas: un update
      // filtrado por RLS devuelve cero filas sin fallar. La columna sello ademas
      // todavia no existe en produccion (llega con el SQL de la Tarea 12), asi
      // que aqui tambien puede venir un error de columna inexistente.
      const { data: filas, error: errSello } = await supabaseAdmin
        .from('workspaces').update({ sello }).eq('id', wsId).select('id')
      if (errSello || !filas || filas.length === 0) {
        const avisoSello = 'El sello no se guardo (falta correr el SQL de la Tarea 12)' +
          (errSello ? ': ' + errSello.message : '')
        warning = warning ? warning + ' | ' + avisoSello : avisoSello
        console.warn('[updatePlan]', avisoSello)
      }
    }
  }

  return NextResponse.json({ ok: true, plan: newPlan, sello, warning })
}
