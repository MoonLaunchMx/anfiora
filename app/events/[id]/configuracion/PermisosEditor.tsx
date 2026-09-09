'use client'

import { MODULOS_CONFIG, NIVELES, type Modulo, type Nivel, type PermisosEvento } from '@/lib/permisos/catalogo'
import { ponerNivel } from '@/lib/permisos/resolver'
import type { FeatureKey } from '@/lib/features'

const GRUPOS = [
  { key: 'boda'         as const, label: 'Esenciales' },
  { key: 'herramientas' as const, label: 'Herramientas' },
  { key: 'finanzas'     as const, label: 'Finanzas' },
]

// "Ocultar" y no "Ninguno": el menu no enseña en gris la herramienta que no te
// toca, la esconde. La etiqueta nombra el efecto, y de paso las cuatro son
// cosas que haces.
const ETIQUETA_NIVEL: Record<Nivel, string> = {
  ninguno: 'Ocultar',
  ver:     'Ver',
  editar:  'Editar',
  total:   'Total',
}

function claseSegmento(nivel: Nivel, activo: boolean): string {
  return [
    'flex-1 whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-semibold transition sm:flex-none',
    !activo
      ? 'text-[#9a9993] hover:text-[#6b6a66]'
      : nivel === 'total'
        ? 'bg-[#fdf5e4] text-[#9a7220] shadow-sm'
        : nivel === 'ninguno'
          ? 'bg-white text-[#9a9993] shadow-sm'
          : 'bg-white text-[#0a0a0a] shadow-sm',
  ].join(' ')
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

  const habilitados = MODULOS_CONFIG.filter(m => estaPrendida(m.key))

  // La fila de arriba se ilumina solo cuando todas coinciden. Asi el mismo
  // control hace dos trabajos: aplica cuando le picas y resume cuando no, sin
  // tener que recorrer los renglones para saber si quedo pareja.
  const nivelesActuales = habilitados.map(m => permisos[m.key] ?? 'ninguno')
  const comun: Nivel | null =
    nivelesActuales.length > 0 && nivelesActuales.every(n => n === nivelesActuales[0])
      ? nivelesActuales[0]
      : null

  // Se dobla ponerNivel modulo por modulo en vez de armar el objeto a mano,
  // para no saltarse el arrastre de Finanzas ni ninguna regla que viva ahi.
  const aplicarATodo = (nivel: Nivel) => {
    let siguiente = permisos
    for (const m of habilitados) siguiente = ponerNivel(siguiente, m.key, nivel, estaPrendida)
    onChange(siguiente)
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
      {habilitados.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[#e4e1db] pb-3">
          <span className="flex min-w-0 flex-col">
            <span className="text-[13px] font-semibold text-[#0a0a0a]">Aplicar a todo</span>
            <span className="text-[11.5px] text-[#9a9993]">
              {comun ? `Todas en ${ETIQUETA_NIVEL[comun]}` : 'Mezcladas'}
            </span>
          </span>
          <span className="flex w-full shrink-0 rounded-lg bg-[#f4f4f2] p-0.5 sm:w-auto">
            {NIVELES.map(n => (
              <button
                key={n}
                type="button"
                aria-pressed={n === comun}
                onClick={() => aplicarATodo(n)}
                className={claseSegmento(n, n === comun)}
              >
                {ETIQUETA_NIVEL[n]}
              </button>
            ))}
          </span>
        </div>
      )}

      {GRUPOS.map(grupo => {
        const modulos = MODULOS_CONFIG.filter(m => m.grupo === grupo.key)
        if (modulos.length === 0) return null

        return (
          <div key={grupo.key}>
            <p className="pb-1 pt-5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#c2c1bb]">
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
                      {NIVELES.map(n => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={n === nivel}
                          onClick={() => poner(m.key, n)}
                          className={claseSegmento(n, n === nivel)}
                        >
                          {ETIQUETA_NIVEL[n]}
                        </button>
                      ))}
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
