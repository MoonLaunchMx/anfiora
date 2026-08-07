'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ExternalLink, LayoutDashboard, LayoutGrid, Plus } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import { slugifyEvent } from '@/lib/invite'
import { iniciales } from '@/lib/dashboard/iniciales'
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

// En la barra pegada el chip lleva el tipo de evento delante, asi que el estado
// va en una sola palabra: "Boda activa", no "Boda Activo".
const ESTADO_CORTO: Record<string, string> = {
  active: 'activa', paused: 'pausada', cancelled: 'cancelada', completed: 'terminada',
}

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

  // Mismo destino que el boton del hero: la invitacion como la ve un invitado.
  const abrirInvitacion = () => {
    if (!m.sharedToken) return
    const ev = m.event
    const slug = slugifyEvent({ name: ev.name, host_name: ev.host_name, host_name_2: ev.host_name_2 })
    window.open(`${window.location.origin}/invitacion/${slug}/${m.sharedToken}`, '_blank', 'noopener')
  }

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
              className="pointer-events-auto flex items-center justify-between gap-4 rounded-b-2xl border border-t-0 border-[#E8E8E8] bg-white/90 px-4 py-2.5 shadow-[0_10px_30px_-10px_rgba(72,201,176,0.18)] backdrop-blur-xl sm:px-5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-[#3ab89f] to-[#7fdccb] font-display text-[12px] font-bold text-white shadow-sm">
                  {iniciales(ev.name)}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display text-[15px] font-bold tracking-[-0.02em] text-[#1D1E20] sm:text-[16px]">
                      {ev.name}
                    </h3>
                    <span className={
                      'hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] sm:inline-flex ' +
                      (ev.event_status === 'active'
                        ? 'border-[#A0E0C0] bg-[#F0FFF6] text-[#2A7A50]'
                        : 'border-[#F0DCA8] bg-[#FFF8E8] text-[#B8860B]')
                    }>
                      <i className={
                        'h-1.5 w-1.5 animate-pulse rounded-full ' +
                        (ev.event_status === 'active' ? 'bg-[#48C9B0]' : 'bg-[#D4A853]')
                      } />
                      {ev.event_type ? `${ev.event_type} ${ESTADO_CORTO[ev.event_status] ?? ''}`.trim() : (ESTADO_CORTO[ev.event_status] ?? '')}
                    </span>
                  </div>
                  <p className="truncate text-[12px] text-[#999]">
                    {ev.venue ? `${ev.venue} · ` : ''}{fechaCorta(ev.event_date)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <CuentaRegresiva event={ev} compacto />

                <button
                  onClick={onAbrirEvento}
                  className="flex shrink-0 items-center gap-1.5 rounded-[10px] bg-[#48C9B0] px-3.5 py-1.5 text-[12.5px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(72,201,176,0.9)] transition hover:bg-[#3ab89f] active:scale-95"
                >
                  <LayoutDashboard size={14} />
                  <span className="hidden sm:inline">Abrir evento</span>
                  <span className="sm:hidden">Abrir</span>
                </button>

                {m.sharedToken && (
                  <button
                    onClick={abrirInvitacion}
                    className="hidden shrink-0 items-center gap-1.5 rounded-[10px] border border-[#E0E0E0] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0] sm:flex"
                  >
                    <ExternalLink size={14} className="text-[#888]" />
                    Invitación
                  </button>
                )}
              </div>
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
