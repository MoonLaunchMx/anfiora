import type { Metadata } from 'next'
import LegalShell from '@/app/components/legal/LegalShell'
import { documentoLegal } from '@/lib/legal-textos'

export const metadata: Metadata = {
  title: 'Terminos y Condiciones | Anfiora',
  description: 'Las reglas para usar Anfiora: que le toca a usted y que nos toca a nosotros.',
  alternates: { canonical: '/terminos' },
}

export default function TerminosPage() {
  return <LegalShell doc={documentoLegal('terminos')} />
}
