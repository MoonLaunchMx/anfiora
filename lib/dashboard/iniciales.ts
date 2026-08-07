// Palabras que no aportan inicial: "Ana y Rodrigo" debe dar A&R, no A&Y.
const CONECTORES = new Set(['y', 'e', 'o', 'u', '&', '+', 'de', 'del', 'la', 'las', 'los', 'el'])

function limpiar(p: string): string {
  return p.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
}

// Iniciales para el avatar del evento. Dos nombres unidos por "y" o "&" se
// leen como pareja (O&P); cualquier otro nombre se abrevia corrido (GA).
export function iniciales(nombre: string): string {
  const crudas = nombre.split(/\s+/).filter(Boolean)
  const utiles = crudas.filter(p => {
    const l = limpiar(p)
    return l.length > 0 && !CONECTORES.has(l)
  })

  const letras = utiles.slice(0, 2).map(p => {
    const l = limpiar(p)
    return l.charAt(0).toUpperCase()
  })

  if (letras.length === 0) return '?'
  if (letras.length === 1) return letras[0]

  const esPareja = crudas.some(p => {
    const l = limpiar(p)
    return p === '&' || l === 'y' || l === 'e'
  })

  return esPareja ? letras.join('&') : letras.join('')
}
