'use client'

import { ChevronDown } from 'lucide-react'
import { MODULOS_CONFIG, NIVELES, type Modulo, type Nivel, type PermisosEvento } from '@/lib/permisos/catalogo'
import type { FeatureKey } from '@/lib/features'

const GRUPOS = [
  { key: 'boda'         as const, label: 'Esenciales' },
  { key: 'herramientas' as const, label: 'Herramientas' },
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
                  className="flex items-center gap-3 border-b border-[#f4f4f4] py-1.5 last:border-b-0"
                >
                  <span className={`min-w-0 flex-1 truncate text-[13.5px] ${prendida ? 'text-[#0a0a0a]' : 'text-[#c2c1bb]'}`}>
                    {m.label}
                  </span>

                  {prendida ? (
                    <span className="relative shrink-0">
                      <select
                        value={nivel}
                        onChange={e => poner(m.key, e.target.value as Nivel)}
                        aria-label={`Permiso de ${m.label}`}
                        className={[
                          'cursor-pointer appearance-none rounded-md border border-transparent bg-transparent',
                          'py-1 pl-2 pr-6 text-right text-[13px] font-medium',
                          'hover:border-[#e8e8e8] focus:border-[#48C9B0] focus:outline-none',
                          nivel === 'total'
                            ? 'font-semibold text-[#9a7220]'
                            : nivel === 'ninguno'
                              ? 'text-[#c2c1bb]'
                              : 'text-[#666]',
                        ].join(' ')}
                      >
                        {NIVELES.map(n => (
                          <option key={n} value={n}>{ETIQUETA_NIVEL[n]}</option>
                        ))}
                      </select>
                      <ChevronDown
                        size={11}
                        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[#c2c1bb]"
                      />
                    </span>
                  ) : (
                    <span className="shrink-0 text-[12px] text-[#c2c1bb]">Apagada en esta boda</span>
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
