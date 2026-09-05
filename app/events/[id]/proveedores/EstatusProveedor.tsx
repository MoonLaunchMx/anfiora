'use client'

import { Ban, Check, CircleDashed, FileText } from 'lucide-react'
import { SupplierStatus, SUPPLIER_STATUS_LABELS } from '@/lib/types'

// El color no puede ser lo unico que distinga un estado: hay planners daltonicos.
// Cada estado trae su icono, y el camino se lee con palabras y palomitas.
const ICONO: Record<SupplierStatus, typeof Check> = {
  nuevo:      CircleDashed,
  cotizado:   FileText,
  contratado: Check,
  descartado: Ban,
}

const COLOR: Record<SupplierStatus, string> = {
  nuevo:      'bg-[#f1efe8] text-[#5F5C57]',
  cotizado:   'bg-[#FBF3E0] text-[#A87C1F]',
  contratado: 'bg-[#E6F3EC] text-[#1D9E75]',
  descartado: 'bg-[#FAEAE6] text-[#A63B27]',
}

export function EstatusProveedor({ estado, chico }: { estado: SupplierStatus; chico?: boolean }) {
  const Icono = ICONO[estado]
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-semibold ${COLOR[estado]} ${
      chico ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
    }`}>
      <Icono size={chico ? 10 : 12} strokeWidth={2.5} />
      {SUPPLIER_STATUS_LABELS[estado]}
    </span>
  )
}

const CAMINO: SupplierStatus[] = ['nuevo', 'cotizado', 'contratado']

export function CaminoDelTrato({ estado }: { estado: SupplierStatus }) {
  if (estado === 'descartado') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#A63B27]">
        <Ban size={12} strokeWidth={2.5} />
        Descartado
      </span>
    )
  }

  const actual = CAMINO.indexOf(estado)

  return (
    <ol className="flex items-center gap-1">
      {CAMINO.map((paso, i) => {
        const hecho = i < actual
        const aqui  = i === actual
        return (
          <li key={paso} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="mx-0.5 h-px w-2.5 bg-[#ddd]" />}
            <span
              aria-current={aqui ? 'step' : undefined}
              className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${
                aqui  ? 'bg-[#1D1E20] text-white'
                : hecho ? 'text-[#666]'
                        : 'text-[#c0c0c0]'
              }`}
            >
              {hecho && <Check size={10} strokeWidth={3} />}
              {SUPPLIER_STATUS_LABELS[paso]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
