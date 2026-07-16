'use client'
import type { ReactNode } from 'react'

type Variant = 'hero' | 'band' | 'card' | 'form'

const INNER: Record<Variant, string> = {
  hero: 'max-w-2xl lg:max-w-3xl',
  band: 'max-w-xl lg:max-w-2xl',
  card: 'max-w-xl lg:max-w-2xl',
  form: 'max-w-lg',
}

const PAD: Record<Variant, string> = {
  hero: 'px-6 pt-8 lg:pt-10 pb-3 lg:pb-4',
  band: 'px-6 py-3.5 lg:py-4',
  // Tarjeta de accion (mesa, playlist): padding minimo para que dos seguidas
  // queden tan juntas como las tarjetas internas de la seccion de detalles.
  card: 'px-6 py-1.5',
  form: 'px-6 py-6 lg:py-8',
}

export default function SectionShell({
  variant,
  className = '',
  innerClassName = '',
  children,
}: {
  variant: Variant
  className?: string
  innerClassName?: string
  children: ReactNode
}) {
  return (
    <section className={`w-full ${PAD[variant]} ${className}`}>
      <div className={`mx-auto w-full ${INNER[variant]} ${innerClassName}`}>{children}</div>
    </section>
  )
}
