import { supabase } from '@/lib/supabase'
import type { EnabledFeatures } from '@/lib/features'
import { parseAcomodo, type Acomodo } from './tablero'

export type TableroGuardado = {
  acomodo: Acomodo | null
  enabledFeatures: EnabledFeatures | null
}

export async function cargarTablero(eventId: string): Promise<TableroGuardado> {
  const { data, error } = await supabase
    .from('event_settings')
    .select('dashboard_layout, enabled_features')
    .eq('event_id', eventId)
    .maybeSingle()

  // Sin este log, un error de la consulta se vuelve "nunca lo personalizaron" y
  // el bug queda invisible: el tablero se ve bien, solo ignora lo guardado.
  if (error) {
    console.error('[dashboard] no se pudo leer el acomodo:', error.message)
    return { acomodo: null, enabledFeatures: null }
  }

  return {
    acomodo: parseAcomodo(data?.dashboard_layout ?? null),
    enabledFeatures: (data?.enabled_features ?? null) as EnabledFeatures | null,
  }
}

// Devuelve si de verdad se escribio. Un upsert filtrado por RLS no devuelve
// error: no encuentra la fila y regresa cero resultados. Por eso se cuentan las
// filas con .select() en vez de revisar `error`.
export async function guardarAcomodo(eventId: string, acomodo: Acomodo): Promise<boolean> {
  const { data, error } = await supabase
    .from('event_settings')
    .upsert(
      { event_id: eventId, dashboard_layout: acomodo, updated_at: new Date().toISOString() },
      { onConflict: 'event_id' },
    )
    .select('event_id')

  if (error) {
    console.error('[dashboard] no se pudo guardar el acomodo:', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}
