'use client'

import { Mail } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import type { ContactoPlanner as Contacto } from '@/lib/invite/post-confirmacion'

type Props = {
  contacto: Contacto | null
  eventName: string
  // Solo llega con valor cuando el invitado califica: el servidor lo omite si
  // nadie de su grupo va, para que ni siquiera viaje en la respuesta.
  grupoUrl?: string | null
}

// La salida del invitado cuando ya no hay nada que llenar: donde sigue la
// conversacion y a quien le escribe si algo cambia. El contacto sale de "Datos
// del planner" (events.planner_*), no del celular con el que el planner abrio su
// cuenta. Si no configuro nada, esto no se pinta.
export default function ContactoPlanner({ contacto, eventName, grupoUrl }: Props) {
  if (!contacto && !grupoUrl) return null

  const nombre = contacto?.nombre ?? null
  const mensaje = `¡Hola! Te escribo por "${eventName}".`
  const waHref = contacto?.telefono
    ? `https://wa.me/${contacto.telefono}?text=${encodeURIComponent(mensaje)}`
    : null
  const mailHref = contacto?.email
    ? `mailto:${contacto.email}?subject=${encodeURIComponent(eventName)}`
    : null

  return (
    <div className="mt-5 border-t border-[#e8e8e8] pt-4 text-center">
      {/* El grupo es la accion principal: es a donde queremos mover la
          conversacion. El contacto del planner queda como salida secundaria. */}
      {grupoUrl && (
        <a
          href={grupoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95"
        >
          <FaWhatsapp size={16} /> Grupo de WhatsApp
        </a>
      )}

      {(waHref || mailHref) && (
        <>
          <p className={`text-xs text-[#888] ${grupoUrl ? 'mt-4' : ''}`}>
            {nombre
              ? <>¿Algo cambió? Escríbele a <span className="font-medium text-[#666]">{nombre}</span></>
              : '¿Algo cambió? Avísale al anfitrión'}
          </p>
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg border border-[#e0e0e0] px-4 py-2.5 text-xs font-semibold text-[#666] transition hover:border-[#25D366] hover:text-[#1a9e56]"
              >
                <FaWhatsapp size={14} /> WhatsApp
              </a>
            )}
            {mailHref && (
              <a
                href={mailHref}
                className="flex items-center justify-center gap-2 rounded-lg border border-[#e0e0e0] px-4 py-2.5 text-xs font-semibold text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
              >
                <Mail size={14} /> Correo
              </a>
            )}
          </div>
        </>
      )}
    </div>
  )
}
