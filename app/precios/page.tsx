import PreciosClient from './PreciosClient'

export const metadata = {
  title: 'Precios — Anfiora',
  description:
    'Paga una vez por tu evento o suscríbete si organizas para otros. Invitados, mesas, presupuesto, proveedores y recuerdos en un solo lugar.',
  alternates: {
    canonical: 'https://anfiora.com/precios',
  },
  openGraph: {
    title: 'Precios — Anfiora',
    description:
      'Paga una vez por tu evento o suscríbete si organizas para otros. Todo tu evento en un solo lugar.',
    url: 'https://anfiora.com/precios',
    siteName: 'Anfiora',
    locale: 'es_MX',
    type: 'website',
  },
}

export default async function PreciosPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>
}) {
  const { vista } = await searchParams
  const initialVista = vista === 'organizador' ? 'organizador' : 'anfitrion'
  return <PreciosClient initialVista={initialVista} />
}
