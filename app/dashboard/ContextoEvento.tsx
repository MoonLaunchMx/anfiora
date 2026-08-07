'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, LayoutGrid, Plus } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import {
  CATALOGO, agregarCaja, quitarCaja,
  type CajaId,
} from '@/lib/dashboard/tablero'
import { useTablero } from './useTablero'
import BannerEvento, { CuentaRegresiva } from './BannerEvento'
import Tablero from './Tablero'
import type { ColaboradorRow, EventMetrics, Rol } from '@/lib/dashboard/types'

const BTN_SEC = 'rounded-[10px] border border-[#E0E0E0] bg-[#F8F8F8] px-3.5 py-2 text-[13px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]'

const CAJA_POR_ID = new Map(CATALOGO.map(c => [c.id, c]))

function fechaCorta(s: string | null): string {
  if (!s) return 'Sin fecha'
  const [y, mo, d] = s.split('T')[0].split('-').map(Number)
  if (!y || !mo || !d) return 'Sin fecha'
  return new Date(y, mo - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
  const [condensado, setCondensado] = useState(false)
  const sentinela = useRef<HTMLDivElement>(null)
  const sinMovimiento = useReducedMotion()

  // El observador avisa cuando el banner sale de la pantalla; es un sistema
  // externo, asi que puede mover el estado desde su propio callback.
  useEffect(() => {
    const el = sentinela.current
    if (!el) return
    const io = new IntersectionObserver(([entrada]) => setCondensado(!entrada.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

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

  const controles = esDueno ? (
    <div className="hidden items-center gap-2 lg:flex">
      {error && <span className="text-[13px] text-[#CC3333]">No se pudo guardar el acomodo.</span>}

      {modo && acomodo.ocultas.length > 0 && (
        <button onClick={() => setMenu(true)} className={BTN_SEC + ' flex items-center gap-2'}>
          <Plus size={14} />
          Agregar caja
        </button>
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

  const ev = m.event

  return (
    <div className="flex flex-col gap-4">

      <div ref={sentinela} className="h-px" />

      {/* Altura cero a proposito: la barra se ve pero no ocupa lugar, asi no
          desplaza el contenido al aparecer ni brinca el scroll. */}
      <div className="pointer-events-none sticky top-0 z-40 -mt-4 h-0">
        <AnimatePresence>
          {condensado && (
            <motion.div
              initial={sinMovimiento ? { opacity: 0 } : { opacity: 0, y: -14 }}
              animate={sinMovimiento ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={sinMovimiento ? { opacity: 0 } : { opacity: 0, y: -14 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex items-center gap-3 rounded-b-2xl border border-t-0 border-[#E8E8E8] bg-white/95 px-4 py-2.5 shadow-[0_10px_24px_-16px_rgba(29,30,32,0.35)] backdrop-blur-md sm:px-5"
            >
              <span className={'h-2 w-2 shrink-0 rounded-full ' + (ev.event_status === 'active' ? 'bg-[#48C9B0]' : 'bg-[#D4A853]')} />

              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[15px] font-bold tracking-[-0.02em] text-[#1D1E20] sm:text-[16px]">
                  {ev.name}
                </span>
                <span className="hidden truncate text-[12px] text-[#999] sm:block">
                  {fechaCorta(ev.event_date)}
                  {ev.venue && ` · ${ev.venue}`}
                </span>
              </span>

              <CuentaRegresiva event={ev} compacto />

              <button
                onClick={onAbrirEvento}
                className="hidden shrink-0 rounded-[9px] bg-[#48C9B0] px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[#3ab89f] sm:block"
              >
                Abrir evento
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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

      {/* Modal y no menu colgado: el banner recorta lo que se sale de su caja,
          y ahi el menu quedaba escondido detras del contenido. */}
      <Modal open={menu} onClose={() => setMenu(false)} size="sm">
        <Modal.Header title="Agregar caja" subtitle="Las que quitaste del tablero" />
        <Modal.Body className="!px-3">
          {acomodo.ocultas.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-[#888]">Ya tienes todas en el tablero.</p>
          ) : acomodo.ocultas.map(id => {
            const cfg = CAJA_POR_ID.get(id)
            return (
              <button
                key={id}
                onClick={() => { setMenu(false); aplicar(agregarCaja(acomodo, id)) }}
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-left transition hover:bg-[#F8F8F8]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-[#EEE] bg-[#F8F8F8]">
                  <Plus size={15} className="text-[#888]" />
                </span>
                <span className="text-[14px] font-medium text-[#1D1E20]">{cfg?.titulo ?? id}</span>
              </button>
            )
          })}
        </Modal.Body>
      </Modal>
    </div>
  )
}
