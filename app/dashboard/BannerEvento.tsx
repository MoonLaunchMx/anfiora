'use client'

import { useEffect, useState } from 'react'
import {
  Calendar, ChevronDown, CircleAlert, CircleCheck, Clock, LayoutDashboard,
  ExternalLink, Hourglass, MapPin, PencilLine,
} from 'lucide-react'
import { formatCurrency, formatEventDate } from '@/lib/types'
import { slugifyEvent } from '@/lib/invite'
import { ACCESS_MODES, resolveAccessMode } from '@/lib/features'
import { CIFRAS, type CifraId } from '@/lib/dashboard/tablero'
import type { EventMetrics } from '@/lib/dashboard/types'

const ESTADO_LABEL: Record<string, string> = {
  active: 'Activo', paused: 'Pausado', cancelled: 'Cancelado', completed: 'Completado',
}

const INVITACION_CHIP: Record<string, { color: string; texto: string; Icono: React.ElementType }> = {
  publicada: { color: 'text-[#1A9E88]', texto: 'Invitación publicada',   Icono: CircleCheck },
  cambios:   { color: 'text-[#B8860B]', texto: 'Cambios sin publicar',   Icono: CircleAlert },
  borrador:  { color: 'text-[#999]',    texto: 'Invitación en borrador', Icono: PencilLine },
}

const T_LABEL = 'text-[12px] font-semibold uppercase tracking-[0.07em] text-[#999]'

const TITULO_CIFRA = new Map(CIFRAS.map(c => [c.id, c.titulo]))

function getEventDateTime(event: { event_date: string | null; event_time: string | null }): Date {
  if (!event.event_date) return new Date()
  const [year, month, day] = event.event_date.split('T')[0].split('-').map(Number)
  const base = new Date(year, month - 1, day)
  if (event.event_time) {
    const [h, m] = event.event_time.split(':').map(Number)
    base.setHours(h, m, 0, 0)
  } else {
    base.setHours(0, 0, 0, 0)
  }
  return base
}

function formatTime(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return h12 + ':' + m.toString().padStart(2, '0') + ' ' + ampm
}

// Las cuatro celdas del countdown. `null` significa que el evento ya llego.
function partesCuentaRegresiva(
  event: { event_date: string | null; event_time: string | null },
  now: Date,
): { valor: string; unidad: string }[] | null {
  const diff = getEventDateTime(event).getTime() - now.getTime()
  if (diff <= 0) return null

  const dosDigitos = (n: number) => String(n).padStart(2, '0')

  return [
    { valor: String(Math.floor(diff / 86400000)), unidad: 'días' },
    { valor: dosDigitos(Math.floor(diff / 3600000) % 24), unidad: 'hrs' },
    { valor: dosDigitos(Math.floor(diff / 60000) % 60), unidad: 'min' },
    { valor: dosDigitos(Math.floor(diff / 1000) % 60), unidad: 'seg' },
  ]
}

// Late cada segundo, asi que vive aparte: si el intervalo estuviera en el
// banner, la tarjeta entera se redibujaria una vez por segundo.
export function CuentaRegresiva({ event, compacto = false }: {
  event: { event_date: string | null; event_time: string | null }
  compacto?: boolean
}) {
  const [now, setNow] = useState<Date | null>(null)

  // Arranca en null y se llena ya montado: la hora del servidor y la del
  // navegador no coinciden, y pintarla en el primer render desalinea el HTML.
  // El primer valor va aqui a proposito; esperar al primer tic dejaria el
  // countdown en blanco un segundo. Mismo patron que el primitivo Modal.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return <div className={compacto ? 'h-5 w-[132px]' : 'h-[132px] w-full lg:w-[340px]'} />

  const partes = partesCuentaRegresiva(event, now)

  if (compacto) {
    if (!partes) {
      return (
        <span className="hidden shrink-0 items-center gap-1.5 rounded-[10px] border border-[#E8E8E8] bg-[#F8F8F8] px-2.5 py-1.5 md:flex">
          <Clock size={14} className="text-[#1A9E88]" />
          <span className="text-[12px] font-bold tracking-[0.04em] text-[#1A9E88]">ES HOY</span>
        </span>
      )
    }
    const [d, h, mi, s] = partes
    return (
      <span className="hidden shrink-0 items-center gap-1.5 rounded-[10px] border border-[#E8E8E8] bg-[#F8F8F8] px-2.5 py-1.5 md:flex">
        <Clock size={14} className="shrink-0 text-[#1A9E88]" />
        <span className="text-[12px] font-bold tracking-[0.04em] text-[#666]">
          FALTAN{' '}
          <span className="tabular-nums text-[#1A9E88]">
            {d.valor}D : {h.valor}H : {mi.valor}M : {s.valor}S
          </span>
        </span>
      </span>
    )
  }

  return (
    <div
      className="w-full shrink-0 rounded-2xl border border-[#E8E8E8] bg-[#FBFBFB] p-4 lg:w-[340px]"
      aria-label="Tiempo que falta para el evento"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#999]">
          <Hourglass size={13} className="text-[#1A9E88]" />
          Cuenta regresiva
        </span>
        <span className="rounded-md bg-[#F0FDFB] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[#1A9E88]">
          {partes ? 'Faltan' : 'Es hoy'}
        </span>
      </div>

      {partes ? (
        <div className="grid grid-cols-4 gap-2 text-center">
          {partes.map((p, i) => (
            <div key={p.unidad} className="rounded-xl border border-[#EEE] bg-white px-1 py-2.5">
              <b className={
                'block font-display text-[20px] font-extrabold leading-none tabular-nums tracking-[-0.02em] sm:text-[24px] ' +
                (i === 0 ? 'text-[#1A9E88]' : 'text-[#1D1E20]')
              }>
                {p.valor}
              </b>
              <span className="mt-1.5 block text-[9px] font-bold uppercase tracking-[0.1em] text-[#BBB]">
                {p.unidad}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-3 text-center font-display text-[24px] font-extrabold leading-none text-[#1A9E88]">
          Hoy es el día
        </p>
      )}
    </div>
  )
}

// Promedio simple de las cuatro dimensiones que el planner ya mueve a mano.
// Deliberadamente sin pesos: cualquier ponderacion seria inventada.
function pctOrganizacion(m: EventMetrics): number {
  const cabezas = m.mesas.conLugar + m.mesas.sinLugar
  const acomodado = cabezas > 0 ? (m.mesas.conLugar / cabezas) * 100 : 0
  const totalTareas = m.tareas.vencidas + m.tareas.hoy + m.tareas.proximas
  const alDia = totalTareas > 0 ? ((totalTareas - m.tareas.vencidas) / totalTareas) * 100 : 0
  return Math.round((m.invitados.pctConfirmado + Math.min(100, m.dinero.pctContratado) + acomodado + alDia) / 4)
}

type Pintada = { valor: string; nota: string; tramos: { pct: number; color: string }[]; pie: string }

// Una entrada por cifra del catalogo. El Record obliga a que agregar un CifraId
// nuevo no compile hasta que se le de su pintura aqui.
const PINTAR: Record<CifraId, (m: EventMetrics) => Pintada> = {
  invitados: m => {
    const total = m.invitados.total || 1
    return {
      valor: String(m.invitados.confirmados),
      nota: `de ${m.invitados.total}`,
      tramos: [
        { pct: (m.invitados.confirmados / total) * 100, color: '#48C9B0' },
        { pct: (m.invitados.pendientes  / total) * 100, color: '#D4A853' },
        { pct: (m.invitados.declinados  / total) * 100, color: '#E4E4E4' },
      ],
      pie: `${m.invitados.pctConfirmado}% confirmado · ${m.invitados.pendientes} por responder · ${m.invitados.declinados} no asisten`,
    }
  },
  presupuesto: m => {
    const pista = Math.max(m.dinero.estimado, m.dinero.contratado) || 1
    return {
      valor: formatCurrency(m.dinero.estimado, m.event.currency),
      nota: 'estimado',
      tramos: m.dinero.excedido
        ? [{ pct: 100, color: '#CC3333' }]
        : [
            { pct: (m.dinero.pagado   / pista) * 100, color: '#1A9E88' },
            { pct: (m.dinero.porPagar / pista) * 100, color: '#48C9B0' },
          ],
      pie: m.dinero.excedido
        ? `Excedido en ${formatCurrency(m.dinero.contratado - m.dinero.estimado, m.event.currency)}`
        : `Pagado ${formatCurrency(m.dinero.pagado, m.event.currency)} · por pagar ${formatCurrency(m.dinero.porPagar, m.event.currency)}`,
    }
  },
  proveedores: m => {
    const total = m.proveedores.total || 1
    return {
      valor: String(m.proveedores.contratados),
      nota: `de ${m.proveedores.total}`,
      tramos: [
        { pct: (m.proveedores.contratados / total) * 100, color: '#48C9B0' },
        { pct: (m.proveedores.cotizados   / total) * 100, color: '#D4A853' },
      ],
      pie: `${m.proveedores.cotizados} cotizados · ${m.proveedores.nuevos} sin cotizar`,
    }
  },
  tareas: m => {
    const total = m.tareas.vencidas + m.tareas.hoy + m.tareas.proximas || 1
    return {
      valor: String(m.tareas.vencidas),
      nota: m.tareas.vencidas === 1 ? 'vencida' : 'vencidas',
      tramos: [
        { pct: (m.tareas.vencidas / total) * 100, color: '#CC3333' },
        { pct: (m.tareas.hoy      / total) * 100, color: '#D4A853' },
        { pct: (m.tareas.proximas / total) * 100, color: '#48C9B0' },
      ],
      pie: `${m.tareas.hoy} para hoy · ${m.tareas.proximas} próximas${m.tareas.bloqueantesVencidas > 0 ? ` · ${m.tareas.bloqueantesVencidas} bloqueantes` : ''}`,
    }
  },
  regalos: m => ({
    valor: formatCurrency(m.regalos.recibido, m.event.currency),
    nota: 'recibido',
    tramos: [{ pct: m.regalos.totalItems > 0 ? (m.regalos.apartados / m.regalos.totalItems) * 100 : 0, color: '#D4A853' }],
    pie: `${m.regalos.apartados} de ${m.regalos.totalItems} apartados`,
  }),
  mesas: m => {
    const cabezas = m.mesas.conLugar + m.mesas.sinLugar
    const pct = cabezas > 0 ? Math.round((m.mesas.conLugar / cabezas) * 100) : 0
    return {
      valor: `${pct}%`,
      nota: 'acomodado',
      tramos: [{ pct, color: '#48C9B0' }],
      pie: `${m.mesas.conLugar} con lugar · ${m.mesas.sinLugar} sin lugar · ${m.mesas.sillasLibres} sillas libres`,
    }
  },
  atencion: m => {
    const total = m.invitados.total || 1
    return {
      valor: String(m.invitados.atencion),
      nota: m.invitados.atencion === 1 ? 'invitado' : 'invitados',
      tramos: [{ pct: (m.invitados.atencion / total) * 100, color: '#CC3333' }],
      pie: m.invitados.atencion === 0 ? 'Nadie espera respuesta' : 'Escribieron algo que hay que resolver',
    }
  },
  organizacion: m => {
    const pct = pctOrganizacion(m)
    return {
      valor: `${pct}%`,
      nota: 'en orden',
      tramos: [{ pct, color: '#48C9B0' }],
      pie: 'Promedio de invitados, dinero, logística y tareas',
    }
  },
}

function Barra({ tramos }: { tramos: { pct: number; color: string }[] }) {
  return (
    <div className="my-2.5 flex h-2 overflow-hidden rounded-full bg-[#F0F0F0]">
      {tramos.filter(t => t.pct > 0).map((t, i) => (
        <span key={i} className="block h-full transition-all duration-500" style={{ width: `${t.pct}%`, background: t.color }} />
      ))}
    </div>
  )
}

function Cifra({ id, indice, m, modoPersonalizar, cifrasDisp, onCambiarCifra }: {
  id: CifraId
  indice: number
  m: EventMetrics
  modoPersonalizar: boolean
  cifrasDisp: CifraId[]
  onCambiarCifra: (indice: number, nueva: CifraId) => void
}) {
  const [menu, setMenu] = useState(false)
  const d = PINTAR[id](m)

  // Derivado en vez de reiniciado por efecto: al salir del modo el menu se
  // cierra solo, sin provocar un render extra.
  const abierto = menu && modoPersonalizar

  return (
    <div className="relative min-w-0 flex-1 px-4 py-4 sm:px-5">
      {modoPersonalizar ? (
        <>
          <button
            onClick={() => setMenu(p => !p)}
            aria-expanded={abierto}
            className="flex items-center gap-1.5 rounded-[8px] border border-dashed border-[#CCC] px-2 py-1 transition hover:border-[#48C9B0]"
          >
            <span className={T_LABEL}>{TITULO_CIFRA.get(id) ?? id}</span>
            <ChevronDown size={13} className="text-[#BBB]" />
          </button>
          {abierto && (
            <div className="absolute left-4 top-12 z-50 w-56 overflow-hidden rounded-xl border border-[#E8E8E8] bg-white shadow-lg">
              {cifrasDisp.map(opcion => (
                <button
                  key={opcion}
                  onClick={() => { setMenu(false); onCambiarCifra(indice, opcion) }}
                  className={'block w-full px-4 py-2.5 text-left text-[13.5px] transition hover:bg-[#F8F8F8] ' + (opcion === id ? 'font-semibold text-[#1A9E88]' : 'text-[#1D1E20]')}
                >
                  {TITULO_CIFRA.get(opcion) ?? opcion}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <span className={T_LABEL}>{TITULO_CIFRA.get(id) ?? id}</span>
      )}

      <p className="mt-1.5 font-display text-[26px] font-extrabold leading-none tracking-[-0.025em] sm:text-[30px]">
        {d.valor}
        <span className="ml-1.5 text-[13px] font-medium tracking-normal text-[#888]">{d.nota}</span>
      </p>
      <Barra tramos={d.tramos} />
      <p className="text-[12.5px] text-[#888]">{d.pie}</p>
    </div>
  )
}

export default function BannerEvento({ m, cifras, cifrasDisp, modoPersonalizar, onCambiarCifra, onAbrirEvento, controles }: {
  m: EventMetrics
  cifras: CifraId[]
  cifrasDisp: CifraId[]
  modoPersonalizar: boolean
  onCambiarCifra: (indice: number, nueva: CifraId) => void
  onAbrirEvento: () => void
  controles?: React.ReactNode
}) {
  const ev = m.event
  const inv = INVITACION_CHIP[m.invitacion] ?? INVITACION_CHIP.borrador
  const acceso = ACCESS_MODES.find(a => a.key === resolveAccessMode(ev.event_type, m.accessMode))

  // El origin se lee al hacer clic, no en un efecto: guardarlo en estado
  // desincroniza el render del servidor con el del cliente.
  const abrirInvitacion = () => {
    if (!m.sharedToken) return
    const slug = slugifyEvent({ name: ev.name, host_name: ev.host_name, host_name_2: ev.host_name_2 })
    window.open(`${window.location.origin}/invitacion/${slug}/${m.sharedToken}`, '_blank', 'noopener')
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white">

      <div className="relative overflow-hidden bg-gradient-to-br from-white via-white to-[#f3fbf9] px-5 py-5 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-24 h-[320px] w-[320px] rounded-full bg-[#48C9B0]/15 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

          <div className="min-w-0 space-y-4">
            <div className="flex items-center gap-3">
              {ev.event_type && (
                <>
                  <span className="text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-[#999]">
                    {ev.event_type}
                  </span>
                  <span className="text-[#DDD]">·</span>
                </>
              )}
              <span className={
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.06em] ' +
                (ev.event_status === 'active'
                  ? 'border-[#A0E0C0] bg-[#F0FFF6] text-[#2A7A50]'
                  : 'border-[#F0DCA8] bg-[#FFF8E8] text-[#B8860B]')
              }>
                <i className={
                  'h-2 w-2 animate-pulse rounded-full ' +
                  (ev.event_status === 'active' ? 'bg-[#48C9B0]' : 'bg-[#D4A853]')
                } />
                {ESTADO_LABEL[ev.event_status] ?? ev.event_status}
              </span>
            </div>

            <h2 className="font-display text-[28px] font-black leading-[1.03] tracking-[-0.03em] sm:text-[36px]">
              {ev.name}
            </h2>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] font-medium text-[#666] sm:text-[14px]">
              <span className="flex items-center gap-2">
                <Calendar size={15} className="shrink-0 text-[#48C9B0]" />
                {formatEventDate(ev.event_date, ev.event_end_date)}
                {ev.event_time && ` · ${formatTime(ev.event_time)}`}
              </span>
              {ev.venue && (
                <span className="flex min-w-0 items-center gap-2">
                  <MapPin size={15} className="shrink-0 text-[#48C9B0]" />
                  <span className="min-w-0 truncate">{ev.venue}</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <span className={'inline-flex items-center gap-1.5 rounded-lg border border-[#E8E8E8] bg-[#F8F8F8] px-3 py-1 text-[12.5px] font-semibold ' + inv.color}>
                <inv.Icono size={14} className="shrink-0" />
                {inv.texto}
              </span>
              {acceso && (
                <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-[#E8E8E8] bg-[#F8F8F8] px-3 py-1 text-[12.5px] font-semibold text-[#777]">
                  <acceso.icon size={14} className="shrink-0 text-[#AAA]" />
                  <span className="truncate">{acceso.label}</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                onClick={onAbrirEvento}
                className="flex flex-1 items-center justify-center gap-2 rounded-[12px] bg-[#48C9B0] px-5 py-2.5 text-[13.5px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(72,201,176,0.7)] transition hover:bg-[#3ab89f] active:scale-95 sm:flex-none"
              >
                <LayoutDashboard size={15} />
                Abrir evento
              </button>
              {m.sharedToken && (
                <button
                  onClick={abrirInvitacion}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[12px] border border-[#E0E0E0] bg-[#F8F8F8] px-4 py-2.5 text-[13.5px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0] sm:flex-none"
                >
                  <ExternalLink size={15} className="text-[#888]" />
                  Abrir invitación
                </button>
              )}
              {controles}
            </div>
          </div>

          <CuentaRegresiva event={ev} />
        </div>

      </div>

      <div className="grid grid-cols-1 divide-y divide-[#EEE] border-t border-[#E8E8E8] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {cifras.map((id, i) => (
          <Cifra
            key={id}
            id={id}
            indice={i}
            m={m}
            modoPersonalizar={modoPersonalizar}
            cifrasDisp={cifrasDisp}
            onCambiarCifra={onCambiarCifra}
          />
        ))}
      </div>
    </div>
  )
}
