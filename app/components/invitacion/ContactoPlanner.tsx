'use client'

import { Mail } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import type { ContactoPlanner as Contacto } from '@/lib/invite/post-confirmacion'

type Props = {
  contacto: Contacto | null
  eventName: string
}

// La salida del invitado cuando ya no hay nada que llenar: a quien le escribe si
// algo cambia. El contacto sale de "Datos del planner" (events.planner_*), no del
// celular con el que el planner abrio su cuenta. Si no configuro ninguno de los
// dos medios, resolverContacto devuelve null y esto no se pinta.
export default function ContactoPlanner({ contacto, eventName }: Props) {
  if (!contacto) return null

  const { nombre, telefono, email } = contacto
  const mensaje = `¡Hola! Te escribo por "${eventName}".`
  const waHref = telefono ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}` : null
  const mailHref = email ? `mailto:${email}?subject=${encodeURIComponent(eventName)}` : null

  return (
    <div className="mt-5 border-t border-[#e8e8e8] pt-4 text-center">
      <p className="text-xs text-[#888]">
        {nombre ? <>¿Algo cambió? Escríbele a <span className="font-medium text-[#666]">{nombre}</span></> : '¿Algo cambió? Avísale al anfitrión'}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-xs font-semibold text-white transition hover:brightness-95"
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
    </div>
  )
}
