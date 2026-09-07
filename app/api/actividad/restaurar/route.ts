import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { mapaDeRestauraciones } from '@/lib/actividad/agrupar'
import {
  arrastrados, insercionDeFila, seleccionarParaRestaurar, tandasPorTabla,
  type Insercion,
} from '@/lib/actividad/restaurar'
import { entidadDeAccion, moduloDeEntidad } from '@/lib/actividad/vocabulario'
import type { FilaAudit } from '@/lib/actividad/tipos'

// Restaurar desde el servidor, con UN solo candado.
//
// Antes se hacia desde el navegador, y la restauracion escribe en diez tablas:
// cada una tenia que dejar entrar al dueno por su propia policy de INSERT. La
// de pagos no lo hacia, y la siguiente que fallara iba a ser otra. Aqui se
// verifica una sola vez que seas dueno o admin de ESA boda —el mismo candado
// de Configuracion— y se escribe con service role.
//
// El cliente solo manda ids de entidad. Que filas y en que orden lo decide el
// servidor leyendo la bitacora, igual que hace la pantalla.

export async function POST(req: NextRequest) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { eventId?: string; entityIds?: string[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 }) }
  const { eventId, entityIds } = body
  if (!eventId || !Array.isArray(entityIds) || entityIds.length === 0) {
    return NextResponse.json({ error: 'Faltan parametros' }, { status: 400 })
  }

  // Dueno o admin de la boda. Es el candado de Configuracion, donde vive la
  // pantalla que llama aqui.
  const [{ data: evento }, { data: colab }] = await Promise.all([
    admin.from('events').select('user_id').eq('id', eventId).maybeSingle(),
    admin.from('event_collaborators').select('role')
      .eq('event_id', eventId).eq('user_id', user.id).eq('status', 'active').maybeSingle(),
  ])
  const esDueno = evento?.user_id === user.id
  const esAdmin = colab?.role === 'admin'
  if (!esDueno && !esAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { data: bitacora, error: errBitacora } = await admin
    .from('event_audit_log').select('*').eq('event_id', eventId)
    .order('created_at', { ascending: false }).limit(2000)
  if (errBitacora) return NextResponse.json({ error: errBitacora.message }, { status: 500 })

  const filas = (bitacora ?? []) as FilaAudit[]
  const restaurados = mapaDeRestauraciones(filas)

  const elegidas = seleccionarParaRestaurar(filas, entityIds, restaurados)
  if (elegidas.length === 0) return NextResponse.json({ ok: true, restaurados: 0, total: 0 })

  const base = elegidas.map(insercionDeFila).filter((i): i is Insercion => i !== null)

  // Solo lo que se fue en el mismo gesto que el padre: misma persona, dentro
  // del minuto anterior. Lo borrado en otra decision se queda en su renglon.
  const padre = elegidas[0]
  const extra = arrastrados(base, filas, restaurados, {
    userId: padre.user_id,
    cuando: new Date(padre.created_at).getTime(),
  })
  const plan = [...base, ...extra.map(insercionDeFila).filter((i): i is Insercion => i !== null)]
  const fuentes = [...elegidas, ...extra]

  const hechas: Insercion[] = []
  let fallo: string | null = null

  for (const tanda of tandasPorTabla(plan)) {
    const { error } = await admin
      .from(tanda[0].tabla)
      .upsert(tanda.map(i => i.fila), { onConflict: 'id', ignoreDuplicates: true })
    if (error) {
      fallo = `Falló al escribir en ${tanda[0].tabla}: ${error.message}${error.code ? ` (${error.code})` : ''}`
      break
    }
    hechas.push(...tanda)
  }

  // La bitacora de la restauracion, de un viaje. NO es opcional: la pantalla
  // se guia por ella. Se registra lo que SI entro aunque una tanda haya fallado.
  if (hechas.length > 0) {
    const { data: perfil } = await admin.from('users').select('full_name').eq('id', user.id).maybeSingle()
    const porEntidad = new Map(fuentes.map(f => [f.entity_id, f]))
    const { error: errLog } = await admin.from('event_audit_log').insert(
      hechas.map(ins => {
        const fila = porEntidad.get(ins.entityId)
        const entidad = fila?.entity_type ?? entidadDeAccion(ins.accionRestauracion)
        return {
          event_id: eventId,
          user_id: user.id,
          user_email: user.email ?? '',
          user_name: perfil?.full_name ?? null,
          action: ins.accionRestauracion,
          entity_type: entidad,
          entity_id: ins.entityId,
          entity_label: fila?.entity_label ?? null,
          old_value: null,
          new_value: null,
          modulo: moduloDeEntidad(entidad),
        }
      }),
    )
    if (errLog && !fallo) fallo = `Los registros volvieron, pero no se pudo anotar en la bitácora: ${errLog.message}`
  }

  return NextResponse.json({
    ok: fallo === null,
    restaurados: hechas.length,
    total: plan.length,
    arrastrados: extra.length,
    error: fallo,
  })
}
