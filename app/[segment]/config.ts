export type SegmentConfig = {
  badge: string
  title1: string
  title2: string
  sub: string
  metaTitle: string
  metaDescription: string
}

export const SEGMENTS: Record<string, SegmentConfig> = {
  bodas: {
    badge: 'Para wedding planners y novios en México y LATAM',
    title1: 'Gestiona tu boda',
    title2: 'sin el caos',
    sub: 'Lista de invitados, confirmaciones por WhatsApp, mesas, presupuesto y playlist — todo en un solo lugar.',
    metaTitle: 'Anfiora — Software para bodas en México',
    metaDescription: 'Gestiona tu boda sin Excel ni WhatsApp caótico. Lista de invitados, mesas, presupuesto y playlist colaborativa para wedding planners y novios en México.',
  },
  'eventos-corporativos': {
    badge: 'Para coordinadores de eventos corporativos',
    title1: 'Gestiona tu evento corporativo',
    title2: 'sin el caos',
    sub: 'Lista de asistentes, confirmaciones por WhatsApp, mesas y presupuesto — todo en un solo lugar.',
    metaTitle: 'Anfiora — Software para eventos corporativos en México',
    metaDescription: 'Gestiona tus eventos corporativos sin Excel. Lista de asistentes, mesas y presupuesto para coordinadores de eventos en México.',
  },
}