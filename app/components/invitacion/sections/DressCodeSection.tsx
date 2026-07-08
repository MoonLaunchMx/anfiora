'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { isDressCodeConfigured, resolveNivelLabel, resolveNivelDesc } from '@/lib/dresscode'

type Content = Extract<Section, { type: 'dress_code' }>['content']

export default function DressCodeSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const dc = ctx.dressCode

  if (!dc || !isDressCodeConfigured(dc)) {
    if (ctx.mode !== 'preview') return null
    return (
      <section className="px-6 py-10 text-center">
        <p className="rounded-xl border border-dashed border-[#e0e0e0] bg-white px-4 py-6 text-xs text-[#bbb]">
          Configúralo en Estilo → Dress code
        </p>
      </section>
    )
  }

  const label = resolveNivelLabel(dc)
  const desc = resolveNivelDesc(dc)

  return (
    <section className="px-6 py-14 text-center">
      <h2 className="text-xl text-[#1D1E20]" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}
      </h2>

      {label && <p className="mt-5 text-2xl font-semibold tracking-tight text-[#1D1E20]">{label}</p>}
      {desc && <p className="text-xs text-[#999]">{desc}</p>}

      {dc.colores_sugeridos.length > 0 && (
        <>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-[#999]">Colores sugeridos</p>
          <div className="mt-2 flex justify-center gap-2">
            {dc.colores_sugeridos.map((c, i) => (
              <span
                key={i}
                className="h-7 w-7 rounded-full border border-black/10"
                style={{ background: c.hex }}
                title={c.nombre}
              />
            ))}
          </div>
        </>
      )}

      {dc.colores_evitar.length > 0 && (
        <>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-[#999]">Evita</p>
          <div className="mt-2 flex justify-center gap-2">
            {dc.colores_evitar.map((c, i) => (
              <span
                key={i}
                className="h-7 w-7 rounded-full border border-[#e0e0e0]"
                style={{ background: c.hex }}
                title={c.nombre}
              />
            ))}
          </div>
        </>
      )}

      {dc.recomendaciones.length > 0 && (
        <p className="mx-auto mt-6 max-w-sm rounded-xl border border-[#f0e2bf] bg-[#fffbf0] px-4 py-3 text-left text-xs leading-relaxed text-[#1D1E20]">
          {dc.recomendaciones.join('. ')}.
        </p>
      )}

      {dc.nota_libre.trim() && (
        <p className="mx-auto mt-3 max-w-sm text-left text-xs leading-relaxed text-[#666]">{dc.nota_libre}</p>
      )}

      {(dc.guia_ellas?.trim() || dc.guia_ellos?.trim()) && (
        <div className="mx-auto mt-5 grid max-w-sm gap-2 text-left sm:grid-cols-2">
          {dc.guia_ellas?.trim() && (
            <div className="rounded-xl bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Ellas</p>
              <p className="mt-0.5 text-xs text-[#666]">{dc.guia_ellas}</p>
            </div>
          )}
          {dc.guia_ellos?.trim() && (
            <div className="rounded-xl bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Ellos</p>
              <p className="mt-0.5 text-xs text-[#666]">{dc.guia_ellos}</p>
            </div>
          )}
        </div>
      )}

      {(dc.fotos_ellas.length > 0 || dc.fotos_ellos.length > 0) && (
        <div className="mx-auto mt-6 grid max-w-sm gap-4 sm:grid-cols-2">
          {([['fotos_ellas', 'Ellas'], ['fotos_ellos', 'Ellos']] as const).map(([field, titulo]) =>
            dc[field].length > 0 ? (
              <div key={field}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#999]">{titulo}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {dc[field].map((url, i) => (
                    <img key={i} src={url} alt="" className="h-20 w-20 rounded-lg border border-[#e8e8e8] object-cover" />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </section>
  )
}
