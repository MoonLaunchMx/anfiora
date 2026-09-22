'use client'

import { useDroppable } from '@dnd-kit/core'
import type { Persona } from '@/lib/mesas/asientos'

// Una mesa del plano como destino de arrastre. Se prende en teal cuando la
// familia que se arrastra cabe; si no cabe, no reacciona.
export default function MesaDroppable({ tableId, libres, ocupados, arrastrando, redonda, children, className, style }: {
  tableId: string
  libres: number
  ocupados: Persona[]
  arrastrando: Persona[] | null
  redonda?: boolean
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const entran = arrastrando ? arrastrando.filter(p => !ocupados.some(o => o.clave === p.clave)).length : 0
  const cabe = !!arrastrando && entran > 0 && entran <= libres
  const { setNodeRef, isOver } = useDroppable({ id: 't:' + tableId, disabled: !cabe })
  const activo = isOver && cabe
  return (
    <div ref={setNodeRef} className={className} style={{ ...style, boxShadow: activo ? '0 0 0 3px #48C9B0' : undefined, borderRadius: redonda ? 999 : 12, transition: 'box-shadow .12s' }}>
      {children}
    </div>
  )
}
