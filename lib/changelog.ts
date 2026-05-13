export const CURRENT_VERSION = '2026-05-13'

export type Release = {
  version: string
  date: string
  title: string
  subtitle: string
  features: { icon: string; text: string }[]
  cta: { label: string; href: string }
  gif?: string
}

export const changelog: Release[] = [
  {
    version: '2026-05-13',
    date: '13 de mayo, 2026',
    title: 'Timeline rediseñado',
    subtitle: 'Asigna tareas, vincula proveedores y marca bloqueantes.',
    features: [
      { icon: 'LayoutList',   text: 'Nuevo diseño de tarjetas — más limpio, más rápido de leer' },
      { icon: 'User',         text: 'Asigna tareas a colaboradores o escribe un nombre libre' },
      { icon: 'Building2',    text: 'Vincula tareas directamente a un proveedor del evento' },
      { icon: 'AlertTriangle',text: 'Marca tareas como bloqueantes para priorizarlas de un vistazo' },
      { icon: 'Bell',         text: 'Recordatorios estilo Google Calendar — 15 min, 1 hora, 1 día antes...' },
    ],
    cta: { label: 'Ver el timeline', href: '/events' },
    gif: '/images/whats-new/timeline-placeholder.png',
  },
]