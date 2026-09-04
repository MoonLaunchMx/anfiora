import { mismaCategoria } from './categorias'

export type Categoria = {
  id: string
  name: string
  archived_at: string | null
}

export function activas(cats: Categoria[]): Categoria[] {
  return cats.filter(c => c.archived_at === null)
}

// Busca entre TODAS, incluidas las ocultas: una categoria oculta sigue
// existiendo, solo deja de ofrecerse. Buscarla y no encontrarla llevaria a
// crear una duplicada.
export function buscarPorNombre(cats: Categoria[], nombre: string): Categoria | null {
  return cats.find(c => mismaCategoria(c.name, nombre)) ?? null
}

export function nombrePorId(cats: Categoria[], id: string | null | undefined): string {
  if (!id) return ''
  return cats.find(c => c.id === id)?.name ?? ''
}

// Import dinamico: si fuera estatico, crear el cliente de Supabase se
// ejecutaria al cargar el modulo y romperia las pruebas de las funciones
// puras de arriba, que no necesitan tocar la base de datos.
export async function cargarCategorias(userId: string): Promise<Categoria[]> {
  const { supabase } = await import('@/lib/supabase')
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, archived_at')
    .eq('user_id', userId)
    .order('name')
  if (error) {
    console.error('Error cargando categorias:', error.message)
    return []
  }
  return (data ?? []) as Categoria[]
}

// Si dos pestanas crean la misma categoria a la vez, el indice unico
// rechaza la segunda; se relee y se devuelve la que gano, sin mostrar error.
export async function crearCategoria(
  userId: string,
  nombre: string,
  yaCargadas: Categoria[],
): Promise<{ categoria?: Categoria; error?: string }> {
  const existente = buscarPorNombre(yaCargadas, nombre)
  if (existente) return { categoria: existente }

  const { supabase } = await import('@/lib/supabase')
  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, name: nombre })
    .select('id, name, archived_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      const { data: recargadas } = await supabase
        .from('categories')
        .select('id, name, archived_at')
        .eq('user_id', userId)
        .order('name')
      const ganadora = recargadas ? buscarPorNombre(recargadas as Categoria[], nombre) : null
      if (ganadora) return { categoria: ganadora }
      return { error: 'No se pudo crear la categoría.' }
    }
    console.error('Error creando categoria:', error.message)
    return { error: 'No se pudo crear la categoría.' }
  }

  return { categoria: data as Categoria }
}
