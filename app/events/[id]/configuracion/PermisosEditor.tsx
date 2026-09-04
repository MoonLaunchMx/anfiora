'use client'

import { MODULOS_CONFIG, NIVELES, type Modulo, type Nivel, type PermisosEvento } from '@/lib/permisos/catalogo'
import type { FeatureKey } from '@/lib/features'

const GRUPOS = [
  { key: 'boda'         as const, label: 'Esenciales' },
  { key: 'herramientas' as const, label: 'Herramientas' },
  { key: 'finanzas'     as const, label: 'Finanzas' },
]

const ETIQUETA_NIVEL: Record<Nivel, string> = {
  ninguno: 'Ninguno',
  ver:     'Ver',
  editar:  'Editar',
  total:   'Total',
}

interface Props {
  permisos: PermisosEvento
  features: Record<FeatureKey, boolean> | null
  onChange: (siguiente: PermisosEvento) => void
}

export function PermisosEditor({ permisos, features, onChange }: Props) {
  const estaPrendida = (modulo: Modulo) => {
    const f = MODULOS_CONFIG.find(m => m.key === modulo)!.feature
    return f === null || features?.[f] === true
  }

  const poner = (modulo: Modulo, nivel: Nivel) => {
    const siguiente = { ...permisos }
    if (nivel === 'ninguno') delete siguiente[modulo]
    else siguiente[modulo] = nivel
    onChange(siguiente)
  }

  return (
    <div>
      {GRUPOS.map((grupo, i) => {
        const modulos = MODULOS_CONFIG.filter(m => m.grupo === grupo.key)
        if (modulos.length === 0) return null

        return (
          <div key={grupo.key}>
            <p className={`pb-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#c2c1bb] ${i === 0 ? 'pt-1' : 'pt-5'}`}>
              {grupo.label}
            </p>

            {modulos.map(m => {
              const prendida = estaPrendida(m.key)
              const nivel: Nivel = prendida ? (permisos[m.key] ?? 'ninguno') : 'ninguno'

              return (
                <div
                  key={m.key}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[#f4f4f4] py-2 last:border-b-0"
                >
                  <span className={`min-w-0 flex-1 basis-full truncate text-[13.5px] sm:basis-auto ${prendida ? 'text-[#0a0a0a]' : 'text-[#c2c1bb]'}`}>
                    {m.label}
                  </span>

                  {prendida ? (
                    <span className="flex w-full shrink-0 rounded-lg bg-[#f4f4f2] p-0.5 sm:w-auto">
                      {NIVELES.map(n => {
                        const activo = n === nivel
                        return (
                          <button
                            key={n}
                            type="button"
                            aria-pressed={activo}
                            onClick={() => poner(m.key, n)}
                            className={[
                              'flex-1 whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-semibold transition sm:flex-none',
                              !activo
                                ? 'text-[#9a9993] hover:text-[#6b6a66]'
                                : n === 'total'
                                  ? 'bg-[#fdf5e4] text-[#9a7220] shadow-sm'
                                  : n === 'ninguno'
                                    ? 'bg-white text-[#9a9993] shadow-sm'
                                    : 'bg-white text-[#0a0a0a] shadow-sm',
                            ].join(' ')}
                          >
                            {ETIQUETA_NIVEL[n]}
                          </button>
                        )
                      })}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[12.5px] text-[#c2c1bb]">Desactivado</span>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
