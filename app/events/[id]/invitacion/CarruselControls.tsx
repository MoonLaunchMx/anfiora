'use client'
import type { InviteDoc } from '@/lib/invite/schema'
import type { CarruselEstilo } from '@/lib/invite/theme'
import { CARRUSEL_ESTILOS } from '@/lib/invite/theme'
import { setTheme } from '@/lib/invite/doc'
import CarruselViewer from '@/app/components/invitacion/CarruselViewer'

const LABELS: Record<CarruselEstilo, string> = {
  fundido: 'Fundido',
  zoom: 'Zoom cine',
  deslizar: 'Deslizar',
  polaroid: 'Polaroid',
}

const ph = (from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='100'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='80' height='100' fill='url(%23g)'/></svg>`,
  )}`

const PLACEHOLDER = [ph('#f0c987', '#d98cae'), ph('#8ecae6', '#219ebc'), ph('#cdb4db', '#ffc8dd')]

export default function CarruselControls({ doc, onChange }: { doc: InviteDoc; onChange: (next: InviteDoc) => void }) {
  const current = doc.theme.carrusel.estilo

  return (
    <div className="grid grid-cols-4 gap-2">
      {CARRUSEL_ESTILOS.map(estilo => {
        const selected = current === estilo
        return (
          <button
            key={estilo}
            type="button"
            onClick={() => onChange(setTheme(doc, { carrusel: { estilo } }))}
            className={`flex flex-col items-center gap-1 rounded-lg border p-1 transition ${
              selected ? 'border-[#48C9B0] ring-1 ring-[#48C9B0]' : 'border-[#e0e0e0] hover:border-[#48C9B0]'
            }`}
          >
            <span className="pointer-events-none block h-16 w-full overflow-hidden rounded-md bg-[#f5f5f5]">
              <CarruselViewer fotos={PLACEHOLDER} estilo={estilo} mini />
            </span>
            <span className={`text-[10px] leading-tight ${selected ? 'font-semibold text-[#1D1E20]' : 'text-[#666]'}`}>
              {LABELS[estilo]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
