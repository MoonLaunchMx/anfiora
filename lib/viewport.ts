export const MODAL_HEIGHT_RATIO = 0.92

const FULL_HEIGHT_THRESHOLD = 200

export function panelMaxHeight(visualHeight: number, ratio = MODAL_HEIGHT_RATIO): number {
  if (!Number.isFinite(visualHeight) || visualHeight <= 0) return 0
  if (visualHeight <= FULL_HEIGHT_THRESHOLD) return Math.round(visualHeight)
  return Math.round(visualHeight * ratio)
}
