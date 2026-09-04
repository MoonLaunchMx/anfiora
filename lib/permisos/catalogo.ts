import type React from 'react'
import type { FeatureKey } from '@/lib/features'
import {
  Users, MailOpen, MessageCircle, LayoutGrid, Clock,
  Gift, Images, Music2, Shirt, PieChart, Store, CreditCard,
} from 'lucide-react'

export const MODULOS = [
  'invitados', 'invitacion', 'mensajes', 'mesas', 'timeline',
  'regalos', 'album', 'playlist', 'vestimenta',
  'presupuesto', 'proveedores', 'pagos',
] as const

export type Modulo = typeof MODULOS[number]

export const NIVELES = ['ninguno', 'ver', 'editar', 'total'] as const
export type Nivel = typeof NIVELES[number]

export type Accion = 'ver' | 'editar' | 'borrar'

export type PermisosEvento = Partial<Record<Modulo, Nivel>>

export type GrupoModulo = 'boda' | 'herramientas' | 'finanzas'

export interface ModuloConfig {
  key: Modulo
  label: string
  grupo: GrupoModulo
  // null = no se prende ni apaga por boda; siempre forma parte del evento
  feature: FeatureKey | null
  // sufijos bajo /events/[id]; '' es la raiz (lista de invitados)
  rutas: string[]
  icon: React.ElementType
  descripcion: string
}

export const MODULOS_CONFIG: ModuloConfig[] = [
  { key: 'invitados',   label: 'Invitados',        grupo: 'boda',         feature: null,         rutas: [''],
    icon: Users,        descripcion: 'Lista, acompañantes y confirmaciones' },
  { key: 'invitacion',  label: 'Invitación',       grupo: 'herramientas', feature: 'invitacion', rutas: ['/invitacion'],
    icon: MailOpen,     descripcion: 'La invitación digital y su contenido' },
  { key: 'mensajes',    label: 'Mensajes',         grupo: 'boda',         feature: null,         rutas: ['/mensajes'],
    icon: MessageCircle, descripcion: 'Conversaciones de WhatsApp con los invitados' },
  { key: 'mesas',       label: 'Mesas y check-in', grupo: 'herramientas', feature: 'mesas',      rutas: ['/mesas'],
    icon: LayoutGrid,   descripcion: 'Acomodo de mesas y registro de llegadas' },
  { key: 'timeline',    label: 'Timeline',         grupo: 'boda',         feature: null,         rutas: ['/timeline'],
    icon: Clock,        descripcion: 'Tareas, recordatorios e itinerario del día' },
  { key: 'regalos',     label: 'Mesa de regalos',  grupo: 'herramientas', feature: 'regalos',    rutas: ['/mesa-regalos'],
    icon: Gift,         descripcion: 'Regalos, fondos y sobres' },
  { key: 'album',       label: 'Álbum de fotos',   grupo: 'herramientas', feature: 'album',      rutas: ['/album'],
    icon: Images,       descripcion: 'Las fotos que suben los invitados' },
  { key: 'playlist',    label: 'Playlist',         grupo: 'herramientas', feature: 'playlist',   rutas: ['/playlist'],
    icon: Music2,       descripcion: 'Canciones sugeridas y su orden' },
  { key: 'vestimenta',  label: 'Dress code',       grupo: 'herramientas', feature: 'vestimenta', rutas: ['/vestimenta'],
    icon: Shirt,        descripcion: 'Qué ponerse: nivel, colores y ejemplos' },
  { key: 'presupuesto', label: 'Presupuesto',      grupo: 'finanzas',     feature: null,         rutas: ['/presupuesto'],
    icon: PieChart,     descripcion: 'Partidas, montos y avance del gasto' },
  { key: 'proveedores', label: 'Proveedores',      grupo: 'finanzas',     feature: null,         rutas: ['/proveedores'],
    icon: Store,        descripcion: 'Fichas, cotizaciones y contratos' },
  { key: 'pagos',       label: 'Pagos',            grupo: 'finanzas',     feature: null,         rutas: ['/pagos'],
    icon: CreditCard,   descripcion: 'Historial de pagos y saldos' },
]

const RE_EVENTO = /^\/events\/[^/]+(\/.*)?$/

// De una ruta del navegador al modulo que la gobierna. La ruta mas larga gana,
// para que '/mesa-regalos' no se lo coma un modulo con sufijo mas corto.
export function moduloDeRuta(pathname: string): Modulo | null {
  const m = pathname.match(RE_EVENTO)
  if (!m) return null

  const resto = (m[1] ?? '').replace(/\/+$/, '')
  let ganador: ModuloConfig | null = null

  for (const mod of MODULOS_CONFIG) {
    for (const ruta of mod.rutas) {
      const calza = ruta === '' ? resto === '' : (resto === ruta || resto.startsWith(ruta + '/'))
      if (calza && (ganador === null || ruta.length > Math.max(...ganador.rutas.map(r => r.length)))) {
        ganador = mod
      }
    }
  }

  return ganador?.key ?? null
}
