import type { Metadata } from 'next'
import Script from 'next/script'
// @ts-ignore
import './globals.css'
import { PostHogProvider } from './components/PostHogProvider'
import FeedbackWidget from "@/app/components/FeedbackWidget";
import LegalGate from './components/LegalGate'
import AttributionCapture from './components/AttributionCapture'
import InstallPrompt from './components/InstallPrompt'

export const metadata: Metadata = {
  title: 'Anfiora — Gestión de invitados para eventos',
  description: 'La plataforma para wedding planners y organizadores de eventos en LATAM. Gestiona listas de invitados y automatiza confirmaciones por WhatsApp.',
  metadataBase: new URL('https://anfiora.com'),
  alternates: {
    canonical: 'https://anfiora.com',
  },
  verification: {
    other: {
      'facebook-domain-verification': 'xjstzkeuvm63s52vzl0g0923w5xdh4',
    },
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Anfiora',
    statusBarStyle: 'default',
  },
  openGraph: {
    title: 'Anfiora — Gestión de invitados para eventos',
    description: 'La plataforma para wedding planners y organizadores de eventos en LATAM. Gestiona listas de invitados y automatiza confirmaciones por WhatsApp.',
    url: 'https://anfiora.com',
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
        <AttributionCapture />
        <FeedbackWidget />
        <LegalGate />
        <InstallPrompt />
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
          }
        `}</Script>
      </body>
    </html>
  )
}