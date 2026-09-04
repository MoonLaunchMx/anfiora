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

// Igual que renombrar: los datos primero, la fila de categories al final. Si algo
// truena a la mitad, los proveedores y partidas ya quedaron en la que se queda y
// la que sobra sigue existiendo -se puede reintentar fusionar y termina-, nunca al
// reves. El borrado final puede fallar de verdad si algo todavia la apunta
// (ON DELETE RESTRICT): si un paso anterior no la vacio del todo, se lo decimos
// al planner en espanol en vez de mostrarle el mensaje crudo de Postgres.
export async function fusionar(
  userId: string,
  sobraId: string,
  quedaId: string,
  nombreQueda: string,
): Promise<Resultado> {
  const { data: sobra, error: errorSobra } = await supabase
    .from('categories')
    .select('id, name')
    .eq('id', sobraId)
    .eq('user_id', userId)
    .single()
  if (errorSobra || !sobra) return { ok: false, error: errorSobra?.message ?? 'No se encontró la categoría.' }

  if (mismaCategoria(sobra.name, nombreQueda)) {
    return { ok: false, error: 'No puedes fusionar una categoría consigo misma.' }
  }

  const nombreSobra = sobra.name as string

  const { error: errorProveedores } = await supabase
    .from('suppliers')
    .update({ category_id: quedaId, category: nombreQueda })
    .eq('user_id', userId)
    .eq('category_id', sobraId)
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
      .update({ category_id: quedaId, category: nombreQueda })
      .in('event_id', eventIds)
      .eq('category_id', sobraId)
    if (errorPartidas) return { ok: false, error: errorPartidas.message }

    const { data: settingsRows, error: errorSettings } = await supabase
      .from('event_settings')
      .select('event_id, budget_categories')
      .in('event_id', eventIds)
    if (errorSettings) return { ok: false, error: errorSettings.message }

    for (const fila of settingsRows ?? []) {
      const lista = (fila.budget_categories as string[] | null) ?? []
      if (!lista.some(nombre => mismaCategoria(nombre, nombreSobra))) continue
      const sinSobra = lista.filter(nombre => !mismaCategoria(nombre, nombreSobra))
      const actualizada = sinSobra.some(nombre => mismaCategoria(nombre, nombreQueda))
        ? sinSobra
        : [...sinSobra, nombreQueda]
      const { error: errorLista } = await supabase
        .from('event_settings')
        .update({ budget_categories: actualizada })
        .eq('event_id', fila.event_id)
      if (errorLista) return { ok: false, error: errorLista.message }
    }
  }

  const { error: errorCategoria } = await supabase
    .from('categories')
    .delete()
    .eq('id', sobraId)
    .eq('user_id', userId)
  if (errorCategoria) {
    return {
      ok: false,
      error: 'No se pudo borrar la categoría porque un paso anterior no movió todo lo que la usaba. Vuelve a intentar fusionarla.',
    }
  }

  return { ok: true }
}

// El boton "Eliminar" ya viene apagado cuando hay uso, pero entre que la pantalla
// cargo y el planner hizo clic alguien pudo asignarle un proveedor desde otra
// pestana -por eso se vuelve a contar aqui antes de escribir. Si aun asi
// ON DELETE RESTRICT rechaza el borrado, el mensaje le dice al planner que
// alguien la esta usando y le sugiere fusionarla en vez de mostrarle el error crudo.
export async function eliminar(userId: string, categoriaId: string): Promise<Resultado> {
  const { count: proveedores, error: errorProveedores } = await supabase
    .from('suppliers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category_id', categoriaId)
  if (errorProveedores) return { ok: false, error: errorProveedores.message }

  const { data: eventos, error: errorEventos } = await supabase
    .from('events')
    .select('id')
    .eq('user_id', userId)
  if (errorEventos) return { ok: false, error: errorEventos.message }

  const eventIds = (eventos ?? []).map(e => e.id)

  const { count: partidas, error: errorPartidas } = eventIds.length > 0
    ? await supabase
        .from('event_budgets')
        .select('id', { count: 'exact', head: true })
        .in('event_id', eventIds)
        .eq('category_id', categoriaId)
    : { count: 0, error: null }
  if (errorPartidas) return { ok: false, error: errorPartidas.message }

  if ((proveedores ?? 0) > 0 || (partidas ?? 0) > 0) {
    return { ok: false, error: 'Alguien la está usando. Fusiónala con otra categoría en vez de eliminarla.' }
  }

  const { error } = await supabase.from('categories').delete().eq('id', categoriaId).eq('user_id', userId)
  if (error) {
    return { ok: false, error: 'Alguien la está usando. Fusiónala con otra categoría en vez de eliminarla.' }
  }

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
