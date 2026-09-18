'use client'
import { useState } from 'react'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { ArrowUpRight } from 'lucide-react'
import SectionShell from '../SectionShell'
import { tituloDeRespaldo, type RecoLink } from '@/lib/invite/recomendaciones'

type Content = Extract<Section, { type: 'recomendaciones' }>['content']

function Miniatura({ link }: { link: RecoLink }) {
  const [falla, setFalla] = useState(false)
  const inicial = (link.sitio || link.titulo || '?').charAt(0).toUpperCase()

  if (!link.imagen || falla) {
    return (
      <span
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-base font-semibold"
        style={{ background: 'var(--inv-acento-bg)', color: 'var(--inv-acento)' }}
      >
        {inicial}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={link.imagen}
      alt=""
      loading="lazy"
      onError={() => setFalla(true)}
      className="h-14 w-14 shrink-0 rounded-lg object-cover"
    />
  )
}

function LinkRow({ link }: { link: RecoLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border p-2.5 transition hover:opacity-90"
      style={{ borderColor: 'var(--inv-acento-borde)', background: 'var(--inv-tarjeta)', color: 'var(--inv-tarjeta-texto)' }}
    >
      <Miniatura link={link} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug" style={{ color: 'var(--inv-texto-titulo)' }}>
          {link.titulo.trim() || tituloDeRespaldo(link.url)}
        </span>
        {link.sitio && <span className="mt-0.5 block text-xs opacity-60">{link.sitio}</span>}
        {link.nota.trim() && (
          <span className="mt-1 block text-xs" style={{ color: 'var(--inv-acento)' }}>{link.nota}</span>
        )}
      </span>
      <ArrowUpRight size={16} className="shrink-0 opacity-40" />
    </a>
  )
}

export default function RecomendacionesSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  if (content.links.length === 0) {
    if (ctx.mode !== 'preview') return null
    return (
      <SectionShell variant="band" className="text-center">
        <p
          className="rounded-xl border border-dashed border-[#e0e0e0] px-4 py-6 text-xs"
          style={{ background: 'var(--inv-tarjeta)', color: 'var(--inv-tarjeta-texto)', opacity: 0.6 }}
        >
          Se mostrará cuando agregues links
        </p>
      </SectionShell>
    )
  }

  return (
    <SectionShell variant="band">
      {content.titulo.trim() && (
        <h2
          className="px-2 text-center text-xl font-semibold lg:text-2xl"
          style={{ color: 'var(--inv-texto-titulo)', fontFamily: 'var(--inv-font-titulo)' }}
        >
          {content.titulo}
        </h2>
      )}
      {content.descripcion.trim() && (
        <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed opacity-70" style={{ color: 'var(--inv-texto)' }}>
          {content.descripcion}
        </p>
      )}

      <div className="mx-auto mt-6 flex max-w-md flex-col gap-2">
        {content.links.map((link, i) => <LinkRow key={`${link.url}-${i}`} link={link} />)}
      </div>
    </SectionShell>
  )
}
