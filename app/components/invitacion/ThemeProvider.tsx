'use client'
import type { ReactNode } from 'react'
import type { Theme } from '@/lib/invite/theme'
import { themeCssVars } from '@/lib/invite/theme-css'
import { googleFontsHref, fontStack } from '@/lib/invite/fonts'

export default function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }) {
  const vars = themeCssVars(theme)
  const href = googleFontsHref([theme.fonts.titulo, theme.fonts.cuerpo])
  const style = {
    ...vars,
    ['--inv-font-titulo' as string]: fontStack(theme.fonts.titulo),
    ['--inv-font-cuerpo' as string]: fontStack(theme.fonts.cuerpo),
  } as React.CSSProperties
  return (
    <div className="inv-theme min-h-full" style={{ ...style, background: 'var(--inv-fondo)' }}>
      {href && <link rel="stylesheet" href={href} />}
      {children}
    </div>
  )
}
