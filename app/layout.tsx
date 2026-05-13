import type { Metadata } from 'next'
// @ts-ignore
import './globals.css'
import { PostHogProvider } from './components/PostHogProvider'
import FeedbackWidget from "@/app/components/FeedbackWidget";

export const metadata: Metadata = {
  title: 'Anfiora — Gestión de invitados para eventos',
  description: 'La plataforma para wedding planners y organizadores de eventos en LATAM. Gestiona listas de invitados y automatiza confirmaciones por WhatsApp.',
  metadataBase: new URL('https://www.anfiora.com'),
  openGraph: {
    title: 'Anfiora — Gestión de invitados para eventos',
    description: 'La plataforma para wedding planners y organizadores de eventos en LATAM. Gestiona listas de invitados y automatiza confirmaciones por WhatsApp.',
    url: 'https://www.anfiora.com',
    siteName: 'Anfiora',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Anfiora — Gestión de invitados para eventos',
      },
    ],
    locale: 'es_MX',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anfiora — Gestión de invitados para eventos',
    description: 'La plataforma para wedding planners y organizadores de eventos en LATAM. Gestiona listas de invitados y automatiza confirmaciones por WhatsApp.',
    images: ['/images/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <PostHogProvider>{children}</PostHogProvider>
        <FeedbackWidget />
      </body>
    </html>
  )
}
