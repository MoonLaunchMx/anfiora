import { agregarAlVocabulario } from './categorias'

// Devuelve el vocabulario nuevo, o null si no hay nada que guardar. El null
// existe para no mandar un UPDATE por cada vez que alguien abre el presupuesto.
//
// El vocabulario solo CRECE: que un evento deje de usar una categoria no
// significa que el planner la quiera perder de su Rolodex.
export function categoriasParaGuardar(
  vocabularioActual: string[],
  categoriasDelEvento: string[],
): string[] | null {
  let siguiente = vocabularioActual
  for (const c of categoriasDelEvento) {
    siguiente = agregarAlVocabulario(siguiente, c)
  }
  return siguiente === vocabularioActual ? null : siguiente
}
