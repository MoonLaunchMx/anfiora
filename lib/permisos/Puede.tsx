'use client'

import type { ReactNode } from 'react'
import { usePermiso } from '@/lib/event-access-context'
import type { Modulo, Accion } from './catalogo'

interface PuedeProps {
  modulo: Modulo
  accion: Accion
  children: ReactNode
  // Que dibujar cuando no puede. Por omision, nada: la regla es que un control
  // que no se puede usar no se dibuja, ni siquiera deshabilitado.
  siNo?: ReactNode
}

export function Puede({ modulo, accion, children, siNo = null }: PuedeProps) {
  const permiso = usePermiso(modulo)
  const autorizado =
    accion === 'ver'    ? permiso.ver :
    accion === 'editar' ? permiso.editar :
                          permiso.borrar

  return <>{autorizado ? children : siNo}</>
}
