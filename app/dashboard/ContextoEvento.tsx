'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Activity, Briefcase, Check, Copy, Gift, LayoutGrid, Settings,
  UserPlus, Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatEventDate } from '@/lib/types'
import { slugifyEvent } from '@/lib/invite'
import { ACCESS_MODES, resolveAccessMode } from '@/lib/features'
import { AUDIT_ACTION_LABEL, type AuditAction } from '@/lib/audit'
import { haceCuanto } from '@/lib/dashboard/salud'
import { buildUrgencias } from '@/lib/dashboard/urgencias'
import FeedAtencion from './FeedAtencion'
import type { ColaboradorRow, EventMetrics, Rol, TaskRow } from '@/lib/dashboard/types'

type ConFecha = { event_date: string | null; event_time: string | null }

type ActividadRow = {
  id: string
  action: string
  entity_label: string | null
  user_name: string | null
  created_at: string
}

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
  if (diff <= 0) return { grande: '¡Hoy!', unidad: '', chico: '' }
  const totalDays = Math.floor(diff / 86400000)
  const hours   = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  if (totalDays >= 1) {
    return { grande: String(totalDays), unidad: totalDays === 1 ? 'día' : 'días', chico: `${hours} h · ${minutes} min` }
  }
  return { grande: `${hours}`, unidad: 'horas', chico: `${minutes} min · ${seconds} s` }
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

const CHIP_BASE = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap'
const CHIP_TEAL = `${CHIP_BASE} border-[#C8EDE7] bg-[#F0FDFB] text-[#1A9E88]`
const CHIP_MUTE = `${CHIP_BASE} border-[#E8E8E8] bg-[#F8F8F8] text-[#777]`
const CHIP_GOLD = `${CHIP_BASE} border-[#EBD9A8] bg-[#FFFBF0] text-[#8A6A1E]`
const CHIP_BAD  = `${CHIP_BASE} border-[#FFC0C0] bg-[#FFF0F0] text-[#CC3333]`
const CHIP_WARN = `${CHIP_BASE} border-[#F0DCA8] bg-[#FFF8E8] text-[#B8860B]`

function diasDeTarea(t: TaskRow, hoy: Date): { texto: string; clase: string } {
  if (!t.task_date) return { texto: '', clase: '' }
  const [y, mo, d] = t.task_date.split('T')[0].split('-').map(Number)
  const dias = Math.round(
    (new Date(y, mo - 1, d).getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000,
  )
  if (dias < 0)   return { texto: dias === -1 ? 'Vencida ayer' : `Vencida hace ${Math.abs(dias)} días`, clase: CHIP_BAD }
  if (dias === 0) return { texto: 'Hoy', clase: CHIP_WARN }
  if (dias === 1) return { texto: 'Mañana', clase: CHIP_MUTE }
  return { texto: `En ${dias} días`, clase: CHIP_MUTE }
}

const ICONO_ACTIVIDAD: Record<string, React.ElementType> = {
  guest: Users, party_member: Users, table: LayoutGrid,
  settings: Settings, collaborator: UserPlus,
}

const ESTADO_LABEL: Record<string, string> = {
  active: 'Activo', paused: 'Pausado', cancelled: 'Cancelado', completed: 'Completado',
}

const ROL_LABEL: Record<string, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }

const INVITACION_CHIP: Record<string, { clase: string; texto: string }> = {
  publicada: { clase: CHIP_GOLD, texto: 'Invitación publicada' },
  cambios:   { clase: CHIP_WARN, texto: 'Cambios sin publicar' },
  borrador:  { clase: CHIP_MUTE, texto: 'Invitación en borrador' },
}

// Escala tipografica del tablero. Un solo lugar donde cambiarla.
const T_LABEL   = 'text-[12px] font-semibold uppercase tracking-[0.07em] text-[#999]'
const T_METRICA = 'font-display text-[32px] font-extrabold leading-none tracking-[-0.025em]'
const T_SECCION = 'font-display text-[18px] font-bold tracking-[-0.015em] sm:text-[20px]'
const T_CUERPO  = 'text-[13.5px] text-[#666]'
const T_META    = 'text-[12.5px] text-[#888]'

const CARD = 'rounded-2xl border border-[#E8E8E8] bg-white px-5 py-4'
const BTN_SEC = 'rounded-[10px] border border-[#E0E0E0] bg-[#F8F8F8] px-3.5 py-2 text-[13px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]'

function Barra({ tramos, alto = 'h-2' }: { tramos: { pct: number; color: string }[]; alto?: string }) {
  return (
    <div className={`my-3 flex ${alto} overflow-hidden rounded-full bg-[#F0F0F0]`}>
      {tramos.filter(t => t.pct > 0).map((t, i) => (
        <span key={i} className="block h-full transition-all duration-500" style={{ width: `${t.pct}%`, background: t.color }} />
      ))}
    </div>
  )
}

function Ficha({ valor, label, tono }: { valor: number | string; label: string; tono?: 'aviso' | 'teal' }) {
  const fondo = tono === 'aviso' ? 'bg-[#FFF8E8]' : tono === 'teal' ? 'bg-[#F0FDFB]' : 'bg-[#F8F8F8]'
  const color = tono === 'aviso' ? 'text-[#B8860B]' : tono === 'teal' ? 'text-[#1A9E88]' : 'text-[#1D1E20]'
  return (
    <div className={`rounded-xl px-2 py-3 text-center ${fondo}`}>
      <b className={`block font-display text-[22px] font-extrabold leading-none ${color}`}>{valor}</b>
      <span className="mt-1.5 block text-[12px] text-[#888]">{label}</span>
    </div>
  )
}

type Props = {
  m: EventMetrics
  colaboradores: ColaboradorRow[]
  rol: Rol
  puedeVerDinero: boolean
  usuarioEmail: string
  onAbrirEvento: () => void
}

export default function ContextoEvento({ m, colaboradores, rol, puedeVerDinero, usuarioEmail, onAbrirEvento }: Props) {
  const [now, setNow] = useState(new Date())
  const [copiado, setCopiado] = useState(false)
  const [tareas, setTareas] = useState<TaskRow[]>(m.tareasProximas)
  const [fallo, setFallo] = useState<string | null>(null)
  const [actividad, setActividad] = useState<ActividadRow[]>([])
  const [compacto, setCompacto] = useState(false)
  const sentinela = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // El encabezado compacto aparece cuando el hero sale de vista. Se usa un
  // centinela con IntersectionObserver en vez de un listener de scroll: no
  // dispara render en cada pixel y no necesita saber quien es el contenedor.
  useEffect(() => {
    const el = sentinela.current
    if (!el) return
    const io = new IntersectionObserver(([entrada]) => setCompacto(!entrada.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // El componente recibe `m` por props: al cambiar de evento hay que resembrar
  // el estado local que el marcado optimista mueve.
  useEffect(() => {
    setTareas(m.tareasProximas)
    setFallo(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.event.id])

  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      const { data } = await supabase
        .from('event_audit_log')
        .select('id, action, entity_label, user_name, created_at')
        .eq('event_id', m.event.id)
        .order('created_at', { ascending: false })
        .limit(6)
      if (!cancelado) setActividad((data ?? []) as ActividadRow[])
    }
    cargar()
    return () => { cancelado = true }
  }, [m.event.id])

  const ev = m.event
  const cd = getCountdown(ev, now)
  const org = pctOrganizacion(m)
  const inv = INVITACION_CHIP[m.invitacion] ?? INVITACION_CHIP.borrador
  const acceso = ACCESS_MODES.find(a => a.key === resolveAccessMode(ev.event_type, m.accessMode))
  const urgencias = buildUrgencias([m], { puedeVerDinero })

  // El origin se lee al hacer clic, no en un efecto: guardarlo en estado
  // desincroniza el render del servidor con el del cliente.
  const copiarLink = async () => {
    if (!m.sharedToken) return
    const slug = slugifyEvent({ name: ev.name, host_name: ev.host_name, host_name_2: ev.host_name_2 })
    await navigator.clipboard.writeText(`${window.location.origin}/invitacion/${slug}/${m.sharedToken}`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const marcarHecha = async (id: string) => {
    const previas = tareas
    setTareas(prev => prev.filter(t => t.id !== id))
    setFallo(null)
    const { error } = await supabase.from('event_timeline_tasks').update({ is_completed: true }).eq('id', id)
    if (error) {
      setTareas(previas)
      setFallo(id)
    }
  }

  const totalInv = m.invitados.total || 1
  const tarjetaInvitados = (
    <div key="invitados" className={CARD}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={T_LABEL}>Invitados</span>
        <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#F0FDFB]">
          <Users size={16} className="text-[#1A9E88]" />
        </span>
      </div>
      <p className={T_METRICA}>
        {m.invitados.confirmados}
        <span className="ml-1.5 text-[14px] font-medium tracking-normal text-[#888]">de {m.invitados.total}</span>
      </p>
      <Barra tramos={[
        { pct: (m.invitados.confirmados / totalInv) * 100, color: '#48C9B0' },
        { pct: (m.invitados.pendientes  / totalInv) * 100, color: '#D4A853' },
        { pct: (m.invitados.declinados  / totalInv) * 100, color: '#E4E4E4' },
      ]} />
      <p className={T_CUERPO}>{m.invitados.pendientes} pendientes · {m.invitados.declinados} no asisten</p>
      {m.invitados.atencion > 0 && (
        <span className={`mt-3 ${CHIP_BAD}`}>
          {m.invitados.atencion} {m.invitados.atencion === 1 ? 'requiere' : 'requieren'} atención
        </span>
      )}
    </div>
  )

  const pista = Math.max(m.dinero.estimado, m.dinero.contratado) || 1
  const tarjetaPresupuesto = (
    <div key="presupuesto" className={CARD}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={T_LABEL}>Presupuesto</span>
        <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#FFFBF0]">
          <Briefcase size={16} className="text-[#8A6A1E]" />
        </span>
      </div>
      <p className={T_METRICA}>
        {formatCurrency(m.dinero.estimado, ev.currency)}
        <span className="ml-1.5 text-[14px] font-medium tracking-normal text-[#888]">estimado</span>
      </p>
      {m.dinero.excedido ? (
        <Barra tramos={[{ pct: 100, color: '#CC3333' }]} />
      ) : (
        <Barra tramos={[
          { pct: (m.dinero.pagado   / pista) * 100, color: '#1A9E88' },
          { pct: (m.dinero.porPagar / pista) * 100, color: '#48C9B0' },
        ]} />
      )}
      <div className="flex flex-col gap-1.5 text-[13px]">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[#666]"><i className="h-2 w-2 rounded-full bg-[#1A9E88]" />Pagado</span>
          <b className="font-semibold">{formatCurrency(m.dinero.pagado, ev.currency)}</b>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[#666]"><i className="h-2 w-2 rounded-full bg-[#48C9B0]" />Contratado por pagar</span>
          <b className="font-semibold">{formatCurrency(m.dinero.porPagar, ev.currency)}</b>
        </div>
        <div className="flex items-center justify-between gap-3 text-[#999]">
          <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#EFEFEF]" />Sin contratar</span>
          <b className="font-semibold">{formatCurrency(m.dinero.sinContratar, ev.currency)}</b>
        </div>
      </div>
      {m.dinero.excedido && (
        <span className={`mt-3 ${CHIP_BAD}`}>
          Excedido en {formatCurrency(m.dinero.contratado - m.dinero.estimado, ev.currency)}
        </span>
      )}
    </div>
  )

  const totalProv = m.proveedores.total || 1
  const tarjetaProveedores = (
    <div key="proveedores" className={CARD}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={T_LABEL}>Proveedores</span>
        <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#F5F5F5]">
          <Briefcase size={16} className="text-[#777]" />
        </span>
      </div>
      <p className={T_METRICA}>
        {m.proveedores.contratados}
        <span className="ml-1.5 text-[14px] font-medium tracking-normal text-[#888]">de {m.proveedores.total} contratados</span>
      </p>
      <Barra tramos={[
        { pct: (m.proveedores.contratados / totalProv) * 100, color: '#48C9B0' },
        { pct: (m.proveedores.cotizados   / totalProv) * 100, color: '#D4A853' },
      ]} />
      <p className={T_CUERPO}>{m.proveedores.cotizados} cotizados · {m.proveedores.nuevos} sin cotizar</p>
    </div>
  )

  const tarjetaRegalos = (
    <div key="regalos" className={CARD}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={T_LABEL}>Mesa de regalos</span>
        <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#FFFBF0]">
          <Gift size={16} className="text-[#8A6A1E]" />
        </span>
      </div>
      <p className={T_METRICA}>{formatCurrency(m.regalos.recibido, ev.currency)}</p>
      <Barra tramos={[
        { pct: m.regalos.totalItems > 0 ? (m.regalos.apartados / m.regalos.totalItems) * 100 : 0, color: '#D4A853' },
      ]} />
      <p className={T_CUERPO}>{m.regalos.apartados} de {m.regalos.totalItems} apartados</p>
    </div>
  )

  const tarjetas = puedeVerDinero
    ? (rol === 'planner'
        ? [tarjetaPresupuesto, tarjetaProveedores, tarjetaInvitados, tarjetaRegalos]
        : [tarjetaInvitados, tarjetaRegalos, tarjetaPresupuesto, tarjetaProveedores])
    : [tarjetaInvitados, tarjetaRegalos]

  const pctAcomodado = m.mesas.conLugar + m.mesas.sinLugar > 0
    ? Math.round((m.mesas.conLugar / (m.mesas.conLugar + m.mesas.sinLugar)) * 100)
    : 0

  return (
    <div className="flex flex-col gap-4">

      <div ref={sentinela} className="h-px w-full" aria-hidden />

      <div
        className={
          'sticky top-0 z-30 -mx-4 border-b border-[#E8E8E8] bg-white/85 px-4 backdrop-blur-md transition-all duration-300 ease-out sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 xl:-mx-14 xl:px-14 ' +
          (compacto
            ? 'pointer-events-auto max-h-20 translate-y-0 py-2.5 opacity-100'
            : 'pointer-events-none max-h-0 -translate-y-3 overflow-hidden py-0 opacity-0')
        }
      >
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#48C9B0]" />
          <h2 className="min-w-0 flex-1 truncate font-display text-[17px] font-black tracking-[-0.02em] sm:text-[20px]">
            {ev.name}
          </h2>
          <span className="hidden items-baseline gap-1.5 md:flex">
            <b className="font-display text-[19px] font-black leading-none text-[#1A9E88]">{cd.grande}</b>
            <span className="text-[12.5px] text-[#888]">{cd.unidad}</span>
          </span>
          <span className="hidden h-5 w-px bg-[#E8E8E8] md:block" />
          <span className="hidden items-baseline gap-1.5 lg:flex">
            <b className="font-display text-[19px] font-black leading-none">{m.invitados.confirmados}</b>
            <span className="text-[12.5px] text-[#888]">confirmados</span>
          </span>
          {puedeVerDinero && (
            <>
              <span className="hidden h-5 w-px bg-[#E8E8E8] lg:block" />
              <span className="hidden items-baseline gap-1.5 xl:flex">
                <b className="font-display text-[19px] font-black leading-none">{org}%</b>
                <span className="text-[12.5px] text-[#888]">organizado</span>
              </span>
            </>
          )}
          <button
            onClick={onAbrirEvento}
            className="ml-1 shrink-0 rounded-[10px] bg-[#48C9B0] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#3ab89f] active:scale-95"
          >
            Abrir evento
          </button>
        </div>
      </div>

      <div className={'grid gap-4 ' + (puedeVerDinero ? 'xl:grid-cols-[1.05fr_1fr]' : 'xl:grid-cols-[1.4fr_1fr]')}>

        <div className="relative overflow-hidden rounded-2xl border border-[#e8e8e8] bg-gradient-to-br from-white via-white to-[#f3fbf9] px-6 py-6">
          <div className="pointer-events-none absolute -right-16 -top-24 h-[320px] w-[320px] rounded-full bg-[#48C9B0]/15 blur-3xl" />
          <div className="relative z-10 flex h-full flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className={CHIP_TEAL}>
                <i className="h-2 w-2 rounded-full bg-[#48C9B0]" />
                {ESTADO_LABEL[ev.event_status] ?? ev.event_status}
              </span>
              {ev.event_type && <span className={CHIP_MUTE}>{ev.event_type}</span>}
              <span className={inv.clase}>{inv.texto}</span>
              {acceso && <span className={CHIP_MUTE}>{acceso.label}</span>}
            </div>

            <h2 className="mt-3 font-display text-[34px] font-black leading-[1.02] tracking-[-0.03em] sm:text-[42px]">
              {ev.name}
            </h2>
            <p className="mt-2 text-[14px] text-[#777]">
              {formatEventDate(ev.event_date, ev.event_end_date)}
              {ev.event_time && ` · ${formatTime(ev.event_time)}`}
              {ev.venue && ` · ${ev.venue}`}
            </p>

            <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <p className={T_LABEL}>Faltan</p>
                <p className="mt-1 flex items-baseline gap-2">
                  <b className="font-display text-[52px] font-black leading-[0.85] tracking-[-0.04em] text-[#1A9E88]">{cd.grande}</b>
                  <span className="text-[15px] font-semibold text-[#888]">{cd.unidad}</span>
                </p>
                {cd.chico && <p className="mt-1.5 text-[13px] text-[#999]">{cd.chico}</p>}
              </div>
              <div className="min-w-[180px] flex-1">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className={T_LABEL}>Organización</span>
                  <span className="font-display text-[15px] font-extrabold text-[#1A9E88]">{org}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#EDEDED]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#48C9B0] to-[#1A9E88] transition-all duration-700" style={{ width: `${org}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={onAbrirEvento}
                className="rounded-[10px] bg-[#48C9B0] px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-[#3ab89f] active:scale-95"
              >
                Abrir evento
              </button>
              <button onClick={() => { window.location.href = `/events/${ev.id}/invitacion` }} className={BTN_SEC}>
                Ver invitación
              </button>
              {m.sharedToken && (
                <button onClick={copiarLink} className={BTN_SEC + ' flex items-center gap-2'}>
                  {copiado ? <Check size={14} className="text-[#1A9E88]" /> : <Copy size={14} />}
                  {copiado ? 'Copiado' : 'Copiar link'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={'grid gap-4 ' + (puedeVerDinero ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-1')}>
          {tarjetas}
        </div>
      </div>

      <FeedAtencion urgencias={urgencias} titulo="Requiere tu atención" mostrarEvento={false} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[#E8E8E8] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#E8E8E8] px-5 py-4">
              <div>
                <h3 className={T_SECCION}>Pendientes de la semana</h3>
                <p className={T_META}>Márcalas aquí, sin entrar al timeline</p>
              </div>
              <button onClick={() => { window.location.href = `/events/${ev.id}/timeline` }} className={BTN_SEC + ' shrink-0'}>
                Ver timeline
              </button>
            </div>
            <div className="px-5 py-1">
              {tareas.length === 0 ? (
                <p className="py-8 text-center text-[13.5px] text-[#888]">No hay tareas pendientes.</p>
              ) : tareas.slice(0, 5).map(t => {
                const chip = diasDeTarea(t, now)
                return (
                  <div key={t.id} className="flex items-start gap-3 border-t border-[#F0F0F0] py-3 first:border-t-0">
                    <button
                      onClick={() => marcarHecha(t.id)}
                      aria-label={`Marcar "${t.title}" como hecha`}
                      className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-2 border-[#DDD] bg-white transition hover:border-[#48C9B0] hover:bg-[#F0FDFB]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium leading-[1.35] text-[#1D1E20]">{t.title}</p>
                      <p className={T_META}>
                        {t.category}
                        {t.assigned_to_name && ` · ${t.assigned_to_name}`}
                        {t.priority === 'bloqueante' && ' · bloqueante'}
                      </p>
                    </div>
                    <span className={'shrink-0 ' + (fallo === t.id ? CHIP_BAD : chip.clase)}>
                      {fallo === t.id ? 'No se pudo marcar' : chip.texto}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className={CARD}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className={T_SECCION}>Mesas y acomodo</h3>
              <span className={T_META}>{m.mesas.mesas} mesas · {m.mesas.conGente} con gente</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Ficha valor={m.mesas.conLugar} label="Con lugar" />
              <Ficha valor={m.mesas.sinLugar} label="Sin lugar" tono={m.mesas.sinLugar > 0 ? 'aviso' : undefined} />
              <Ficha valor={m.mesas.sillasLibres} label="Sillas libres" />
              <Ficha valor={`${pctAcomodado}%`} label="Acomodado" tono="teal" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[#E8E8E8] bg-white">
            <div className="border-b border-[#E8E8E8] px-5 py-4">
              <h3 className={T_SECCION}>Actividad reciente</h3>
            </div>
            <div className="px-5 py-1">
              {actividad.length === 0 ? (
                <p className="py-8 text-center text-[13.5px] text-[#888]">Todavía no hay actividad en este evento.</p>
              ) : actividad.map(a => {
                const Icono = ICONO_ACTIVIDAD[a.action.split('.')[0]] ?? Activity
                return (
                  <div key={a.id} className="flex items-start gap-3 border-t border-[#F0F0F0] py-3 first:border-t-0">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-[#EEE] bg-[#F8F8F8]">
                      <Icono size={15} className="text-[#888]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-[#1D1E20]">
                        {AUDIT_ACTION_LABEL[a.action as AuditAction] ?? a.action}
                        {a.entity_label && <span className="font-normal text-[#777]"> · {a.entity_label}</span>}
                      </p>
                      <p className={'truncate ' + T_META}>{a.user_name || 'Alguien'} · {haceCuanto(a.created_at, now)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[#E8E8E8] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#E8E8E8] px-5 py-4">
              <h3 className={T_SECCION}>Equipo</h3>
              <button onClick={() => { window.location.href = `/events/${ev.id}/configuracion` }} className={BTN_SEC + ' shrink-0'}>
                + Invitar
              </button>
            </div>
            <div className="px-5 py-1">
              {[
                {
                  id: 'owner',
                  nombre: ev.is_shared ? (ev.owner_name || 'El dueño') : (usuarioEmail || 'Tú'),
                  rol: 'Dueño',
                },
                ...colaboradores.map(c => ({
                  id: c.event_id + c.email,
                  nombre: c.full_name || c.email,
                  rol: ROL_LABEL[c.role] ?? c.role,
                })),
              ].map(p => (
                <div key={p.id} className="flex items-center gap-3 border-t border-[#F0F0F0] py-3 first:border-t-0">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F0FDFB] text-[13px] font-bold text-[#1A9E88]">
                    {p.nombre.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#1D1E20]">{p.nombre}</span>
                  <span className={'shrink-0 ' + CHIP_MUTE}>{p.rol}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
