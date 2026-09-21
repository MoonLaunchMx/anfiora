import type { Metadata } from 'next'
import { FAQ } from '@/lib/faq'
import PreguntasClient from './PreguntasClient'

export const metadata: Metadata = {
  title: 'Preguntas frecuentes — Anfiora',
  description:
    'Cómo funciona Anfiora para ti y para tus invitados: confirmaciones sin apps, lista de invitados desde Excel, mesas, presupuesto, proveedores, playlist y mesa de regalos.',
  alternates: { canonical: '/preguntas' },
  openGraph: {
    title: 'Preguntas frecuentes — Anfiora',
    description: 'Cómo funciona Anfiora para ti y para tus invitados.',
    url: '/preguntas',
    type: 'website',
  },
}

// Google lee el JSON-LD del HTML servido, y ese HTML siempre sale en espanol
// porque el idioma es estado del cliente. Por eso se arma solo con FAQ.es.
const faqJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.es.items.map(item => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
})

export default function PreguntasPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      <PreguntasClient />
    </>
  )
}
