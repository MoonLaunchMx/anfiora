import { supabase } from '@/lib/supabase'
import { ocupaLugar, type EventoParaEstado } from '@/lib/events/estado'
import { resolverLimiteEventos } from '@/lib/workspace/sello'

export type AccountCapacity = {
  active: number
  lim: number | null
  remaining: number | null
  over: boolean
}

// El RPC get_account_capacity se puede quedar sin permiso en produccion (la
// auditoria de seguridad del 14-sep se lo revoca a las cuentas con sesion; el
// SQL de esta rama se lo devuelve, pero corre DESPUES del deploy). El muro no
// puede depender de que responda: se intenta como respaldo, y si no responde
// se calcula localmente con lecturas normales a `events` y `workspaces`, que
// las reglas de la base si permiten leer a su dueno.
async function fetchAccountCapacityViaFuncion(userId: string): Promise<AccountCapacity | null> {
  const { data, error } = await supabase.rpc('get_account_capacity', { p_user_id: userId })
  if (error || !data?.[0]) return null
  return data[0] as AccountCapacity
}

// Mismo camino que limiteInvitadosDelEvento en lib/workspace/cliente.ts, pero
// por cuenta (no hay evento todavia en el caso de crear): cuenta los eventos
// vigentes del dueno con ocupaLugar (espejo de eventos_vigentes_de en
// supabase/2026-09-20-planes-y-muros.sql) y el tope sale del plan+sello de su
// workspace personal. Si la lectura de eventos de plano falla, no se pudo
// contar nada: null, y el muro no bloquea con un numero inventado.
async function fetchAccountCapacityFallback(userId: string): Promise<AccountCapacity | null> {
  const { data: eventos, error: errEventos } = await supabase
    .from('events')
    .select('id, event_status, event_date, event_end_date')
    .eq('user_id', userId)
  if (errEventos || !eventos) return null

  const hoy = new Date()
  const active = (eventos as EventoParaEstado[]).filter(e => ocupaLugar(e, hoy)).length

  let wsEncontrado = false
  let wsPlan: string | null = null
  let wsSello: unknown = null
  const conSello = await supabase.from('workspaces').select('plan, sello').eq('primary_owner_id', userId).maybeSingle()
  if (!conSello.error && conSello.data) {
    const fila = conSello.data as { plan?: string | null; sello?: string | null }
    wsEncontrado = true
    wsPlan = fila.plan ?? null
    wsSello = fila.sello ?? null
  } else if (conSello.error) {
    // La columna sello puede no existir todavia: se reintenta solo con plan.
    const soloPlan = await supabase.from('workspaces').select('plan').eq('primary_owner_id', userId).maybeSingle()
    if (!soloPlan.error && soloPlan.data) {
      wsEncontrado = true
      wsPlan = (soloPlan.data as { plan?: string | null }).plan ?? null
    }
  }

  const lim = resolverLimiteEventos(null, wsEncontrado, wsPlan, wsSello)
  if (lim === null) return { active, lim: null, remaining: null, over: false }
  return { active, lim, remaining: Math.max(lim - active, 0), over: active >= lim }
}

export async function fetchAccountCapacity(userId: string): Promise<AccountCapacity | null> {
  const viaFuncion = await fetchAccountCapacityViaFuncion(userId)
  if (viaFuncion) return viaFuncion
  return fetchAccountCapacityFallback(userId)
}

export function parseLimitError(msg: string): { needed: number; limit: number } | null {
  const m = msg.match(/EVENT_LIMIT_EXCEEDED:(\d+):(\d+)/)
  return m ? { needed: Number(m[1]), limit: Number(m[2]) } : null
}

export function esErrorDeCupo(error: { message: string } | null): boolean {
  return !!error && parseLimitError(error.message) !== null
}

export function esErrorDeArchivado(error: { message: string } | null): boolean {
  return !!error && error.message.includes('EVENTO_ARCHIVADO')
}

// Mensaje unico para toda la app: un evento archivado quedo de solo lectura
// en la base (bloquea_evento_archivado / bloquea_pago_archivado), y sin este
// aviso la escritura fallaba muda: la pantalla mostraba el cambio optimista
// y al recargar no estaba.
export const MENSAJE_EVENTO_ARCHIVADO = 'Este evento esta archivado. Reactivalo en Configuracion para poder editarlo.'
