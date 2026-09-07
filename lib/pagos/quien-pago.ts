import { PAID_BY_LABELS } from '@/lib/types'

// "Quien pago" dejo de ser un enum: ahora es texto libre por evento. Las
// claves viejas (novia, papas_novio, etc.) siguen guardadas en pagos
// historicos y deben seguir mostrando su etiqueta en vez de la clave cruda.

export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

// Traduce una clave heredada a su etiqueta ("papas_novia" -> "Papás de la
// novia"). Un valor que no esta en el mapa (texto libre nuevo) pasa tal cual.
export function etiquetaQuienPago(valor: string | null | undefined): string {
  const limpio = (valor ?? '').trim()
  if (!limpio) return ''
  return (PAID_BY_LABELS as Record<string, string>)[limpio] ?? limpio
}

// De un historial de pagos ya ordenado (mas reciente primero), saca los
// valores unicos sin vacios ni nulos, conservando la primera aparicion —
// que es la mas reciente.
export function sugerenciasDesdeHistorial(valoresOrdenados: (string | null | undefined)[]): string[] {
  const vistos = new Set<string>()
  const resultado: string[] = []
  for (const v of valoresOrdenados) {
    const limpio = (v ?? '').trim()
    if (!limpio || vistos.has(limpio)) continue
    vistos.add(limpio)
    resultado.push(limpio)
  }
  return resultado
}

// Filtra sugerencias por lo tecleado, sin importar mayusculas o acentos.
// Compara contra la ETIQUETA (lo que se le muestra al planner), no contra la
// clave cruda, para que buscar "papas" encuentre "papas_novia".
export function filtrarSugerencias(sugerencias: string[], consulta: string): string[] {
  const q = normalizar(consulta)
  if (!q) return sugerencias
  return sugerencias.filter(s => normalizar(etiquetaQuienPago(s)).includes(q))
}

// Import dinamico: si fuera estatico, crear el cliente de Supabase se
// ejecutaria al cargar el modulo y romperia las pruebas de las funciones
// puras de arriba, que no necesitan tocar la base de datos.
export async function cargarSugerenciasPaidBy(eventId: string): Promise<string[]> {
  const { supabase } = await import('@/lib/supabase')
  const { data, error } = await supabase
    .from('supplier_payments')
    .select('paid_by, created_at, event_suppliers!inner(event_id)')
    .eq('event_suppliers.event_id', eventId)
    .not('paid_by', 'is', null)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Error cargando quien pago:', error.message)
    return []
  }
  return sugerenciasDesdeHistorial((data ?? []).map((p: any) => p.paid_by as string | null))
}
