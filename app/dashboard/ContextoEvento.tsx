'use client'

import { useEffect, useState } from 'react'
import { Briefcase, Check, Copy, Gift, Users, Wallet } from 'lucide-react'
import { formatCurrency, formatEventDate } from '@/lib/types'
import { slugifyEvent } from '@/lib/invite'
import { ACCESS_MODES, resolveAccessMode } from '@/lib/features'
import type { ColaboradorRow, EventMetrics, Rol } from '@/lib/dashboard/types'

type ConFecha = { event_date: string | null; event_time: string | null }

function getEventDateTime(event: ConFecha): Date {
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

function getCountdown(event: ConFecha, now: Date) {
  const diff = getEventDateTime(event).getTime() - now.getTime()
  if (diff <= 0) return { grande: '¡Hoy!', chico: '' }
  const totalDays = Math.floor(diff / 86400000)
  const hours   = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  if (totalDays >= 1) return { grande: String(totalDays), chico: `días · ${hours} h · ${minutes} min` }
  return { grande: `${hours}h`, chico: `${minutes} min · ${seconds} s` }
}

// Promedio simple de las cuatro dimensiones que el planner ya mueve a mano.
// Deliberadamente sin pesos: cualquier ponderacion seria inventada.
function pctOrganizacion(m: EventMetrics): number {
  const acomodado = m.mesas.conLugar + m.mesas.sinLugar > 0
    ? (m.mesas.conLugar / (m.mesas.conLugar + m.mesas.sinLugar)) * 100
    : 0
  const totalTareas = m.tareas.vencidas + m.tareas.hoy + m.tareas.proximas
  const alDia = totalTareas > 0 ? ((totalTareas - m.tareas.vencidas) / totalTareas) * 100 : 0
  return Math.round((m.invitados.pctConfirmado + Math.min(100, m.dinero.pctContratado) + acomodado + alDia) / 4)
}

const CHIP_BASE = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap'
const CHIP_TEAL = `${CHIP_BASE} border-[#C8EDE7] bg-[#F0FDFB] text-[#1A9E88]`
const CHIP_MUTE = `${CHIP_BASE} border-[#E8E8E8] bg-[#F8F8F8] text-[#888]`
const CHIP_GOLD = `${CHIP_BASE} border-[#EBD9A8] bg-[#FFFBF0] text-[#8A6A1E]`
const CHIP_BAD  = `${CHIP_BASE} border-[#FFC0C0] bg-[#FFF0F0] text-[#CC3333]`
const CHIP_WARN = `${CHIP_BASE} border-[#F0DCA8] bg-[#FFF8E8] text-[#B8860B]`

const ESTADO_LABEL: Record<string, string> = {
  active: 'Activo', paused: 'Pausado', cancelled: 'Cancelado', completed: 'Completado',
}

const INVITACION_CHIP: Record<string, { clase: string; texto: string }> = {
  publicada: { clase: CHIP_GOLD, texto: 'Invitación publicada' },
  cambios:   { clase: CHIP_WARN, texto: 'Cambios sin publicar' },
  borrador:  { clase: CHIP_MUTE, texto: 'Invitación en borrador' },
}

const LABEL = 'text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#BBB]'
const CARD = 'rounded-[13px] border border-[#E8E8E8] bg-white px-[15px] py-3.5'

function Barra({ tramos }: { tramos: { pct: number; color: string }[] }) {
  return (
    <div className="my-2.5 flex h-1.5 overflow-hidden rounded-full bg-[#F0F0F0]">
      {tramos.filter(t => t.pct > 0).map((t, i) => (
        <span key={i} className="block h-full" style={{ width: `${t.pct}%`, background: t.color }} />
      ))}
    </div>
  )
}

type Props = {
  m: EventMetrics
  colaboradores: ColaboradorRow[]
  rol: Rol
  puedeVerDinero: boolean
  onAbrirEvento: () => void
}

export default function ContextoEvento({ m, rol, puedeVerDinero, onAbrirEvento }: Props) {
  const [now, setNow] = useState(new Date())
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const ev = m.event
  const cd = getCountdown(ev, now)
  const org = pctOrganizacion(m)
  const inv = INVITACION_CHIP[m.invitacion] ?? INVITACION_CHIP.borrador
  const acceso = ACCESS_MODES.find(a => a.key === resolveAccessMode(ev.event_type, m.accessMode))

  // El origin se lee al hacer clic, no en un efecto: guardarlo en estado
  // desincroniza el render del servidor con el del cliente.
  const copiarLink = async () => {
    if (!m.sharedToken) return
    const slug = slugifyEvent({ name: ev.name, host_name: ev.host_name, host_name_2: ev.host_name_2 })
    await navigator.clipboard.writeText(`${window.location.origin}/invitacion/${slug}/${m.sharedToken}`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const totalInv = m.invitados.total || 1
  const tarjetaInvitados = (
    <div key="invitados" className={CARD}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className={LABEL}>Invitados</span>
        <span className="grid h-[26px] w-[26px] place-items-center rounded-[9px] bg-[#F0FDFB]">
          <Users size={13} className="text-[#1A9E88]" />
        </span>
      </div>
      <p className="font-display text-[23px] font-extrabold leading-none tracking-[-0.02em]">
        {m.invitados.confirmados}
        <span className="ml-1 text-[11.5px] font-medium tracking-normal text-[#888]">de {m.invitados.total}</span>
      </p>
      <Barra tramos={[
        { pct: (m.invitados.confirmados / totalInv) * 100, color: '#48C9B0' },
        { pct: (m.invitados.pendientes  / totalInv) * 100, color: '#D4A853' },
        { pct: (m.invitados.declinados  / totalInv) * 100, color: '#E4E4E4' },
      ]} />
      <p className="text-[11px] text-[#888]">
        {m.invitados.pendientes} pendientes · {m.invitados.declinados} no asisten
      </p>
      {m.invitados.atencion > 0 && (
        <span className={`mt-2.5 ${CHIP_BAD}`}>
          {m.invitados.atencion} {m.invitados.atencion === 1 ? 'requiere' : 'requieren'} atención
        </span>
      )}
    </div>
  )

  const pista = Math.max(m.dinero.estimado, m.dinero.contratado) || 1
  const tarjetaPresupuesto = (
    <div key="presupuesto" className={CARD}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className={LABEL}>Presupuesto</span>
        <span className="grid h-[26px] w-[26px] place-items-center rounded-[9px] bg-[#FFFBF0]">
          <Wallet size={13} className="text-[#8A6A1E]" />
        </span>
      </div>
      <p className="font-display text-[23px] font-extrabold leading-none tracking-[-0.02em]">
        {formatCurrency(m.dinero.estimado, ev.currency)}
        <span className="ml-1 text-[11.5px] font-medium tracking-normal text-[#888]">estimado</span>
      </p>
      {m.dinero.excedido ? (
        <Barra tramos={[{ pct: 100, color: '#CC3333' }]} />
      ) : (
        <Barra tramos={[
          { pct: (m.dinero.pagado   / pista) * 100, color: '#1A9E88' },
          { pct: (m.dinero.porPagar / pista) * 100, color: '#48C9B0' },
        ]} />
      )}
      <div className="flex flex-col gap-[3px] text-[10.5px]">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[#1A9E88]" />Pagado</span>
          <b>{formatCurrency(m.dinero.pagado, ev.currency)}</b>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[#48C9B0]" />Contratado por pagar</span>
          <b>{formatCurrency(m.dinero.porPagar, ev.currency)}</b>
        </div>
        <div className="flex items-center justify-between gap-3 text-[#888]">
          <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[#F0F0F0]" />Sin contratar</span>
          <b>{formatCurrency(m.dinero.sinContratar, ev.currency)}</b>
        </div>
      </div>
      {m.dinero.excedido && (
        <span className={`mt-2.5 ${CHIP_BAD}`}>
          Excedido en {formatCurrency(m.dinero.contratado - m.dinero.estimado, ev.currency)}
        </span>
      )}
    </div>
  )

  const totalProv = m.proveedores.total || 1
  const tarjetaProveedores = (
    <div key="proveedores" className={CARD}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className={LABEL}>Proveedores</span>
        <span className="grid h-[26px] w-[26px] place-items-center rounded-[9px] bg-[#F8F8F8]">
          <Briefcase size={13} className="text-[#888]" />
        </span>
      </div>
      <p className="font-display text-[23px] font-extrabold leading-none tracking-[-0.02em]">
        {m.proveedores.contratados}
        <span className="ml-1 text-[11.5px] font-medium tracking-normal text-[#888]">de {m.proveedores.total} contratados</span>
      </p>
      <Barra tramos={[
        { pct: (m.proveedores.contratados / totalProv) * 100, color: '#48C9B0' },
        { pct: (m.proveedores.cotizados   / totalProv) * 100, color: '#D4A853' },
      ]} />
      <p className="text-[11px] text-[#888]">
        {m.proveedores.cotizados} cotizados · {m.proveedores.nuevos} sin cotizar
      </p>
    </div>
  )

  const tarjetaRegalos = (
    <div key="regalos" className={CARD}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className={LABEL}>Mesa de regalos</span>
        <span className="grid h-[26px] w-[26px] place-items-center rounded-[9px] bg-[#FFFBF0]">
          <Gift size={13} className="text-[#8A6A1E]" />
        </span>
      </div>
      <p className="font-display text-[23px] font-extrabold leading-none tracking-[-0.02em]">
        {formatCurrency(m.regalos.recibido, ev.currency)}
      </p>
      <Barra tramos={[
        { pct: m.regalos.totalItems > 0 ? (m.regalos.apartados / m.regalos.totalItems) * 100 : 0, color: '#D4A853' },
      ]} />
      <p className="text-[11px] text-[#888]">
        {m.regalos.apartados} de {m.regalos.totalItems} apartados
      </p>
      {m.regalos.recibido > 0 && (
        <span className={`mt-2.5 ${CHIP_GOLD}`}>
          {formatCurrency(m.regalos.recibido, ev.currency)} recibidos
        </span>
      )}
    </div>
  )

  const tarjetas = puedeVerDinero
    ? (rol === 'planner'
        ? [tarjetaPresupuesto, tarjetaProveedores, tarjetaInvitados, tarjetaRegalos]
        : [tarjetaInvitados, tarjetaRegalos, tarjetaPresupuesto, tarjetaProveedores])
    : [tarjetaInvitados, tarjetaRegalos]

  return (
    <div className="flex flex-col gap-3">

      <div className="relative overflow-hidden rounded-2xl border border-[#e8e8e8] bg-gradient-to-br from-white via-white to-[#f3fbf9] px-5 py-5 sm:px-[22px]">
        <div className="pointer-events-none absolute -right-16 -top-24 h-[300px] w-[300px] rounded-full bg-[#48C9B0]/15 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={CHIP_TEAL}>
                <i className="h-1.5 w-1.5 rounded-full bg-[#48C9B0]" />
                {ESTADO_LABEL[ev.event_status] ?? ev.event_status}
              </span>
              {ev.event_type && <span className={CHIP_MUTE}>{ev.event_type}</span>}
              <span className={inv.clase}>{inv.texto}</span>
              {acceso && <span className={CHIP_MUTE}>{acceso.label}</span>}
            </div>
            <h2 className="mt-[7px] font-display text-[26px] font-black leading-[1.02] tracking-[-0.028em] sm:text-[31px]">
              {ev.name}
            </h2>
            <p className="mt-1.5 text-[11.5px] text-[#888]">
              {formatEventDate(ev.event_date, ev.event_end_date)}
              {ev.event_time && ` · ${formatTime(ev.event_time)}`}
              {ev.venue && ` · ${ev.venue}`}
            </p>
            <div className="mt-3.5 flex flex-wrap gap-[7px]">
              <button
                onClick={onAbrirEvento}
                className="rounded-[9px] bg-[#48C9B0] px-3.5 py-[7px] text-xs font-semibold text-white transition hover:bg-[#3ab89f] active:scale-95"
              >
                Abrir evento
              </button>
              <button
                onClick={() => { window.location.href = `/events/${ev.id}/invitacion` }}
                className="rounded-[9px] border border-[#E0E0E0] bg-[#F8F8F8] px-3 py-1.5 text-[11.5px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]"
              >
                Ver invitación
              </button>
              {m.sharedToken && (
                <button
                  onClick={copiarLink}
                  className="flex items-center gap-1.5 rounded-[9px] border border-[#E0E0E0] bg-[#F8F8F8] px-3 py-1.5 text-[11.5px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]"
                >
                  {copiado ? <Check size={12} className="text-[#1A9E88]" /> : <Copy size={12} />}
                  {copiado ? 'Copiado' : 'Copiar link'}
                </button>
              )}
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className={LABEL}>Faltan</p>
            <b className="block font-display text-[34px] font-black leading-[0.9] tracking-[-0.035em] text-[#1A9E88] sm:text-[40px]">
              {cd.grande}
            </b>
            {cd.chico && <p className="mt-1 text-[11px] text-[#888]">{cd.chico}</p>}
            <div className="mt-3 w-full sm:w-[200px]">
              <div className="mb-[5px] flex items-center justify-between gap-3">
                <span className="text-[10.5px] text-[#888]">Organización</span>
                <span className="text-[10.5px] font-semibold text-[#1A9E88]">{org} %</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#F0F0F0]">
                <div className="h-full rounded-full bg-[#48C9B0] transition-all duration-500" style={{ width: `${org}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={'grid grid-cols-1 gap-3 md:grid-cols-2 ' + (puedeVerDinero ? 'lg:grid-cols-4' : 'lg:grid-cols-2')}>
        {tarjetas}
      </div>

    </div>
  )
}
