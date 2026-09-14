import Link from 'next/link'
import { LEGAL_EMAIL } from '@/lib/legal'

type Props = {
  tono?: 'claro' | 'oscuro'
  idioma?: 'es' | 'en'
  contacto?: boolean
  // En las paginas publicas con formulario se abre aparte para no perder lo capturado.
  nuevaPestana?: boolean
  className?: string
}

const TEXTOS = {
  es: { privacidad: 'Aviso de Privacidad', terminos: 'Términos', eliminar: 'Eliminar mis datos', contacto: 'Contacto' },
  en: { privacidad: 'Privacy', terminos: 'Terms', eliminar: 'Delete my data', contacto: 'Contact' },
}

export default function LegalLinks({ tono = 'claro', idioma = 'es', contacto = false, nuevaPestana = false, className = '' }: Props) {
  const t = TEXTOS[idioma]
  const color = tono === 'oscuro' ? 'text-white/40 hover:text-white/80' : 'text-[#999] hover:text-[#1D1E20]'
  const enlace = `whitespace-nowrap no-underline transition-colors ${color}`
  const destino = nuevaPestana ? { target: '_blank', rel: 'noopener noreferrer' } : {}

  return (
    <nav aria-label="Legal" className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] ${className}`}>
      <Link href="/privacidad" className={enlace} {...destino}>{t.privacidad}</Link>
      <Link href="/terminos" className={enlace} {...destino}>{t.terminos}</Link>
      <Link href="/eliminar-datos" className={enlace} {...destino}>{t.eliminar}</Link>
      {contacto && <a href={`mailto:${LEGAL_EMAIL}`} className={enlace}>{t.contacto}</a>}
    </nav>
  )
}
