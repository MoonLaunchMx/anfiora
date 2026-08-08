import type { ElementType } from 'react'
import { Activity, Gift, LayoutGrid, ListTodo, Music, Shirt, Users, Zap } from 'lucide-react'
import type { CajaId } from '@/lib/dashboard/tablero'

// Una sola fuente del icono por caja. Lo usan el encabezado de la caja y el
// modal de agregar informacion: el planner reconoce la misma pieza en los dos
// lugares porque no hay dos listas que puedan separarse.
export const ICONO_CAJA: Record<CajaId, ElementType> = {
  atencion: Zap,
  pendientes: ListTodo,
  mesas: LayoutGrid,
  regalos: Gift,
  playlist: Music,
  vestimenta: Shirt,
  actividad: Activity,
  equipo: Users,
}
