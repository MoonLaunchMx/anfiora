'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import { computeSalud, computeChipDeuda, ORDEN_BARRAS } from '@/lib/dashboard/salud'
import type { Contexto, EventMetrics, Tono } from '@/lib/dashboard/types'

const BARRA: Record<Tono, string> = {
  ok:     'bg-[#48C9B0]',
  aviso:  'bg-[#B8860B]',
  alerta: 'bg-[#CC3333]',
  vacio:  'bg-[#E8E8E8]',
}

const CHIP: Record<Tono, string> = {
  ok:     'bg-[#F0FFF6] text-[#2A7A50] border-[#A0E0C0]',
  aviso:  'bg-[#FFF8E8] text-[#B8860B] border-[#F0DCA8]',
  alerta: 'bg-[#FFF0F0] text-[#CC3333] border-[#FFC0C0]',
  vacio:  'bg-[#F8F8F8] text-[#888] border-[#E8E8E8]',
}

// Abajo de 640px el menu colgado no cabe: mide casi el ancho de la pantalla y
// se sale por la derecha. Ahi el selector se abre como modal.
const COMPACTO = '(max-width: 639px)'

function suscribirAncho(cb: () => void) {
  const mq = window.matchMedia(COMPACTO)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function useEsCompacto(): boolean {
  return useSyncExternalStore(
    suscribirAncho,
    () => window.matchMedia(COMPACTO).matches,
    () => false,
  )
}

// El selector es un control denso: la fecha larga de formatEventDate no cabe en
// una fila de 400px junto al venue y las cuatro barras.
function parseYMD(s: string | null): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function fechaCorta(s: string | null, conAno = false): string {
  const d = parseYMD(s)
  if (!d) return 'Sin fecha'
  return d.toLocaleDateString('es-MX', conAno
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short' })
}

function enCuantosDias(s: string | null, hoy: Date): string {
  const d = parseYMD(s)
  if (!d) return ''
  const dias = Math.round((d.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'
  if (dias < 0) return `hace ${Math.abs(dias)} días`
  return `en ${dias} días`
}

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

type Props = {
  metrics: EventMetrics[]
  contexto: Contexto
  onChange: (c: Contexto) => void
  onNuevoEvento: () => void
}

export default function EventSelector({ metrics, contexto, onChange, onNuevoEvento }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const compacto = useEsCompacto()

  useEffect(() => {
    // Con el modal abierto no aplica: el overlay ya cierra al tocar fuera, y
    // este oyente lo cerraria en cuanto se tocara dentro del portal.
    if (compacto) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-selector]')) setAbierto(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [compacto])

  useEffect(() => {
    // En el telefono no se enfoca solo: abriria el teclado encima de la lista
    // justo cuando el usuario quiere ver sus eventos.
    if (abierto && !compacto) inputRef.current?.focus()
    if (!abierto) setBusqueda('')
  }, [abierto, compacto])

  const hoy = new Date()

  const { activos, pasados } = useMemo(() => {
    const corte = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()
    const esProximo = (m: EventMetrics) => {
      const d = parseYMD(m.event.event_date)
      return !d || d.getTime() >= corte
    }
    return {
      activos: metrics.filter(m => m.event.event_status === 'active' && esProximo(m)),
      pasados: metrics.filter(m => m.event.event_status !== 'active' || !esProximo(m)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics])

  const filtrados = useMemo(() => {
    const q = sinAcentos(busqueda.trim())
    if (!q) return activos
    return activos.filter(m =>
      sinAcentos(m.event.name).includes(q) ||
      sinAcentos(m.event.venue ?? '').includes(q)
    )
  }, [activos, busqueda])

  const enFoco = contexto.kind === 'evento'
    ? metrics.find(m => m.event.id === contexto.eventId) ?? null
    : null

  const esCartera = contexto.kind === 'cartera'

  const elegir = (c: Contexto) => {
    onChange(c)
    setAbierto(false)
  }

  const buscador = (
    <div className="flex items-center gap-2 rounded-[10px] border border-[#E8E8E8] bg-[#F8F8F8] px-3 py-2.5 sm:px-2.5 sm:py-1.5">
      <Search size={14} className="shrink-0 text-[#BBB]" />
      <input
        ref={inputRef}
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar evento"
        className="w-full bg-transparent text-[16px] text-[#1D1E20] outline-none placeholder:text-[#BBB] sm:text-[11.5px]"
      />
    </div>
  )

  const lista = (
    <>
      {filtrados.length === 0 ? (
        <p className="px-3 py-8 text-center text-[13px] text-[#BBB] sm:py-6 sm:text-[11.5px]">
          {busqueda ? 'Ningún evento coincide' : 'No tienes eventos activos'}
        </p>
      ) : filtrados.map(m => {
        const salud = computeSalud(m)
        const chip = computeChipDeuda(m)
        const activo = contexto.kind === 'evento' && contexto.eventId === m.event.id
        return (
          <button
            key={m.event.id}
            onClick={() => elegir({ kind: 'evento', eventId: m.event.id })}
            className={'flex w-full items-center gap-2.5 rounded-[10px] border px-3 py-3 text-left transition sm:mx-[5px] sm:w-[calc(100%-10px)] sm:px-[11px] sm:py-2 ' + (
              activo ? 'border-[#C8EDE7] bg-[#F0FDFB]' : 'border-transparent hover:bg-[#F8F8F8]'
            )}
          >
            <span className={'h-1.5 w-1.5 shrink-0 rounded-full ' + (activo ? 'bg-[#48C9B0]' : 'bg-[#BBB]')} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold tracking-[-0.01em] text-[#1D1E20]">{m.event.name}</span>
              <span className="block truncate text-[12.5px] text-[#888]">
                {fechaCorta(m.event.event_date)}
                {' · '}{enCuantosDias(m.event.event_date, hoy)}
                {m.event.venue && ` · ${m.event.venue}`}
              </span>
            </span>
            <span className="hidden w-[52px] shrink-0 gap-[2px] sm:flex sm:w-[74px] sm:gap-[3px]">
              {ORDEN_BARRAS.map(k => (
                <i key={k} className={'block h-1 flex-1 rounded-full ' + BARRA[salud[k]]} />
              ))}
            </span>
            <span className={'shrink-0 rounded-full border px-1.5 py-px text-[10px] font-semibold ' + CHIP[chip.tono]}>
              {chip.texto}
            </span>
          </button>
        )
      })}
    </>
  )

  const pie = (
    <div className="flex gap-2">
      <button
        onClick={() => { setAbierto(false); onNuevoEvento() }}
        className="flex-1 rounded-[10px] bg-[#1D1E20] px-3 py-2.5 text-center text-[13px] font-semibold text-white transition hover:bg-[#2c2d30] sm:py-1.5"
      >
        + Nuevo evento
      </button>
      <button
        onClick={() => elegir({ kind: 'cartera' })}
        className="shrink-0 rounded-[10px] border border-[#E0E0E0] bg-[#F8F8F8] px-3 py-2.5 text-[13px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0] sm:py-1.5"
      >
        Pasados · {pasados.length}
      </button>
    </div>
  )

  return (
    <div data-selector className="relative min-w-0 flex-1 sm:max-w-[340px]">
      <button
        onClick={() => setAbierto(p => !p)}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        className={'flex w-full items-center gap-2 rounded-[9px] border px-3 py-2.5 text-left transition sm:px-2.5 sm:py-1.5 ' + (
          esCartera
            ? 'border-dashed border-[#E0E0E0] bg-white text-[#888] hover:border-[#48C9B0]'
            : 'border-[#E8E8E8] bg-[#F8F8F8] text-[#1D1E20] hover:border-[#48C9B0]'
        )}
      >
        <span className={'h-2 w-2 shrink-0 rounded-full ' + (esCartera ? 'bg-[#DDD]' : 'bg-[#48C9B0]')} />
        <span className="flex-1 truncate text-[13.5px] font-semibold tracking-[-0.01em]">
          {esCartera ? 'Elegir evento' : enFoco?.event.name ?? 'Elegir evento'}
        </span>
        {!esCartera && (
          <span className="hidden shrink-0 rounded-full border border-[#E8E8E8] bg-white px-2 py-0.5 text-[12px] font-semibold text-[#888] md:inline-block">
            {fechaCorta(enFoco?.event.event_date ?? null, true)}
          </span>
        )}
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          className={'shrink-0 text-[#BBB] transition ' + (abierto ? 'rotate-180' : '')}
        />
      </button>

      {compacto ? (
        <Modal open={abierto} onClose={() => setAbierto(false)} size="lg">
          <Modal.Header title="Elegir evento" subtitle={`${filtrados.length} activos`} />
          <Modal.Body className="!px-3">
            <div className="mb-2">{buscador}</div>
            {lista}
          </Modal.Body>
          <Modal.Footer>{pie}</Modal.Footer>
        </Modal>
      ) : abierto && (
        <div className="absolute left-0 top-[calc(100%+7px)] z-50 flex max-h-[70dvh] w-[min(428px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[14px] border border-[#E8E8E8] bg-white shadow-[0_20px_44px_-14px_rgba(29,30,32,0.22)]">

          <div className="shrink-0">
            <div className="m-[10px_11px]">{buscador}</div>

            <div className="flex items-center justify-between px-[11px] pb-[3px]">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#BBB]">
                Activos · {filtrados.length}
              </span>
              <span className="hidden text-[10px] text-[#888] sm:block">Invitados · Dinero · Logística · Tareas</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-1.5">{lista}</div>

          <div className="shrink-0">
            <div className="h-px bg-[#F0F0F0]" />
            <div className="px-[11px] py-[9px]">{pie}</div>
          </div>
        </div>
      )}
    </div>
  )
}
