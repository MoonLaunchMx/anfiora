import type { Metadata } from 'next'
import LegalShell from '@/app/components/legal/LegalShell'
import { documentoLegal } from '@/lib/legal-textos'

export const metadata: Metadata = {
  title: 'Eliminar mis datos | Anfiora',
  description: 'Con un correo borramos lo que Anfiora tenga de usted, tenga cuenta o no.',
  alternates: { canonical: '/eliminar-datos' },
}

export default function EliminarDatosPage() {
  return <LegalShell doc={documentoLegal('eliminar')} />
}
