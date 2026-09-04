'use client'

import { MODULOS_CONFIG, NIVELES, type Modulo, type Nivel, type PermisosEvento } from '@/lib/permisos/catalogo'
import type { FeatureKey } from '@/lib/features'

const GRUPOS = [
  { key: 'boda'         as const, label: 'Esenciales de la boda' },
  { key: 'herramientas' as const, label: 'Experiencia del evento' },
  { key: 'finanzas'     as const, label: 'Finanzas' },
]

const ETIQUETA_NIVEL: Record<Nivel, string> = {
  ninguno: 'Sin acceso',
  ver:     'Solo ver',
  editar:  'Puede editar',
  total:   'Control total',
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
    <div className="flex flex-col gap-3">
      {GRUPOS.map(grupo => {
        const modulos = MODULOS_CONFIG.filter(m => m.grupo === grupo.key)
        if (modulos.length === 0) return null

        return (
          <div key={grupo.key} className="overflow-hidden rounded-xl border border-[#e8e8e8] bg-white">
            <div className="flex items-center justify-between border-b border-[#f0f0f0] bg-[#fafafa] px-4 py-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-[#999]">
                {grupo.label}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-[#bbb]">
                Permiso
              </span>
            </div>

            <div className="divide-y divide-[#f4f4f4]">
              {modulos.map(m => {
                const Icono = m.icon
                const prendida = estaPrendida(m.key)
                const nivel: Nivel = prendida ? (permisos[m.key] ?? 'ninguno') : 'ninguno'

                return (
                  <div
                    key={m.key}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 ${prendida ? '' : 'opacity-55'}`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Icono size={15} className="shrink-0 text-[#999]" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold leading-tight text-[#0a0a0a]">{m.label}</p>
                        <p className="truncate text-[11px] leading-tight text-[#999]">{m.descripcion}</p>
                      </div>
                    </div>

                    {prendida ? (
                      <select
                        value={nivel}
                        onChange={e => poner(m.key, e.target.value as Nivel)}
                        aria-label={`Permiso de ${m.label}`}
                        className={[
                          'shrink-0 cursor-pointer rounded-lg border px-2.5 py-1 text-[12px] font-semibold',
                          'focus:outline-none focus:ring-2 focus:ring-[#48C9B0]/30',
                          nivel === 'total'
                            ? 'border-[#d4a853] bg-[#fffbf0] text-[#b0842c]'
                            : nivel === 'ninguno'
                              ? 'border-[#e8e8e8] bg-white text-[#999]'
                              : 'border-[#e8e8e8] bg-white text-[#0a0a0a]',
                        ].join(' ')}
                      >
                        {NIVELES.map(n => (
                          <option key={n} value={n}>{ETIQUETA_NIVEL[n]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="shrink-0 text-[11px] text-[#bbb]">No está activa en esta boda</span>
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
