import type { Metadata } from 'next'
import LegalShell from '@/app/components/legal/LegalShell'
import { documentoLegal } from '@/lib/legal-textos'

export const metadata: Metadata = {
  title: 'Aviso de Privacidad | Anfiora',
  description: 'Que datos guarda Anfiora, para que los usa, con quien los comparte y como pedir que los borremos.',
  alternates: { canonical: '/privacidad' },
}

export default function PrivacidadPage() {
  return <LegalShell doc={documentoLegal('privacidad')} />
}
