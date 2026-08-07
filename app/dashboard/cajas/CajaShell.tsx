'use client'

import { GripVertical, X } from 'lucide-react'
import type { CajaId } from '@/lib/dashboard/tablero'
import type { ColaboradorRow, EventMetrics } from '@/lib/dashboard/types'

export const T_SECCION = 'font-display text-[18px] font-bold tracking-[-0.015em] sm:text-[20px]'
export const T_META = 'text-[12.5px] text-[#888]'
export const T_METRICA = 'font-display text-[32px] font-extrabold leading-none tracking-[-0.025em]'
export const T_CUERPO = 'text-[13.5px] text-[#666]'

export const CHIP_BASE = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap'
export const CHIP_MUTE = `${CHIP_BASE} border-[#E8E8E8] bg-[#F8F8F8] text-[#777]`
export const CHIP_BAD = `${CHIP_BASE} border-[#FFC0C0] bg-[#FFF0F0] text-[#CC3333]`
export const CHIP_WARN = `${CHIP_BASE} border-[#F0DCA8] bg-[#FFF8E8] text-[#B8860B]`

export const BTN_SEC = 'rounded-[10px] border border-[#E0E0E0] bg-[#F8F8F8] px-3.5 py-2 text-[13px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]'

// Firma unica de las seis cajas. Cada una recibe todo aunque no use todo: asi
// el mapa de componentes del Tablero es un Record homogeneo.
export type PropsCaja = {
  m: EventMetrics
  colaboradores: ColaboradorRow[]
  usuarioEmail: string
  puedeVerDinero: boolean
  modoPersonalizar: boolean
  onQuitar: (id: CajaId) => void
}

// La manija de arrastre es la clase .caja-arrastre: react-grid-layout la recibe
// como draggableHandle, para que dentro de la caja se pueda hacer clic sin
// correr el tablero.
export default function CajaShell({ id, titulo, meta, accion, modoPersonalizar, onQuitar, children }: {
  id: CajaId
  titulo: string
  meta?: string
  accion?: { label: string; href: string }
  modoPersonalizar: boolean
  onQuitar: (id: CajaId) => void
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white">
      <div className={'flex shrink-0 items-center justify-between gap-3 border-b border-[#E8E8E8] px-5 py-4 ' + (modoPersonalizar ? 'caja-arrastre cursor-grab active:cursor-grabbing' : '')}>
        <div className="flex min-w-0 items-center gap-2">
          {modoPersonalizar && <GripVertical size={16} className="shrink-0 text-[#BBB]" />}
          <div className="min-w-0">
            <h3 className={T_SECCION}>{titulo}</h3>
            {meta && <p className={T_META}>{meta}</p>}
          </div>
        </div>

        {modoPersonalizar ? (
          <button
            onClick={() => onQuitar(id)}
            aria-label={`Quitar ${titulo} del tablero`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-[#E0E0E0] bg-white text-[#888] transition hover:border-[#CC3333] hover:text-[#CC3333]"
          >
            <X size={15} />
          </button>
        ) : accion ? (
          <button onClick={() => { window.location.href = accion.href }} className={BTN_SEC + ' shrink-0'}>
            {accion.label}
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
