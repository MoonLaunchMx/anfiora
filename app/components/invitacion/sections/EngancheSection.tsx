'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { Music2, Gift, ChevronRight } from 'lucide-react'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'enganche' }>['content']

export default function EngancheSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const preview = ctx.mode === 'preview'
  const showPlaylist = content.mostrar_playlist && (preview || Boolean(ctx.tokens.playlist))
  const showMesa = content.mostrar_mesa && (preview || Boolean(ctx.tokens.registry))

  if (!showPlaylist && !showMesa) return null

  return (
    <SectionShell variant="band">
      <h2 className="px-2 text-center text-xl font-semibold text-[#1D1E20] sm:text-2xl" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}
      </h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {showPlaylist && (
          <a
            href={ctx.tokens.playlist ? `/playlist/${ctx.tokens.playlist}` : '#'}
            className="flex items-center gap-3 rounded-2xl border border-[#e8e8e8] bg-white px-5 py-4 transition hover:border-[#48C9B0]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fffbf0] text-[#d4a853]">
              <Music2 size={17} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-[#1D1E20]">Arma la playlist</span>
              <span className="block text-xs text-[#666]">Sugiere las canciones que no pueden faltar</span>
            </span>
            <ChevronRight size={16} className="text-[#bbb]" />
          </a>
        )}

        {showMesa && (
          <a
            href={ctx.tokens.registry ? `/mesa/${ctx.tokens.registry}` : '#'}
            className="flex items-center gap-3 rounded-2xl border border-[#e8e8e8] bg-white px-5 py-4 transition hover:border-[#48C9B0]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fffbf0] text-[#d4a853]">
              <Gift size={17} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-[#1D1E20]">Mesa de regalos</span>
              <span className="block text-xs text-[#666]">Consulta las opciones para tu regalo</span>
            </span>
            <ChevronRight size={16} className="text-[#bbb]" />
          </a>
        )}
      </div>
    </SectionShell>
  )
}
