export const CURRENT_VERSION = '2026-06-15'

export type Release = {
  version: string
  date: string
  title: string
  subtitle: string
  features: { icon: string; text: string }[]
  gif?: string
}

export const changelog: Release[] = [
  {
    version: '2026-06-15',
    date: '15 de junio, 2026',
    title: 'Playlist renovada',
    subtitle: 'Una sola lista, las canciones de los novios destacadas y exportación para el DJ.',
    features: [
      { icon: 'Music2',            text: 'Una sola lista con las canciones de los novios destacadas y las de tus invitados' },
      { icon: 'Heart',             text: 'Marca las canciones especiales de los novios para que el DJ las identifique al instante' },
      { icon: 'SlidersHorizontal', text: 'Define cuántas canciones puede pedir cada invitado: 1, 3, 5, 10 o sin límite' },
      { icon: 'Download',          text: 'Exporta la lista para el DJ en Excel, PDF o M3U, en el orden que tú definas' },
      { icon: 'Link2',             text: 'Comparte el link público y tus invitados agregan canciones desde su celular, sin cuenta' },
    ],
  },
  {
    version: '2026-06-12',
    date: '12 de junio, 2026',
    title: 'Herramientas a tu medida',
    subtitle: 'Cada evento con solo las herramientas que necesita.',
    features: [
      { icon: 'SlidersHorizontal', text: 'Nuevo paso al crear tu evento: activa o desactiva mesas, regalos, álbum, playlist y comida' },
      { icon: 'Sparkles',          text: 'Defaults inteligentes según el tipo — una boda no necesita lo mismo que una conferencia' },
      { icon: 'Settings2',         text: 'Cámbialo cuando quieras desde Configuración, sin perder ningún dato' },
      { icon: 'UtensilsCrossed',   text: 'El planificador de comida regresa al menú cuando lo activas' },
    ],
  },
  {
    version: '2026-06-11',
    date: '11 de junio, 2026',
    title: 'Mesa de regalos',
    subtitle: 'Crea tu mesa, compártela con un link y recibe regalos a tu manera.',
    features: [
      { icon: 'Gift',     text: 'Agrega regalos de tienda (pega el link y detectamos todo), fondos con meta y sobres' },
      { icon: 'Link2',    text: 'Compártela con un link público — tus invitados apartan y aportan sin crear cuenta' },
      { icon: 'Coins',    text: 'Aportes parciales: varios invitados pueden cooperar para un regalo grande' },
      { icon: 'Landmark', text: 'Configura tu CLABE, tarjeta, Mercado Pago, PayPal o Zelle para recibir depósitos' },
      { icon: 'Heart',    text: 'Lleva el control de lo recibido y agradece a cada invitado por WhatsApp con un clic' },
    ],
  },
  {
    version: '2026-05-13',
    date: '13 de mayo, 2026',
    title: 'Timeline rediseñado',
    subtitle: 'Asigna tareas, vincula proveedores y marca bloqueantes.',
    features: [
      { icon: 'LayoutList',    text: 'Nuevo diseño de tarjetas — más limpio, más rápido de leer' },
      { icon: 'User',          text: 'Asigna tareas a colaboradores o escribe un nombre libre' },
      { icon: 'Building2',     text: 'Vincula tareas directamente a un proveedor del evento' },
      { icon: 'AlertTriangle', text: 'Marca tareas como bloqueantes para priorizarlas de un vistazo' },
      { icon: 'Bell',          text: 'Recordatorios estilo Google Calendar — 15 min, 1 hora, 1 día antes...' },
    ],
  },
]