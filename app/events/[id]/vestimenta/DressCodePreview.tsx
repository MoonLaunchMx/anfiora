'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import {
  isDressCodeConfigured, resolveNivelLabel, resolveNivelDesc, buildDressCodeText,
  type DressCode,
} from '@/lib/dresscode'

export default function DressCodePreview({ dc, eventName }: { dc: DressCode; eventName: string }) {
  const [copied, setCopied] = useState(false)
  const configured = isDressCodeConfigured(dc)
  const label = resolveNivelLabel(dc)
  const desc = resolveNivelDesc(dc)

  const copy = async () => {
    await navigator.clipboard.writeText(buildDressCodeText(dc, { eventName }))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="sticky top-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#999]">Vista del invitado</p>
        <button
          onClick={copy}
          disabled={!configured}
          className="flex items-center gap-1.5 rounded-lg border border-[#e8e8e8] px-2.5 py-1.5 text-xs font-medium text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0] disabled:opacity-50"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copiado' : 'Copiar texto'}
        </button>
      </div>

      <div className="rounded-2xl border border-[#e8e8e8] bg-[#f8f8f8] p-2.5">
        {!configured ? (
          <div className="rounded-xl border border-dashed border-[#e0e0e0] bg-white px-4 py-10 text-center text-sm text-[#bbb]">
            Configura el código para ver la vista previa
          </div>
        ) : (
          <div className="rounded-xl border border-[#e8e8e8] bg-white px-4 py-5 text-center">
            <p className="text-[11px] tracking-wide text-[#888]">{eventName.toUpperCase()}</p>
            {label && <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#1D1E20]">{label}</p>}
            {desc && <p className="text-xs text-[#888]">{desc}</p>}

            {dc.colores_sugeridos.length > 0 && (
              <>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#999]">Colores sugeridos</p>
                <div className="mt-2 flex justify-center gap-2">
                  {dc.colores_sugeridos.map((c, i) => (
                    <span key={i} className="h-6 w-6 rounded-full border border-black/10" style={{ background: c.hex }} title={c.nombre} />
                  ))}
                </div>
              </>
            )}

            {dc.colores_evitar.length > 0 && (
              <>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#999]">Evita</p>
                <div className="mt-2 flex justify-center gap-2">
                  {dc.colores_evitar.map((c, i) => (
                    <span key={i} className="h-6 w-6 rounded-full border border-[#e0e0e0]" style={{ background: c.hex }} title={c.nombre} />
                  ))}
                </div>
              </>
            )}

            {dc.recomendaciones.length > 0 && (
              <p className="mt-4 rounded-lg border border-[#f0e2bf] bg-[#fffbf0] px-3 py-2 text-left text-xs leading-relaxed text-[#1D1E20]">
                {dc.recomendaciones.join('. ')}.
              </p>
            )}

            {dc.nota_libre.trim() && (
              <p className="mt-2 text-left text-xs leading-relaxed text-[#666]">{dc.nota_libre}</p>
            )}

            {(dc.guia_ellas?.trim() || dc.guia_ellos?.trim()) && (
              <div className="mt-3 grid gap-2 text-left sm:grid-cols-2">
                {dc.guia_ellas?.trim() && (
                  <div className="rounded-lg bg-[#f8f8f8] px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Ellas</p>
                    <p className="mt-0.5 text-xs text-[#666]">{dc.guia_ellas}</p>
                  </div>
                )}
                {dc.guia_ellos?.trim() && (
                  <div className="rounded-lg bg-[#f8f8f8] px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Ellos</p>
                    <p className="mt-0.5 text-xs text-[#666]">{dc.guia_ellos}</p>
                  </div>
                )}
              </div>
            )}

            {(dc.fotos_ellas.length > 0 || dc.fotos_ellos.length > 0) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {([['fotos_ellas', 'Ellas'], ['fotos_ellos', 'Ellos']] as const).map(([field, titulo]) =>
                  dc[field].length > 0 ? (
                    <div key={field}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#999]">{titulo}</p>
                      <div className="mt-2 flex flex-wrap justify-center gap-2">
                        {dc[field].map((url, i) => (
                          <img key={i} src={url} alt="" className="h-16 w-16 rounded-lg border border-[#e8e8e8] object-cover" />
                        ))}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
