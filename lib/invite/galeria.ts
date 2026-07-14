export const MAX_GALERIA_FOTOS = 8

export function addFotos(fotos: string[], nuevas: string[], max = MAX_GALERIA_FOTOS): string[] {
  return [...fotos, ...nuevas].slice(0, max)
}

export function removeFotoAt(fotos: string[], index: number): string[] {
  return fotos.filter((_, i) => i !== index)
}

export function moveFoto(fotos: string[], index: number, dir: -1 | 1): string[] {
  const target = index + dir
  if (index < 0 || index >= fotos.length) return fotos
  if (target < 0 || target >= fotos.length) return fotos
  const next = [...fotos]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
