import type { FeatureKey } from '@/lib/features'

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
}

export const MODULOS_CONFIG: ModuloConfig[] = [
  { key: 'invitados',   label: 'Invitados',        grupo: 'boda',         feature: null,         rutas: [''] },
  { key: 'invitacion',  label: 'Invitación',       grupo: 'herramientas', feature: 'invitacion', rutas: ['/invitacion'] },
  { key: 'mensajes',    label: 'Mensajes',         grupo: 'boda',         feature: null,         rutas: ['/mensajes'] },
  { key: 'mesas',       label: 'Mesas y check-in', grupo: 'herramientas', feature: 'mesas',      rutas: ['/mesas'] },
  { key: 'timeline',    label: 'Timeline',         grupo: 'boda',         feature: null,         rutas: ['/timeline'] },
  { key: 'regalos',     label: 'Mesa de regalos',  grupo: 'herramientas', feature: 'regalos',    rutas: ['/mesa-regalos'] },
  { key: 'album',       label: 'Álbum de fotos',   grupo: 'herramientas', feature: 'album',      rutas: ['/album'] },
  { key: 'playlist',    label: 'Playlist',         grupo: 'herramientas', feature: 'playlist',   rutas: ['/playlist'] },
  { key: 'vestimenta',  label: 'Dress code',       grupo: 'herramientas', feature: 'vestimenta', rutas: ['/vestimenta'] },
  { key: 'presupuesto', label: 'Presupuesto',      grupo: 'finanzas',     feature: null,         rutas: ['/presupuesto'] },
  { key: 'proveedores', label: 'Proveedores',      grupo: 'finanzas',     feature: null,         rutas: ['/proveedores'] },
  { key: 'pagos',       label: 'Pagos',            grupo: 'finanzas',     feature: null,         rutas: ['/pagos'] },
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
