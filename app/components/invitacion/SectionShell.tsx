'use client'
import type { ReactNode } from 'react'

type Variant = 'hero' | 'band' | 'form'

const INNER: Record<Variant, string> = {
  hero: 'max-w-2xl lg:max-w-3xl',
  band: 'max-w-xl lg:max-w-2xl',
  form: 'max-w-lg',
}

const PAD: Record<Variant, string> = {
  hero: 'px-6 py-12 lg:py-16',
  band: 'px-6 py-8 lg:py-10',
  form: 'px-6 py-8 lg:py-10',
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
    <section
      className={`w-full ${PAD[variant]} ${className}`}
      style={{ background: 'var(--inv-fondo)', color: 'var(--inv-texto)' }}
    >
      <div className={`mx-auto w-full ${INNER[variant]} ${innerClassName}`}>{children}</div>
    </section>
  )
}
