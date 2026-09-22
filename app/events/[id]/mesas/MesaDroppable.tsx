'use client'

import { useDroppable } from '@dnd-kit/core'
import type { Persona } from '@/lib/mesas/asientos'

// Una mesa como destino de arrastre. Se prende en teal cuando la persona que
// se arrastra cabe; la llena no reacciona.
export default function MesaDroppable({ tableId, llena, arrastrando, redonda, enPlano, children, className, style }: {
  tableId: string
  llena: boolean
  arrastrando: Persona | null
  redonda?: boolean
  // En el plano la mesa se prende sola; el renglon "Soltar aqui" es de la lista.
  enPlano?: boolean
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 't:' + tableId, disabled: llena })
  const activo = isOver && !llena && !!arrastrando
  return (
    <div ref={setNodeRef} className={className} style={{ ...style, boxShadow: activo ? '0 0 0 3px #48C9B0' : undefined, borderRadius: redonda ? 999 : 12, transition: 'box-shadow .12s' }}>
      {children}
      {activo && !enPlano && (
        <div className="mx-2 mb-2 rounded-lg border border-dashed border-[#48C9B0] bg-[#f0fdfb] px-3 py-2 text-center text-[11px] font-semibold text-[#1f8a75]">Soltar aquí a {arrastrando!.nombre}</div>
      )}
    </div>
  )
}
