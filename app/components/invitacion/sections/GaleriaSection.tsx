'use client'
import type { Section } from '@/lib/invite/schema'
import type { CarruselEstilo } from '@/lib/invite/theme'
import type { InviteCtx } from '../types'
import SectionShell from '../SectionShell'
import CarruselViewer from '../CarruselViewer'

type Content = Extract<Section, { type: 'galeria' }>['content']

export default function GaleriaSection({
  content,
  ctx,
  estilo,
}: {
  content: Content
  ctx: InviteCtx
  estilo: CarruselEstilo
}) {
  const fotos = content.fotos.filter(f => f.trim())
  if (fotos.length === 0) return null

  return (
    <SectionShell variant="band">
      {content.titulo.trim() && (
        <h2
          className="mb-4 text-center text-xl font-semibold lg:text-2xl"
          style={{ color: 'var(--inv-texto-titulo)', fontFamily: 'var(--inv-font-titulo)' }}
        >
          {content.titulo}
        </h2>
      )}
      <CarruselViewer fotos={fotos} estilo={estilo} forceMobile={!!ctx.forceMobile} />
    </SectionShell>
  )
}
