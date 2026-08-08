'use client'

import { resolveNivelDesc, resolveNivelLabel } from '@/lib/dresscode'
import CajaShell, { type PropsCaja } from './CajaShell'

export default function CajaVestimenta({ m, modoPersonalizar, onQuitar }: PropsCaja) {
  const dc = m.vestimenta
  const nivel = resolveNivelLabel(dc)
  const desc = resolveNivelDesc(dc)
  const foto = dc.fotos_ellas[0] ?? dc.fotos_ellos[0] ?? null

  return (
    <CajaShell
      id="vestimenta"
      titulo="Código de vestimenta"
      meta={nivel ? undefined : 'Sin definir'}
      accion={{ label: 'Editar', href: `/events/${m.event.id}/vestimenta` }}
      modoPersonalizar={modoPersonalizar}
      onQuitar={onQuitar}
    >
      {!nivel ? (
        <p className="px-5 py-8 text-center text-[13.5px] text-[#888]">
          Todavía no defines cómo quieres que vayan vestidos tus invitados.
        </p>
      ) : (
        <div className="flex gap-4 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-display text-[22px] font-extrabold leading-none tracking-[-0.02em] text-[#1D1E20]">
              {nivel}
            </p>
            {desc && <p className="mt-1.5 text-[13px] text-[#888]">{desc}</p>}

            {dc.colores_sugeridos.length > 0 && (
              <div className="mt-4">
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-[#BBB]">Colores sugeridos</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {dc.colores_sugeridos.slice(0, 6).map((c, i) => (
                    <span
                      key={c.hex + i}
                      title={c.nombre || c.hex}
                      className="h-6 w-6 rounded-full border border-[#E8E8E8]"
                      style={{ background: c.hex }}
                    />
                  ))}
                </div>
              </div>
            )}

            {dc.colores_evitar.length > 0 && (
              <div className="mt-3">
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-[#BBB]">Mejor evitar</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {dc.colores_evitar.slice(0, 6).map((c, i) => (
                    <span
                      key={c.hex + i}
                      title={c.nombre || c.hex}
                      className="h-6 w-6 rounded-full border border-[#E8E8E8] opacity-60 grayscale"
                      style={{ background: c.hex }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {foto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={foto}
              alt=""
              className="hidden h-auto max-h-[150px] w-[104px] shrink-0 rounded-xl object-cover sm:block"
            />
          )}
        </div>
      )}
    </CajaShell>
  )
}
