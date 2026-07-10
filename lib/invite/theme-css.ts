import type { Theme, ButtonForma } from './theme'

export const FORMA_RADIUS: Record<ButtonForma, string> = {
  pill: '999px',
  redondo: '10px',
  recto: '3px',
}

export function themeCssVars(theme: Theme): Record<string, string> {
  return {
    '--inv-fondo': theme.colores.fondo,
    '--inv-texto': theme.colores.texto,
    '--inv-acento': theme.colores.acento,
    '--inv-boton-bg': theme.colores.botonBg,
    '--inv-boton-texto': theme.colores.botonTexto,
    '--inv-boton-radius': FORMA_RADIUS[theme.boton.forma],
    '--inv-font-titulo-id': theme.fonts.titulo,
    '--inv-font-cuerpo-id': theme.fonts.cuerpo,
    '--inv-acento-bg': `color-mix(in srgb, ${theme.colores.acento} 12%, #ffffff)`,
    '--inv-acento-borde': `color-mix(in srgb, ${theme.colores.acento} 32%, #ffffff)`,
  }
}

export function botonClass(theme: Theme): string {
  return `inv-btn inv-btn-${theme.boton.estilo}`
}
