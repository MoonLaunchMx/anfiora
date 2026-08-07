'use client'

import { useMemo } from 'react'
import GridLayout, { useContainerWidth, type Layout, type LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { COLUMNAS, type Acomodo, type Caja, type CajaId } from '@/lib/dashboard/tablero'
import type { ColaboradorRow, EventMetrics } from '@/lib/dashboard/types'
import type { PropsCaja } from './cajas/CajaShell'
import CajaAtencion from './cajas/CajaAtencion'
import CajaPendientes from './cajas/CajaPendientes'
import CajaMesas from './cajas/CajaMesas'
import CajaRegalos from './cajas/CajaRegalos'
import CajaPlaylist from './cajas/CajaPlaylist'
import CajaVestimenta from './cajas/CajaVestimenta'
import CajaActividad from './cajas/CajaActividad'
import CajaEquipo from './cajas/CajaEquipo'

const RENGLON = 64
const SEPARACION: readonly [number, number] = [16, 16]
const SIN_ORILLA: readonly [number, number] = [0, 0]

const COMPONENTE: Record<CajaId, (p: PropsCaja) => React.JSX.Element> = {
  atencion: CajaAtencion,
  pendientes: CajaPendientes,
  mesas: CajaMesas,
  regalos: CajaRegalos,
  playlist: CajaPlaylist,
  vestimenta: CajaVestimenta,
  actividad: CajaActividad,
  equipo: CajaEquipo,
}

export default function Tablero({
  acomodo, m, colaboradores, usuarioEmail, puedeVerDinero, modoPersonalizar, onQuitar, onMover,
}: {
  acomodo: Acomodo
  m: EventMetrics
  colaboradores: ColaboradorRow[]
  usuarioEmail: string
  puedeVerDinero: boolean
  modoPersonalizar: boolean
  onQuitar: (id: CajaId) => void
  onMover: (cajas: Caja[]) => void
}) {
  // La version 2 de la libreria cambio WidthProvider por este hook: mide el
  // contenedor y devuelve el ancho, que GridLayout ahora exige como prop.
  const { width, containerRef } = useContainerWidth()

  const layout: LayoutItem[] = useMemo(
    () => acomodo.cajas.map(c => ({ i: c.id, x: c.x, y: c.y, w: c.w, h: c.h, minW: 1, minH: 2 })),
    [acomodo.cajas],
  )

  const props = (modo: boolean): PropsCaja => ({
    m, colaboradores, usuarioEmail, puedeVerDinero, modoPersonalizar: modo, onQuitar,
  })

  const alMover = (nuevo: Layout) => {
    if (!modoPersonalizar) return
    const porId = new Map(nuevo.map(l => [l.i, l]))
    onMover(acomodo.cajas.map(c => {
      const l = porId.get(c.id)
      return l ? { ...c, x: l.x, y: l.y, w: l.w, h: l.h } : c
    }))
  }

  return (
    <>
      <div className="flex flex-col gap-4 lg:hidden">
        {acomodo.cajas.map(c => {
          const Caja = COMPONENTE[c.id]
          return (
            <div key={c.id} className="min-h-[220px]">
              <Caja {...props(false)} />
            </div>
          )
        })}
      </div>

      <div ref={containerRef} className="hidden lg:block">
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{
            cols: COLUMNAS,
            rowHeight: RENGLON,
            margin: SEPARACION,
            containerPadding: SIN_ORILLA,
          }}
          dragConfig={{ enabled: modoPersonalizar, handle: '.caja-arrastre' }}
          resizeConfig={{ enabled: modoPersonalizar }}
          onLayoutChange={alMover}
        >
          {acomodo.cajas.map(c => {
            const Caja = COMPONENTE[c.id]
            return (
              <div key={c.id}>
                <Caja {...props(modoPersonalizar)} />
              </div>
            )
          })}
        </GridLayout>
      </div>
    </>
  )
}
