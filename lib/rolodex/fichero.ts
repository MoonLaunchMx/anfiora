import { sinAcentos } from '@/lib/phone'

export type FichaOrdenable = { supplier: { name: string } }

const VELO_POR_FICHA = 0.42
const VELO_MAXIMO = 0.88

export function ordenarFichas<T extends FichaOrdenable>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.supplier.name.localeCompare(b.supplier.name, 'es', { sensitivity: 'base' })
  )
}

export function letraDe(nombre: string): string {
  const inicial = sinAcentos(nombre.trim()).charAt(0).toUpperCase()
  return inicial >= 'A' && inicial <= 'Z' ? inicial : '#'
}

export function indicePrimeraLetra(items: FichaOrdenable[]): Record<string, number> {
  const mapa: Record<string, number> = {}
  items.forEach((item, i) => {
    const letra = letraDe(item.supplier.name)
    if (mapa[letra] === undefined) mapa[letra] = i
  })
  return mapa
}

export function moverIndice(actual: number, delta: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(Math.max(actual + delta, 0), total - 1)
}

export function desplazamientoFicha(indice: number, activo: number, arrastre: number): number {
  return indice - activo - arrastre
}

// Las de atras se apagan con un velo DENTRO de la ficha, no con opacity ni filter
// sobre la ficha misma: eso la saca del orden por profundidad del contenedor 3D y
// el navegador termina pintando las de atras encima de la del frente.
export function veloFicha(desplazamiento: number): number {
  return Math.min(VELO_MAXIMO, Math.abs(desplazamiento) * VELO_POR_FICHA)
}

export function escalaFicha(desplazamiento: number): number {
  const distancia = Math.abs(desplazamiento)
  return Math.max(0.9, 1 - distancia * 0.03)
}

export function indiceAlSoltar(activo: number, arrastre: number, total: number): number {
  return moverIndice(Math.round(activo + arrastre), 0, total)
}

// La rueda solo se queda el scroll mientras el fichero pueda girar: en la primera
// y la ultima ficha se lo devuelve a la pagina, o el usuario queda atrapado.
export function puedeAvanzar(activo: number, delta: number, total: number): boolean {
  if (total <= 0) return false
  const destino = activo + delta
  return destino >= 0 && destino <= total - 1
}
