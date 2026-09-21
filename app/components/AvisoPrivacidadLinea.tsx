import Link from 'next/link'

export default function AvisoPrivacidadLinea({ accion, className = '' }: { accion: string; className?: string }) {
  return (
    <p className={`text-center text-[11px] leading-snug text-[#999] ${className}`}>
      Al {accion} aceptas el{' '}
      <Link href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-medium text-[#48C9B0] underline-offset-2 hover:underline">
        Aviso de Privacidad
      </Link>
      .
    </p>
  )
}
