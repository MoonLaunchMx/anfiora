const DARK = '#1D1E20'
const LIGHT = '#ffffff'

export function relativeLuminance(color: string): number | null {
  const m = color.trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const chan = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4)
}

function contrastRatio(l1: number, l2: number): number {
  const hi = Math.max(l1, l2) + 0.05
  const lo = Math.min(l1, l2) + 0.05
  return hi / lo
}

// Devuelve un color de texto legible sobre `background`. Soporta solidos (#rgb,
// #rrggbb) y gradientes (promedia la luminancia de todos los stops hex). Si no
// hay ningun hex reconocible, asume fondo claro y devuelve texto oscuro.
export function readableTextColor(background: string, dark: string = DARK, light: string = LIGHT): string {
  const hexes = background.match(/#[0-9a-fA-F]{3,6}/g)
  const lums = (hexes ?? []).map(relativeLuminance).filter((v): v is number => v !== null)
  if (lums.length === 0) return dark
  const avg = lums.reduce((a, b) => a + b, 0) / lums.length
  const lumDark = relativeLuminance(dark) ?? 0
  const lumLight = relativeLuminance(light) ?? 1
  return contrastRatio(avg, lumDark) >= contrastRatio(avg, lumLight) ? dark : light
}
