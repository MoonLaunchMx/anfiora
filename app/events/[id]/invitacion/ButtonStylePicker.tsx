'use client'
import type { Theme } from '@/lib/invite/theme'
import { BUTTON_FORMAS, BUTTON_ESTILOS } from '@/lib/invite/theme'
import { themeCssVars } from '@/lib/invite/theme-css'

const FORMA_LABEL: Record<string, string> = { pill: 'Pastilla', redondo: 'Redondo', recto: 'Recto' }
const ESTILO_LABEL: Record<string, string> = {
  relleno: 'Relleno', contorno: 'Contorno', degradado: 'Degradado', elevado: 'Elevado', retro3d: 'Retro 3D', neon: 'Neón', cromo: 'Cromo',
}
const FORMA_RADIUS_CLASS: Record<string, string> = { pill: 'rounded-full', redondo: 'rounded-[7px]', recto: 'rounded-[2px]' }

export default function ButtonStylePicker({
  theme,
  onForma,
  onEstilo,
}: {
  theme: Theme
  onForma: (f: Theme['boton']['forma']) => void
  onEstilo: (e: Theme['boton']['estilo']) => void
}) {
  const vars = themeCssVars(theme)

  return (
    <div className="flex flex-col gap-4" style={vars as React.CSSProperties}>
      <div className="flex gap-2">
        {BUTTON_FORMAS.map(f => {
          const isActive = theme.boton.forma === f
          return (
            <button
              key={f}
              type="button"
              onClick={() => onForma(f)}
              className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors ${
                isActive ? 'border-[#48C9B0] bg-[#f0fdfa]' : 'border-[#e0e0e0] bg-white hover:bg-[#f5f5f5]'
              }`}
            >
              <span className={`h-[22px] w-[44px] ${FORMA_RADIUS_CLASS[f]} ${isActive ? 'bg-[#1D1E20]' : 'bg-[#ccc]'}`} />
              <span className="text-[10px] text-[#666]">{FORMA_LABEL[f]}</span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {BUTTON_ESTILOS.map(estilo => {
          const isActive = theme.boton.estilo === estilo
          return (
            <button
              key={estilo}
              type="button"
              onClick={() => onEstilo(estilo)}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors ${
                isActive ? 'border-[#48C9B0] bg-[#f0fdfa]' : 'border-[#e0e0e0] bg-white hover:bg-[#f5f5f5]'
              }`}
            >
              <span
                className={`inv-btn inv-btn-${estilo}`}
                style={{ padding: '5px 12px', fontSize: 11, borderRadius: 'var(--inv-boton-radius)' }}
              >
                Aa
              </span>
              <span className="text-[10px] text-[#666]">{ESTILO_LABEL[estilo]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
