import { sinAcentos } from '@/lib/phone'

export type FichaOrdenable = { supplier: { name: string } }

const ATENUACION = 0.34
const OPACIDAD_MINIMA = 0.04
const OSCURECIMIENTO = 0.05
const BRILLO_MINIMO = 0.8

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

export function opacidadFicha(desplazamiento: number): number {
  const distancia = Math.abs(desplazamiento)
  return Math.max(OPACIDAD_MINIMA, 1 - distancia * ATENUACION)
}

// La ficha del frente tiene que ganarle a las de atras: se apagan y se hunden.
export function brilloFicha(desplazamiento: number): number {
  const distancia = Math.abs(desplazamiento)
  return Math.max(BRILLO_MINIMO, 1 - distancia * OSCURECIMIENTO)
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
