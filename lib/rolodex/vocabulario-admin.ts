import { normalizarCategoria } from './categorias'

export type Uso = { proveedores: number; partidas: number }

export type CategoriaConUso = {
  id: string
  nombre: string
  uso: Uso
  oculta: boolean
}

// Distancia de edicion acotada: pasando de 3 ya no nos interesa, y salir
// temprano evita comparar cien categorias entre si sin necesidad.
function distancia(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let anterior = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const guardado = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1))
      anterior = guardado
    }
  }
  return prev[b.length]
}

// La comparacion sin acentos ya impide CREAR una casi igual, asi que esto sirve
// para las que ya existian y para lo que esa comparacion no atrapa: plurales,
// una letra de mas, o una que empieza igual que otra.
export function parecidas(nombres: string[]): [string, string][] {
  const pares: [string, string][] = []
  for (let i = 0; i < nombres.length; i++) {
    for (let j = i + 1; j < nombres.length; j++) {
      const a = normalizarCategoria(nombres[i])
      const b = normalizarCategoria(nombres[j])
      if (!a || !b) continue
      if (a.startsWith(b) || b.startsWith(a) || distancia(a, b) <= 2) {
        pares.push([nombres[i], nombres[j]])
      }
    }
  }
  return pares
}

export function puedeEliminarse(uso: Uso): boolean {
  return uso.proveedores === 0 && uso.partidas === 0
}
