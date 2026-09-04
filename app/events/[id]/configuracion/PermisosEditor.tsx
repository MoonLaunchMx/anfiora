'use client'

import { MODULOS_CONFIG, type Modulo, type Nivel, type PermisosEvento } from '@/lib/permisos/catalogo'
import type { FeatureKey } from '@/lib/features'

const GRUPOS: { key: 'boda' | 'herramientas' | 'finanzas'; label: string }[] = [
  { key: 'boda',         label: 'Siempre parte de la boda' },
  { key: 'herramientas', label: 'Herramientas de esta boda' },
  { key: 'finanzas',     label: 'Finanzas' },
]

const NIVELES_VISIBLES: { valor: Nivel; label: string }[] = [
  { valor: 'ver',    label: 'Ver' },
  { valor: 'editar', label: 'Editar' },
  { valor: 'total',  label: 'Total' },
]

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
    <div className="flex flex-col gap-4">
      {GRUPOS.map(grupo => {
        const modulos = MODULOS_CONFIG.filter(m => m.grupo === grupo.key)
        if (modulos.length === 0) return null
        return (
          <div key={grupo.key} className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-[#999]">
              {grupo.label}
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {modulos.map(m => {
                const prendida = estaPrendida(m.key)
                const nivel: Nivel = prendida ? (permisos[m.key] ?? 'ninguno') : 'ninguno'
                const activo = nivel !== 'ninguno'
                return (
                  <div
                    key={m.key}
                    className={[
                      'flex items-center gap-2 rounded-lg border px-2.5 py-1.5',
                      !prendida ? 'border-dashed border-[#e8e8e8] opacity-60'
                        : nivel === 'total' ? 'border-[#d4a853] bg-[#fffbf0]'
                        : activo ? 'border-[#48C9B0] bg-[#f0fdfa]'
                        : 'border-[#e8e8e8] bg-white',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      disabled={!prendida}
                      onClick={() => poner(m.key, activo ? 'ninguno' : 'ver')}
                      className="flex flex-1 items-center gap-2 text-left text-[13px] text-[#0a0a0a] disabled:cursor-not-allowed"
                    >
                      <span
                        className={[
                          'h-4 w-4 flex-none rounded border',
                          nivel === 'total' ? 'border-[#d4a853] bg-[#d4a853]'
                            : activo ? 'border-[#48C9B0] bg-[#48C9B0]'
                            : 'border-[#e0e0e0] bg-white',
                        ].join(' ')}
                      />
                      {m.label}
                    </button>

                    {prendida ? (
                      <span className="flex flex-none overflow-hidden rounded-md border border-[#e8e8e8]">
                        {NIVELES_VISIBLES.map(n => (
                          <button
                            key={n.valor}
                            type="button"
                            onClick={() => poner(m.key, n.valor)}
                            className={[
                              'px-2 py-0.5 text-[11px] font-semibold',
                              nivel !== n.valor ? 'text-[#999]'
                                : n.valor === 'total' ? 'bg-[#d4a853] text-[#3a2a08]'
                                : 'bg-[#48C9B0] text-[#08312a]',
                              nivel === 'ninguno' ? 'invisible' : '',
                            ].join(' ')}
                          >
                            {n.label}
                          </button>
                        ))}
                      </span>
                    ) : (
                      <span className="flex-none text-[10.5px] text-[#999]">
                        apagada en esta boda
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
