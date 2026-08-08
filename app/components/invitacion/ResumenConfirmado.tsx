'use client'

import { Check, X } from 'lucide-react'
import type { ContactoPlanner as Contacto } from '@/lib/invite/post-confirmacion'
import ContactoPlannerCard from './ContactoPlanner'

export type ResumenFila = {
  key: string
  name: string
  attends: boolean
  allergies: string[]
}

type Props = {
  filas: ResumenFila[]
  contacto: Contacto | null
  eventName: string
  // null cuando ya cerraron las confirmaciones: el resumen se queda sin salida
  // y la unica via es escribirle al planner.
  onCambiar: (() => void) | null
}

// Lo que ve el invitado que ya respondio por todos. Reemplaza al formulario, que
// hasta el 8-ago se quedaba abierto para siempre: se podia seguir cambiando el
// Si/No y agregando alergias sin limite, y al recargar reaparecia en blanco.
export default function ResumenConfirmado({ filas, contacto, eventName, onCambiar }: Props) {
  const alguienVa = filas.some(f => f.attends)

  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-[#e8e8e8] bg-white px-5 py-6">
      <div className="text-center">
        <div className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full ${alguienVa ? 'bg-[#2a7a50]' : 'bg-[#bbb]'}`}>
          <Check size={22} className="text-white" />
        </div>
        <p className="text-base font-semibold text-[#1D1E20]">
          {alguienVa ? 'Ya confirmaste' : 'Ya respondiste'}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {filas.map(f => (
          <div key={f.key} className="border-b border-[#f2f2f2] pb-3 last:border-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[#1D1E20]">{f.name}</span>
              <span className={`flex shrink-0 items-center gap-1 text-xs font-medium ${f.attends ? 'text-[#2a7a50]' : 'text-[#999]'}`}>
                {f.attends ? <><Check size={12} /> Sí va</> : <><X size={12} /> No va</>}
              </span>
            </div>
            {f.allergies.length > 0 && (
              <p className="mt-1.5 text-[11px] text-[#888]">
                {f.allergies.join(' · ')}
              </p>
            )}
          </div>
        ))}
      </div>

      <ContactoPlannerCard contacto={contacto} eventName={eventName} />

      {onCambiar && (
        <button
          type="button"
          onClick={onCambiar}
          className="mt-4 w-full text-center text-xs font-medium text-[#999] underline underline-offset-2 transition hover:text-[#666]"
        >
          Cambiar mi respuesta
        </button>
      )}
    </div>
  )
}
