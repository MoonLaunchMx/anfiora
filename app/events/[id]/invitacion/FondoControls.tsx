'use client'
import type { InviteDoc } from '@/lib/invite/schema'
import type { EffectId } from '@/lib/invite/theme'
import { EFFECT_IDS } from '@/lib/invite/theme'
import { setTheme } from '@/lib/invite/doc'
import { themeCssVars } from '@/lib/invite/theme-css'
import InvitacionFondo from '@/app/components/invitacion/InvitacionFondo'

const LABELS: Record<EffectId, string> = {
  none: 'Ninguno',
  'gradiente-vivo': 'Gradiente',
  confeti: 'Confeti',
  'grid-synthwave': 'Synthwave',
  estrellas: 'Estrellas',
  olas: 'Olas',
  bokeh: 'Bokeh',
  petalos: 'Pétalos',
  hojas: 'Hojas',
  'papel-cuaderno': 'Cuaderno',
  'papel-cuadricula': 'Cuadrícula',
  aurora: 'Aurora',
  halftone: 'Halftone',
  'papel-arrugado': 'Papel',
  'bola-disco': 'Bola disco',
}

export default function FondoControls({ doc, onChange }: { doc: InviteDoc; onChange: (next: InviteDoc) => void }) {
  const t = doc.theme
  const current: EffectId = t.fondo.tipo === 'animado' ? t.fondo.efectoId : 'none'
  const vars = themeCssVars(t) as React.CSSProperties

  const pick = (id: EffectId) =>
    onChange(
      setTheme(doc, {
        fondo: id === 'none' ? { tipo: 'solido', efectoId: 'none' } : { tipo: 'animado', efectoId: id },
      }),
    )

  return (
    <div className="grid grid-cols-4 gap-2">
      {EFFECT_IDS.map(id => {
        const previewTheme = {
          ...t,
          fondo: id === 'none' ? { tipo: 'solido' as const, efectoId: 'none' as const } : { tipo: 'animado' as const, efectoId: id },
        }
        const selected = current === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => pick(id)}
            className={`flex flex-col items-center gap-1 rounded-lg border p-1 transition ${
              selected ? 'border-[#48C9B0] ring-1 ring-[#48C9B0]' : 'border-[#e0e0e0] hover:border-[#48C9B0]'
            }`}
          >
            <span
              className="inv-theme relative block h-14 w-full overflow-hidden rounded-md"
              style={{ ...vars, background: t.colores.fondo }}
            >
              <InvitacionFondo theme={previewTheme} />
            </span>
            <span className={`text-[10px] leading-tight ${selected ? 'font-semibold text-[#1D1E20]' : 'text-[#666]'}`}>
              {LABELS[id]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
