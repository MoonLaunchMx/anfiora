'use client'

import { Music } from 'lucide-react'
import CajaShell, { T_META, type PropsCaja } from './CajaShell'

export default function CajaPlaylist({ m, modoPersonalizar, onQuitar }: PropsCaja) {
  const { total, distintas, masPedida } = m.playlist

  return (
    <CajaShell
      id="playlist"
      titulo="Playlist"
      meta={total === 0 ? 'Sin canciones todavía' : `${distintas} ${distintas === 1 ? 'canción' : 'canciones'} · ${total} ${total === 1 ? 'petición' : 'peticiones'}`}
      accion={{ label: 'Ver playlist', href: `/events/${m.event.id}/playlist` }}
      modoPersonalizar={modoPersonalizar}
      onQuitar={onQuitar}
    >
      <div className="px-5 py-4">
        {!masPedida ? (
          <p className="py-6 text-center text-[13.5px] text-[#888]">
            Todavía nadie sugiere canciones. Comparte el link con tus invitados.
          </p>
        ) : (
          <>
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-[#BBB]">La más pedida</p>
            <div className="mt-2.5 flex items-center gap-3">
              {masPedida.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={masPedida.thumbnail}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-[10px] object-cover"
                />
              ) : (
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[10px] bg-[#F8F8F8]">
                  <Music size={20} className="text-[#BBB]" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[16px] font-bold tracking-[-0.015em] text-[#1D1E20]">
                  {masPedida.titulo}
                </p>
                {masPedida.artista && <p className={'truncate ' + T_META}>{masPedida.artista}</p>}
              </div>
              {masPedida.veces > 1 && (
                <span className="shrink-0 rounded-full border border-[#C8EDE7] bg-[#F0FDFB] px-2.5 py-1 text-[12px] font-bold text-[#1A9E88]">
                  ×{masPedida.veces}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </CajaShell>
  )
}
