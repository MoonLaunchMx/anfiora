'use client'

import { MODULOS_CONFIG, NIVELES, type Modulo, type Nivel, type PermisosEvento } from '@/lib/permisos/catalogo'
import { ponerNivel } from '@/lib/permisos/resolver'
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
    onChange(ponerNivel(permisos, modulo, nivel, estaPrendida))
  }

  // Con el presupuesto en solo lectura pero proveedores o pagos en editar, la
  // persona igual le cambia los montos por debajo. No se prohibe -- son tres
  // permisos de verdad -- pero se nombra, que es lo que confundia.
  const editaAlgo = (m: Modulo) => permisos[m] === 'editar' || permisos[m] === 'total'
  const desalineada = permisos.presupuesto !== 'ver'
    ? null
    : editaAlgo('proveedores') && editaAlgo('pagos') ? 'Proveedores y Pagos'
    : editaAlgo('proveedores') ? 'Proveedores'
    : editaAlgo('pagos') ? 'Pagos'
    : null

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

            {grupo.key === 'finanzas' && (
              <p className="pb-1.5 text-[11.5px] leading-snug text-[#9a9993]">
                Al mover Presupuesto, Proveedores y Pagos se mueven con él. Después ajusta cada uno.
              </p>
            )}

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

            {grupo.key === 'finanzas' && desalineada && (
              <p className="mt-2 rounded-lg border border-[#f0dcae] bg-[#fff9ec] px-3 py-2 text-[11.5px] leading-snug text-[#8a6a1e]">
                Solo mira el Presupuesto, pero puede editar {desalineada}, y de ahí salen los montos que el Presupuesto muestra.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
