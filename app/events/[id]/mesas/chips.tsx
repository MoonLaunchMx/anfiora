'use client'

import type { Persona } from '@/lib/mesas/asientos'
import { estatusDe } from './estatus'

export const estatusDeChip = estatusDe

// Etiqueta gris: de quien es acompanante. Solo en acompanantes.
export function ChipTitular({ persona }: { persona: Persona }) {
  if (!persona.titular) return null
  return <span className="shrink-0 rounded-full border border-[#e0e0e0] px-1.5 py-0.5 text-[10px] font-medium text-[#666]">de {persona.titular}</span>
}

// Etiqueta ambar: solo cuando la familia esta repartida en mesas distintas.
export function ChipSeparado({ etiqueta, titulo }: { etiqueta: string | null; titulo?: string }) {
  if (!etiqueta) return null
  return <span title={titulo} className="shrink-0 rounded-full border border-[#f0dca8] bg-[#fffbf0] px-1.5 py-0.5 text-[10px] font-semibold text-[#9a6b12]">{etiqueta}</span>
}
