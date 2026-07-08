'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { Music2, Gift, ChevronRight } from 'lucide-react'

type Content = Extract<Section, { type: 'enganche' }>['content']

export default function EngancheSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const showPlaylist = content.mostrar_playlist && Boolean(ctx.tokens.playlist)
  const showMesa = content.mostrar_mesa && Boolean(ctx.tokens.registry)

  if (!showPlaylist && !showMesa) return null

  return (
    <section className="px-6 py-14">
      <h2 className="text-center text-xl text-[#1D1E20]" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}
      </h2>

      <div className="mx-auto mt-7 flex max-w-sm flex-col gap-3">
        {showPlaylist && (
          <a
            href={`/playlist/${ctx.tokens.playlist}`}
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
            href={`/mesa/${ctx.tokens.registry}`}
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
    </section>
  )
}
