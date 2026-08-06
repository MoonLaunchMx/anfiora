export const MODAL_HEIGHT_RATIO = 0.92

const FULL_HEIGHT_THRESHOLD = 200

export function panelMaxHeight(visualHeight: number, ratio = MODAL_HEIGHT_RATIO): number {
  if (!Number.isFinite(visualHeight) || visualHeight <= 0) return 0
  if (visualHeight <= FULL_HEIGHT_THRESHOLD) return Math.round(visualHeight)
  return Math.round(visualHeight * ratio)
}

export type ViewportRect = { top: number; left: number; width: number; height: number }

export type VisualViewportLike = {
  offsetTop: number
  offsetLeft: number
  width: number
  height: number
}

// iOS nunca encoge la pantalla de layout cuando abre el teclado: medido en un iPhone 13 Pro,
// `clientHeight` se queda en 663 mientras el area visible baja a 395. Un overlay en `inset-0`
// se ancla por tanto a una caja cuyo tercio inferior esta debajo del teclado. Esta funcion
// devuelve la caja que SI se ve, para anclar ahi.
export function visualRect(
  vv: VisualViewportLike | null | undefined,
  fallback: { width: number; height: number }
): ViewportRect {
  const full = {
    top: 0,
    left: 0,
    width: Math.round(fallback.width),
    height: Math.round(fallback.height),
  }
  if (!vv) return full

  const usable = (n: number) => Number.isFinite(n) && n > 0
  if (!usable(vv.width) || !usable(vv.height)) return full

  // Durante el rebote elastico iOS reporta desplazamientos negativos: seguirlos correria el
  // overlay fuera de la pantalla, asi que se recortan a cero.
  return {
    top: Math.max(0, Math.round(vv.offsetTop)),
    left: Math.max(0, Math.round(vv.offsetLeft)),
    width: Math.round(vv.width),
    height: Math.round(vv.height),
  }
}
