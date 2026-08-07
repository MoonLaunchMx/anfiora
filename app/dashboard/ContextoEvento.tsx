'use client'

import { useState } from 'react'
import { Check, LayoutGrid, Plus } from 'lucide-react'
import {
  CATALOGO, agregarCaja, quitarCaja,
  type CajaId,
} from '@/lib/dashboard/tablero'
import { useTablero } from './useTablero'
import BannerEvento from './BannerEvento'
import Tablero from './Tablero'
import type { ColaboradorRow, EventMetrics, Rol } from '@/lib/dashboard/types'

const BTN_SEC = 'rounded-[10px] border border-[#E0E0E0] bg-[#F8F8F8] px-3.5 py-2 text-[13px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]'

const TITULO_CAJA = new Map(CATALOGO.map(c => [c.id, c.titulo]))

type Props = {
  m: EventMetrics
  colaboradores: ColaboradorRow[]
  rol: Rol
  puedeVerDinero: boolean
  usuarioEmail: string
  onAbrirEvento: () => void
}

// `rol` se conserva en la firma porque page.tsx lo pasa. El orden de las cifras
// ahora lo elige el planner, asi que el rol ya no lo decide; no se quita el
// parametro para no tocar al llamador.
export default function ContextoEvento({ m, colaboradores, puedeVerDinero, usuarioEmail, onAbrirEvento }: Props) {
  const { acomodo, cifrasDisp, error, aplicar, mover, persistir } = useTablero(
    m.event.id, m.event.event_type, puedeVerDinero,
  )
  const [modo, setModo] = useState(false)
  const [menu, setMenu] = useState(false)

  // El acomodo se guarda por evento, en una sola fila compartida por todo el
  // equipo. Por eso solo el dueno lo mueve: si un editor lo acomodara, le
  // cambiaria la vista a los demas sin avisar. La base si lo dejaria escribir
  // (las policies son is_event_editor) — el limite es de producto, no tecnico.
  const esDueno = !m.event.is_shared

  const salirDeModo = async () => {
    setModo(false)
    setMenu(false)
    await persistir()
  }

  if (!acomodo) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-56 animate-pulse rounded-2xl border border-[#E8E8E8] bg-white" />
        <div className="h-64 animate-pulse rounded-2xl border border-[#E8E8E8] bg-white" />
      </div>
    )
  }

  // Vive en la esquina superior derecha del banner, no en una barra aparte.
  const controles = esDueno ? (
    <div className="hidden items-center gap-2 lg:flex">
      {error && <span className="text-[13px] text-[#CC3333]">No se pudo guardar el acomodo.</span>}

      {modo && acomodo.ocultas.length > 0 && (
        <div className="relative">
          <button onClick={() => setMenu(p => !p)} className={BTN_SEC + ' flex items-center gap-2'}>
            <Plus size={14} />
            Agregar caja
          </button>
          {menu && (
            <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-[#E8E8E8] bg-white shadow-lg">
              {acomodo.ocultas.map(id => (
                <button
                  key={id}
                  onClick={() => { setMenu(false); aplicar(agregarCaja(acomodo, id)) }}
                  className="block w-full px-4 py-2.5 text-left text-[13.5px] text-[#1D1E20] transition hover:bg-[#F8F8F8]"
                >
                  {TITULO_CAJA.get(id) ?? id}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {modo ? (
        <button
          onClick={salirDeModo}
          className="flex items-center gap-2 rounded-[10px] bg-[#48C9B0] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#3ab89f]"
        >
          <Check size={14} />
          Listo
        </button>
      ) : (
        <button onClick={() => setModo(true)} className={BTN_SEC + ' flex items-center gap-2'}>
          <LayoutGrid size={14} />
          Personalizar
        </button>
      )}
    </div>
  ) : null

  return (
    <div className="flex flex-col gap-4">

      <BannerEvento
        m={m}
        cifras={acomodo.cifras}
        cifrasDisp={cifrasDisp}
        // Las cuatro cifras son fijas por ahora: el menu por cifra existe pero
        // se queda apagado. Personalizar solo mueve las cajas de abajo.
        modoPersonalizar={false}
        onCambiarCifra={() => {}}
        onAbrirEvento={onAbrirEvento}
        controles={controles}
      />

      <Tablero
        acomodo={acomodo}
        m={m}
        colaboradores={colaboradores}
        usuarioEmail={usuarioEmail}
        puedeVerDinero={puedeVerDinero}
        modoPersonalizar={modo}
        onQuitar={(id: CajaId) => aplicar(quitarCaja(acomodo, id))}
        onMover={mover}
      />
    </div>
  )
}
