'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'saludo' }>['content']

export default function SaludoSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const nombre = ctx.guest?.name?.trim() || ''
  const titulo = content.titulo.trim()

  // En la puerta publica no hay nombre que saludar ni lugar reservado: el chip
  // diria una mentira antes de que la persona se registre.
  const saludo = nombre ? (titulo ? `${titulo}, ${nombre}` : nombre) : titulo
  const n = ctx.companions.length
  const chip = !nombre
    ? null
    : n > 0
    ? `Reservamos lugar para ti + ${n} acompañante${n === 1 ? '' : 's'}`
    : 'Reservamos lugar para ti'

  return (
    <SectionShell variant="band" className="text-center">
      {saludo && (
        <h2 className="px-2 text-2xl font-semibold lg:text-3xl" style={{ color: 'var(--inv-texto-titulo)', fontFamily: 'var(--inv-font-titulo)' }}>
          {saludo}
        </h2>
      )}
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed opacity-70 lg:text-base" style={{ color: 'var(--inv-texto)' }}>{content.mensaje}</p>
      {chip && (
        <span
          className="mt-6 inline-block rounded-full border px-4 py-2 text-xs font-medium"
          style={{ background: 'var(--inv-acento-bg)', borderColor: 'var(--inv-acento-borde)', color: 'var(--inv-acento)' }}
        >
          {chip}
        </span>
      )}
    </SectionShell>
  )
}
