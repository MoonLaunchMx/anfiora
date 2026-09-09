import { mismaCategoria } from './categorias'
import { activas, nombrePorId, type Categoria } from './categorias-store'

// Cajon de rescate. No es una categoria del catalogo: solo existe en pantalla
// cuando hay partidas cuya categoria se archivo o se borro. Sin el, esas
// partidas no caerian en ninguna seccion y desaparecerian de la vista con su
// monto: dinero que el planner deja de ver.
export const SECCION_SIN_CATEGORIA = 'Sin categoría'

// Las secciones del presupuesto son las categorias VIVAS del despacho, no una
// lista fija de texto. `seleccion` es la eleccion de ESTE evento (event_settings.
// budget_categories): vacia o nula significa "todas las categorias activas del
// catalogo" -- es el comportamiento de siempre para toda boda que nunca lo
// personalizo, y tiene que seguir siendolo aunque la lista deje de ser solo
// orden y pase a filtrar. Una seleccion no vacia SI filtra: solo entran los
// nombres elegidos, en ese orden. Un nombre elegido que ya no existe en el
// catalogo (se borro o se archivo) se ignora en silencio, nunca inventa seccion.
//
// La seleccion solo esconde categorias VACIAS (issue #67): una categoria viva
// con partidas en este evento se muestra siempre, este o no en la lista, para
// que su monto nunca caiga a "Sin categoria" por una seleccion vieja.
export function seccionesDelPresupuesto(
  categorias: Categoria[],
  seleccion: string[] | null | undefined,
  partidas: { category_id?: string | null }[] = [],
): string[] {
  const vivas = activas(categorias)

  if (!seleccion || seleccion.length === 0) {
    return vivas.map(c => c.name)
  }

  const puestas = new Set<string>()
  const secciones: string[] = []
  for (const nombre of seleccion) {
    const cat = vivas.find(c => mismaCategoria(c.name, nombre))
    if (cat && !puestas.has(cat.id)) {
      secciones.push(cat.name)
      puestas.add(cat.id)
    }
  }

  const usadas = new Set(partidas.map(p => p.category_id).filter((id): id is string => !!id))
  for (const cat of vivas) {
    if (usadas.has(cat.id) && !puestas.has(cat.id)) {
      secciones.push(cat.name)
      puestas.add(cat.id)
    }
  }
  return secciones
}

// Quitar una categoria de la boda no toca el catalogo: solo dice que esta
// boda ya no la muestra. Si la lista guardada estaba vacia (== "todas"), hay
// que materializarla completa primero -- si solo se guardara la ausencia de
// un nombre, una lista vacia se seguiria leyendo como "todas", incluida la
// que se acaba de quitar.
export function quitarDeSeleccion(
  categorias: Categoria[],
  seleccion: string[] | null | undefined,
  nombre: string,
): string[] {
  return seccionesDelPresupuesto(categorias, seleccion).filter(c => !mismaCategoria(c, nombre))
}

// Una categoria con partidas en ESTA boda no se puede quitar sin antes mover
// esas partidas a otra: quitarla las escondería junto con su monto -- lo mismo
// que SECCION_SIN_CATEGORIA existe para evitar cuando la categoria se archiva
// desde el catalogo, pero aqui se previene antes de que llegue a pasar.
export function tienePartidasEnEvento<T extends { category_id?: string | null }>(
  partidas: T[],
  categoriaId: string,
): boolean {
  return partidas.some(p => p.category_id === categoriaId)
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
