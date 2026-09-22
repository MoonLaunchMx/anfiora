'use client'

import { CheckCircle2, Clock, XCircle, Send, MessageSquare, AlertCircle } from 'lucide-react'
import type { Persona } from '@/lib/mesas/asientos'
import { estatusDe, ORDEN_ESTATUS } from './estatus'

export const estatusDeChip = estatusDe

function Glifo({ rsvp, size }: { rsvp: string; size: number }) {
  const p = { size, strokeWidth: 3 }
  switch (rsvp) {
    case 'confirmed': return <CheckCircle2 {...p} />
    case 'declined': return <XCircle {...p} />
    case 'mensaje_enviado': return <Send {...p} />
    case 'respondio': return <MessageSquare {...p} />
    case 'accion_necesaria': return <AlertCircle {...p} />
    default: return <Clock {...p} />
  }
}

// Circulo de color con el icono del estatus adentro. Es la unica forma en que
// el estatus se pinta en Mesas: chips, tarjetas y leyenda.
export function IconoEstatus({ rsvp, size = 16, conNombre }: { rsvp: string; size?: number; conNombre?: boolean }) {
  const st = estatusDe(rsvp)
  return (
    <span title={conNombre ? undefined : st.label} className="inline-flex shrink-0 items-center gap-1">
      <span className="inline-flex items-center justify-center rounded-full" style={{ width: size, height: size, background: st.border, color: '#fff' }}>
        <Glifo rsvp={rsvp} size={Math.round(size * 0.62)} />
      </span>
      {conNombre && <span className="text-[11px] font-semibold" style={{ color: st.text }}>{st.label}</span>}
    </span>
  )
}

export function LeyendaEstatus({ className }: { className?: string }) {
  return (
    <div className={'flex flex-wrap items-center gap-x-3 gap-y-1 ' + (className || '')}>
      {ORDEN_ESTATUS.map(k => <IconoEstatus key={k} rsvp={k} size={14} conNombre />)}
    </div>
  )
}

// Etiqueta gris: de quien es acompanante. Solo cuando se pinta fuera de su familia.
export function ChipTitular({ persona }: { persona: Persona }) {
  if (!persona.titular) return null
  return <span className="shrink-0 rounded-full border border-[#e0e0e0] px-1.5 py-0.5 text-[10px] font-medium text-[#666]">de {persona.titular}</span>
}

// Etiqueta ambar: solo cuando la familia esta repartida en mesas distintas.
export function ChipSeparado({ etiqueta, titulo }: { etiqueta: string | null; titulo?: string }) {
  if (!etiqueta) return null
  return <span title={titulo} className="shrink-0 rounded-full border border-[#f0dca8] bg-[#fffbf0] px-1.5 py-0.5 text-[10px] font-semibold text-[#9a6b12]">{etiqueta}</span>
}
