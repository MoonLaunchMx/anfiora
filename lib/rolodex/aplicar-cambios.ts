import { supabase } from '@/lib/supabase'
import { mismaCategoria } from './categorias'

export type Resultado = { ok: boolean; error?: string }

// Mientras suppliers.category y event_budgets.category sigan siendo texto (hasta que
// se les quite la columna), renombrar es una cascada de cuatro escrituras. Van en este
// orden: los datos primero, categories.name al final. Si algo truena a la mitad es mejor
// que los proveedores ya digan el nombre nuevo y la tabla el viejo -se reintenta y
// termina- que al reves, con la tabla prometiendo un nombre que ningun dato tiene.
export async function renombrar(
  userId: string,
  categoriaId: string,
  nombreViejo: string,
  nombreNuevo: string,
): Promise<Resultado> {
  const { error: errorProveedores } = await supabase
    .from('suppliers')
    .update({ category: nombreNuevo })
    .eq('user_id', userId)
    .eq('category_id', categoriaId)
  if (errorProveedores) return { ok: false, error: errorProveedores.message }

  const { data: eventos, error: errorEventos } = await supabase
    .from('events')
    .select('id')
    .eq('user_id', userId)
  if (errorEventos) return { ok: false, error: errorEventos.message }

  const eventIds = (eventos ?? []).map(e => e.id)

  if (eventIds.length > 0) {
    const { error: errorPartidas } = await supabase
      .from('event_budgets')
      .update({ category: nombreNuevo })
      .in('event_id', eventIds)
      .eq('category_id', categoriaId)
    if (errorPartidas) return { ok: false, error: errorPartidas.message }

    const { data: settingsRows, error: errorSettings } = await supabase
      .from('event_settings')
      .select('event_id, budget_categories')
      .in('event_id', eventIds)
    if (errorSettings) return { ok: false, error: errorSettings.message }

    for (const fila of settingsRows ?? []) {
      const lista = (fila.budget_categories as string[] | null) ?? []
      if (!lista.some(nombre => mismaCategoria(nombre, nombreViejo))) continue
      const actualizada = lista.map(nombre => mismaCategoria(nombre, nombreViejo) ? nombreNuevo : nombre)
      const { error: errorLista } = await supabase
        .from('event_settings')
        .update({ budget_categories: actualizada })
        .eq('event_id', fila.event_id)
      if (errorLista) return { ok: false, error: errorLista.message }
    }
  }

  const { error: errorCategoria } = await supabase
    .from('categories')
    .update({ name: nombreNuevo })
    .eq('id', categoriaId)
    .eq('user_id', userId)
  if (errorCategoria) return { ok: false, error: errorCategoria.message }

  return { ok: true }
}

// archivar y restaurar solo tocan archived_at: ni proveedores ni partidas se mueven,
// por eso son reversibles.
export async function archivar(categoriaId: string): Promise<Resultado> {
  const { error } = await supabase
    .from('categories')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', categoriaId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function restaurar(categoriaId: string): Promise<Resultado> {
  const { error } = await supabase
    .from('categories')
    .update({ archived_at: null })
    .eq('id', categoriaId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
