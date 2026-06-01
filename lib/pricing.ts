// Config central de precios y limites. Fuente unica de verdad para /precios
// y (en fases siguientes) para la capa de entitlements y el checkout de Stripe.
// Si cambias un precio o un limite, cambialo aqui y se propaga a toda la UI.

export type AnfitrionTier = 'free' | 'esencial' | 'pro' | 'gran'
export type OrganizadorTier = 'solo' | 'studio' | 'agency'

export const ANNUAL_DISCOUNT = 0.2 // -20% en pago anual
export const FOUNDER_DISCOUNT = 0.4 // -40% primer ano (programa fundador)
export const FOUNDER_MAX = 25 // cupos del programa fundador

export const WHATSAPP_ADDON = { price: 1490, messages: 5000 }

export interface AnfitrionPlan {
  id: AnfitrionTier
  name: string
  tagline: string
  price: number // MXN, pago unico
  guestLimit: number
  collaborators: number // personas con acceso al evento (incluye al anfitrion)
  cta: string
  ctaStyle: 'solid' | 'outline'
  support: string
  bullets: string[]
}

export interface OrganizadorPlan {
  id: OrganizadorTier
  name: string
  tagline: string
  listMonthly: number // precio de lista mensual MXN
  activeEvents: number
  seats: number
  whiteLabel: boolean
  support: string
  bullets: string[]
}

export const ANFITRION_PLANS: AnfitrionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Para empezar a organizar',
    price: 0,
    guestLimit: 50,
    collaborators: 1,
    cta: 'Empezar gratis',
    ctaStyle: 'outline',
    support: 'Centro de ayuda',
    bullets: [
      'Invitados, acompañantes y RSVP',
      'Mesas, timeline y presupuesto',
      'Proveedores y pagos',
      'Álbum (tu link) y playlist',
    ],
  },
  {
    id: 'esencial',
    name: 'Esencial',
    tagline: 'Eventos pequeños y medianos',
    price: 1490,
    guestLimit: 150,
    collaborators: 3,
    cta: 'Elegir Esencial',
    ctaStyle: 'solid',
    support: 'Correo',
    bullets: [
      '150 invitados',
      'Equipo de hasta 3 personas',
      'Exportar a Excel y PDF',
      'Agente IA WhatsApp disponible',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'La opción más completa',
    price: 2990,
    guestLimit: 300,
    collaborators: 4,
    cta: 'Elegir Pro',
    ctaStyle: 'solid',
    support: 'Correo + WhatsApp',
    bullets: [
      '300 invitados',
      'Equipo de hasta 4 personas',
      'Soporte por WhatsApp + mini demo',
    ],
  },
  {
    id: 'gran',
    name: 'Gran Anfitrión',
    tagline: 'Bodas y eventos grandes',
    price: 3990,
    guestLimit: 500,
    collaborators: 5,
    cta: 'Elegir Gran',
    ctaStyle: 'solid',
    support: 'WhatsApp prioritario',
    bullets: [
      '500 invitados',
      'Equipo de hasta 5 personas',
      'Onboarding asistido + WhatsApp prioritario',
    ],
  },
]

export const ORGANIZADOR_PLANS: OrganizadorPlan[] = [
  {
    id: 'solo',
    name: 'Solo',
    tagline: 'Planner independiente',
    listMonthly: 1190,
    activeEvents: 10,
    seats: 1,
    whiteLabel: false,
    support: 'Correo',
    bullets: [
      '10 eventos activos',
      '1 usuario',
      'Invitados ilimitados por evento',
      'Todas las herramientas + export',
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    tagline: 'Equipos pequeños',
    listMonthly: 1990,
    activeEvents: 25,
    seats: 3,
    whiteLabel: false,
    support: 'Prioritario',
    bullets: [
      '25 eventos activos',
      '3 usuarios incluidos',
      'Asientos extra a $200/mes c/u',
      'Soporte prioritario',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    tagline: 'Agencias con marca propia',
    listMonthly: 4990,
    activeEvents: 60,
    seats: 10,
    whiteLabel: true,
    support: 'Gerente de cuenta',
    bullets: [
      '60 eventos activos',
      '10 usuarios incluidos',
      'White-label 100% (tu marca)',
      'Gerente de cuenta',
    ],
  },
]

export const SEAT_ADDON_MONTHLY = 200

export function founderMonthly(listMonthly: number): number {
  return Math.round(listMonthly * (1 - FOUNDER_DISCOUNT))
}

export function annualMonthly(listMonthly: number): number {
  return Math.round(listMonthly * (1 - ANNUAL_DISCOUNT))
}

export function formatMXN(n: number): string {
  return '$' + n.toLocaleString('es-MX')
}
