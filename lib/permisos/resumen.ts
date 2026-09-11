import { MODULOS, type Nivel, type PermisosEvento } from './catalogo'

// Como quedo un evento, en dos palabras, para leerlo sin abrirlo. Puro a
// proposito: no importa lib/supabase, para que se pueda probar con Vitest.
//
// Se nombra el nivel MAS ALTO que esa persona tiene en el evento y cuantas
// herramientas alcanza en total. "Edita 9" se lee de un golpe; enumerar los
// doce niveles en una lista lateral no se lee nunca.

export interface ResumenEvento {
  entra: number
  nivelTope: Nivel
  texto: string
}

const VERBO: Record<Nivel, string> = {
  ninguno: 'Sin acceso',
  ver: 'Ve',
  editar: 'Edita',
  total: 'Total',
}

const ORDEN: Nivel[] = ['ninguno', 'ver', 'editar', 'total']

export function resumenPermisos(permisos: PermisosEvento | null | undefined): ResumenEvento {
  let entra = 0
  let nivelTope: Nivel = 'ninguno'

  for (const m of MODULOS) {
    const nivel = permisos?.[m] ?? 'ninguno'
    if (nivel === 'ninguno') continue
    entra++
    if (ORDEN.indexOf(nivel) > ORDEN.indexOf(nivelTope)) nivelTope = nivel
  }

  return {
    entra,
    nivelTope,
    texto: entra === 0 ? VERBO.ninguno : `${VERBO[nivelTope]} ${entra}`,
  }
}
