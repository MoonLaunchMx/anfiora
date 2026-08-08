import type { ElementType } from 'react'
import { CalendarPlus, CreditCard, UserPlus } from 'lucide-react'

export type Atajo = { label: string; detalle: string; href: string; Icono: ElementType }

// Lo que el planner hace todos los dias de todos modos. Vive aqui y no dentro
// de la caja porque el hero ofrece los mismos tres: una sola lista, dos puertas.
export function atajos(eventId: string, puedeVerDinero: boolean): Atajo[] {
  const base: Atajo[] = [
    { label: 'Agregar invitado', detalle: 'A la lista del evento', href: `/events/${eventId}`, Icono: UserPlus },
    { label: 'Nueva tarea', detalle: 'Al timeline', href: `/events/${eventId}/timeline`, Icono: CalendarPlus },
  ]
  if (puedeVerDinero) {
    base.push({ label: 'Registrar pago', detalle: 'A un proveedor', href: `/events/${eventId}/pagos`, Icono: CreditCard })
  }
  return base
}
