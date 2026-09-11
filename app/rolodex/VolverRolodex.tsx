'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'

// El expediente se abre desde la ficha de un evento; Volver regresa a esa
// misma ficha. Solo se aceptan rutas internas: un `desde` con dominio ajeno
// se ignora y se cae al dashboard (cuando exista /rolodex, al directorio).
export function destinoDeVuelta(search: string): string {
  const desde = new URLSearchParams(search).get('desde')
  if (desde && desde.startsWith('/') && !desde.startsWith('//')) return desde
  return '/dashboard'
}

export default function VolverRolodex() {
  const [href, setHref] = useState('/dashboard')

  useEffect(() => {
    setHref(destinoDeVuelta(window.location.search))
  }, [])

  return (
    <a href={href} className="flex items-center gap-1.5 text-xs text-[#888] transition hover:text-[#48C9B0]">
      <ArrowLeft size={14} />
      Volver
    </a>
  )
}
