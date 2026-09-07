import { mismaCategoria } from './categorias'
import { activas, nombrePorId, type Categoria } from './categorias-store'

// Cajon de rescate. No es una categoria del catalogo: solo existe en pantalla
// cuando hay partidas cuya categoria se archivo o se borro. Sin el, esas
// partidas no caerian en ninguna seccion y desaparecerian de la vista con su
// monto: dinero que el planner deja de ver.
export const SECCION_SIN_CATEGORIA = 'Sin categoría'

// Las secciones del presupuesto son las categorias VIVAS del despacho, no una
// lista fija de texto. Una lista fija no ve las categorias que el planner crea
// desde Proveedores, y ademas duplica secciones cuando su grafia difiere de la
// de la tabla ("Planeacion" contra "Planeación").
// `orden` es la preferencia por evento (event_settings.budget_categories): solo
// ordena, nunca filtra, porque filtrar volveria a esconder lo recien creado.
export function seccionesDelPresupuesto(
  categorias: Categoria[],
  orden: string[] | null | undefined,
): string[] {
  const vivas = activas(categorias)
  const puestas = new Set<string>()
  const secciones: string[] = []

  for (const nombre of orden ?? []) {
    const cat = vivas.find(c => mismaCategoria(c.name, nombre))
    if (cat && !puestas.has(cat.id)) {
      secciones.push(cat.name)
      puestas.add(cat.id)
    }
  }
  for (const cat of vivas) {
    if (!puestas.has(cat.id)) {
      secciones.push(cat.name)
      puestas.add(cat.id)
    }
  }
  return secciones
}

export function agruparPorSeccion<T extends { category_id?: string | null }>(
  partidas: T[],
  secciones: string[],
  categorias: Categoria[],
): { secciones: string[]; porSeccion: Record<string, T[]> } {
  const porSeccion: Record<string, T[]> = {}
  secciones.forEach(s => { porSeccion[s] = [] })

  let hayHuerfanas = false
  for (const partida of partidas) {
    const nombre = nombrePorId(categorias, partida.category_id)
    const seccion = nombre ? secciones.find(s => mismaCategoria(s, nombre)) : undefined
    if (seccion) {
      porSeccion[seccion].push(partida)
      continue
    }
    hayHuerfanas = true
    if (!porSeccion[SECCION_SIN_CATEGORIA]) porSeccion[SECCION_SIN_CATEGORIA] = []
    porSeccion[SECCION_SIN_CATEGORIA].push(partida)
  }

  return {
    secciones: hayHuerfanas ? [...secciones, SECCION_SIN_CATEGORIA] : secciones,
    porSeccion,
  }
}
