'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Layers, Search } from 'lucide-react'
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
  totalAlertas: number
  onChange: (c: Contexto) => void
  onNuevoEvento: () => void
}

export default function EventSelector({ metrics, contexto, totalAlertas, onChange, onNuevoEvento }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    if (abierto) inputRef.current?.focus()
    else setBusqueda('')
  }, [abierto])

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

  return (
    <div data-selector className="relative min-w-0">
      <button
        onClick={() => setAbierto(p => !p)}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        className="group -ml-2 flex max-w-full items-center gap-2 rounded-xl px-2 py-1 text-left transition hover:bg-[#EFEFEF] sm:gap-2.5"
      >
        {esCartera
          ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#1D1E20] sm:h-7 sm:w-7"><Layers size={13} className="text-white" /></span>
          : <span className="h-2 w-2 shrink-0 rounded-full bg-[#48C9B0]" />}
        <span className="truncate font-display text-xl font-black tracking-[-0.028em] text-[#1D1E20] sm:text-[28px]">
          {esCartera ? 'Tu cartera' : enFoco?.event.name ?? 'Elige un evento'}
        </span>
        <span className="hidden shrink-0 rounded-full border border-[#E8E8E8] bg-[#F8F8F8] px-2 py-0.5 text-[10px] font-semibold text-[#888] sm:inline-block">
          {esCartera
            ? `${activos.length} ${activos.length === 1 ? 'activo' : 'activos'}`
            : fechaCorta(enFoco?.event.event_date ?? null, true)}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2.5}
          className={'shrink-0 text-[#BBB] transition group-hover:text-[#1D1E20] ' + (abierto ? 'rotate-180' : '')}
        />
      </button>

      {abierto && (
        <div className="absolute left-0 top-[calc(100%+7px)] z-50 flex max-h-[70vh] w-full flex-col overflow-hidden rounded-[14px] border border-[#E8E8E8] bg-white shadow-[0_20px_44px_-14px_rgba(29,30,32,0.22)] sm:w-[428px]">

          <div className="shrink-0">
            <div className="m-[10px_11px] flex items-center gap-2 rounded-[9px] border border-[#E8E8E8] bg-[#F8F8F8] px-2.5 py-1.5">
              <Search size={12} className="shrink-0 text-[#BBB]" />
              <input
                ref={inputRef}
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar evento"
                className="w-full bg-transparent text-[11.5px] text-[#1D1E20] outline-none placeholder:text-[#BBB]"
              />
            </div>

            <button
              onClick={() => elegir({ kind: 'cartera' })}
              className="m-[3px_11px_8px] flex w-[calc(100%-22px)] items-center gap-2.5 rounded-[10px] border border-[#E8E8E8] bg-[#F8F8F8] px-[11px] py-2.5 text-left transition hover:border-[#48C9B0]"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-[#1D1E20]">
                <Layers size={13} className="text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold tracking-[-0.005em] text-[#1D1E20]">Vista cartera</span>
                <span className="block text-[10.5px] text-[#888]">
                  Tus {activos.length} {activos.length === 1 ? 'evento activo' : 'eventos activos'}
                  {totalAlertas > 0 && ` · ${totalAlertas} ${totalAlertas === 1 ? 'tarea vencida' : 'tareas vencidas'}`}
                </span>
              </span>
              {totalAlertas > 0 && (
                <span className={'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ' + CHIP.alerta}>
                  {totalAlertas}
                </span>
              )}
            </button>

            <div className="h-px bg-[#F0F0F0]" />

            <div className="flex items-center justify-between px-[11px] pb-[3px] pt-1.5">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#BBB]">
                Activos · {filtrados.length}
              </span>
              <span className="hidden text-[10px] text-[#888] sm:block">Invitados · Dinero · Logística · Tareas</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-1.5">
            {filtrados.length === 0 ? (
              <p className="px-[11px] py-6 text-center text-[11.5px] text-[#BBB]">
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
                  className={'mx-[5px] flex w-[calc(100%-10px)] items-center gap-2.5 rounded-[10px] border px-[11px] py-2 text-left transition ' + (
                    activo ? 'border-[#C8EDE7] bg-[#F0FDFB]' : 'border-transparent hover:bg-[#F8F8F8]'
                  )}
                >
                  <span className={'h-1.5 w-1.5 shrink-0 rounded-full ' + (activo ? 'bg-[#48C9B0]' : 'bg-[#BBB]')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold tracking-[-0.005em] text-[#1D1E20]">{m.event.name}</span>
                    <span className="block truncate text-[10.5px] text-[#888]">
                      {fechaCorta(m.event.event_date)}
                      {' · '}{enCuantosDias(m.event.event_date, hoy)}
                      {m.event.venue && ` · ${m.event.venue}`}
                    </span>
                  </span>
                  <span className="flex w-[74px] shrink-0 gap-[3px]">
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
          </div>

          <div className="shrink-0">
            <div className="h-px bg-[#F0F0F0]" />
            <div className="flex gap-[7px] px-[11px] py-[9px]">
              <button
                onClick={() => { setAbierto(false); onNuevoEvento() }}
                className="flex-1 rounded-[9px] bg-[#1D1E20] px-3 py-1.5 text-center text-[11.5px] font-semibold text-white transition hover:bg-[#2c2d30]"
              >
                + Nuevo evento
              </button>
              <button
                onClick={() => elegir({ kind: 'cartera' })}
                className="shrink-0 rounded-[9px] border border-[#E0E0E0] bg-[#F8F8F8] px-3 py-1.5 text-[11.5px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]"
              >
                Pasados · {pasados.length}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
