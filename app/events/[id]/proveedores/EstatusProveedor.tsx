'use client'

import { Ban, Check, CircleDashed, FileText } from 'lucide-react'
import { SupplierStatus, SUPPLIER_STATUS_LABELS } from '@/lib/types'
import { CAMINO, pasosAlcanzados } from '@/lib/rolodex/ficha-por-estado'

// El color no puede ser lo unico que distinga un estado: hay planners daltonicos.
// Cada estado trae su icono, y el camino se lee con palabras y palomitas.
export const ICONO_ESTADO: Record<SupplierStatus, typeof Check> = {
  nuevo:      CircleDashed,
  cotizado:   FileText,
  contratado: Check,
  descartado: Ban,
}

export const COLOR_ESTADO: Record<SupplierStatus, string> = {
  nuevo:      'bg-[#f1efe8] text-[#5F5C57]',
  cotizado:   'bg-[#FBF3E0] text-[#A87C1F]',
  contratado: 'bg-[#E6F3EC] text-[#1D9E75]',
  descartado: 'bg-[#FAEAE6] text-[#A63B27]',
}

export function EstatusProveedor({ estado, chico }: { estado: SupplierStatus; chico?: boolean }) {
  const Icono = ICONO_ESTADO[estado]
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-semibold ${COLOR_ESTADO[estado]} ${
      chico ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
    }`}>
      <Icono size={chico ? 10 : 12} strokeWidth={2.5} />
      {SUPPLIER_STATUS_LABELS[estado]}
    </span>
  )
}

// El estatus completo: los tres pasos con palomita en los que ya diste, y el
// actual resaltado. Descartado se sale del camino y lo dice.
export function CaminoDelTrato({ estado }: { estado: SupplierStatus }) {
  const alcanzados = pasosAlcanzados(estado)
  const fuera = estado === 'descartado'

  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1">
      {CAMINO.map((paso, i) => {
        const hecho = alcanzados.includes(paso)
        const aqui  = paso === estado
        return (
          <li key={paso} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="mx-0.5 h-px w-2.5 bg-[#e0e0e0]" />}
            <span
              aria-current={aqui ? 'step' : undefined}
              className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${
                aqui  ? 'bg-[#1D1E20] text-white'
                : hecho ? 'bg-[#f1f1f1] text-[#555]'
                        : 'text-[#c4c4c4]'
              }`}
            >
              {hecho && <Check size={10} strokeWidth={3} />}
              {SUPPLIER_STATUS_LABELS[paso]}
            </span>
          </li>
        )
      })}

      {fuera && (
        <li className="flex items-center gap-1">
          <span aria-hidden className="mx-0.5 h-px w-2.5 bg-[#e0e0e0]" />
          <span aria-current="step" className="flex items-center gap-1 rounded-md bg-[#FAEAE6] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#A63B27]">
            <Ban size={10} strokeWidth={3} />
            Descartado
          </span>
        </li>
      )}
    </ol>
  )
}
