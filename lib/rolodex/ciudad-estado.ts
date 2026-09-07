import { mismoLugar } from '@/lib/geo/divisiones'

// Si cambiar el estado siempre borrara la ciudad, un formulario con Ciudad
// arriba de Estado le hace perder al planner lo que acaba de escribir en
// cuanto toca el campo de abajo. Solo hay que borrarla cuando de verdad deja
// de tener sentido: cuando SI tenemos el catalogo oficial de ciudades del
// estado nuevo y la escrita no aparece ahi. Sin catalogo (todo pais que no
// sea Mexico hoy) no hay forma de decir que esta mal, asi que se conserva.
export function ciudadSigueSiendoValida(ciudad: string, ciudadesDelEstado: string[]): boolean {
  const limpia = ciudad.trim()
  if (!limpia) return true
  if (ciudadesDelEstado.length === 0) return true
  return ciudadesDelEstado.some(c => mismoLugar(c, limpia))
}
