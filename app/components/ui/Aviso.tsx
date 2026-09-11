'use client'

import { AlertCircle, CheckCircle, X } from 'lucide-react'

// El aviso de "salio bien" o "salio mal" de toda la app. Vivia copiado en cada
// pantalla, y al final habia dos diseños distintos para exactamente lo mismo.
// Aqui hay uno solo.
//
// `onCerrar` es opcional: se pasa cuando el aviso no se va por su cuenta y el
// usuario necesita poder quitarlo de en medio.

export type TonoAviso = 'exito' | 'error'

interface Props {
  tono: TonoAviso
  mensaje: string
  onCerrar?: () => void
  className?: string
}

const ESTILO: Record<TonoAviso, string> = {
  exito: 'border-[#a0e0c0] bg-[#f0fff6] text-[#2a7a50]',
  error: 'border-[#ffc0c0] bg-[#fff0f0] text-[#cc3333]',
}

export function Aviso({ tono, mensaje, onCerrar, className = '' }: Props) {
  return (
    <div
      role="status"
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-snug ${ESTILO[tono]} ${className}`}
    >
      {tono === 'exito'
        ? <CheckCircle size={14} className="mt-px shrink-0" />
        : <AlertCircle size={14} className="mt-px shrink-0" />}
      <span className="min-w-0 flex-1">{mensaje}</span>
      {onCerrar && (
        <button onClick={onCerrar} aria-label="Cerrar aviso" className="shrink-0 opacity-60 transition hover:opacity-100">
          <X size={13} />
        </button>
      )}
    </div>
  )
}
