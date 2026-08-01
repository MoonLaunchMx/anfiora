'use client'

import { useEffect, useState } from 'react'
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
  const cabezas = m.mesas.conLugar + m.mesas.sinLugar
  const acomodado = cabezas > 0 ? (m.mesas.conLugar / cabezas) * 100 : 0
  const totalTareas = m.tareas.vencidas + m.tareas.hoy + m.tareas.proximas
  const alDia = totalTareas > 0 ? ((totalTareas - m.tareas.vencidas) / totalTareas) * 100 : 0
  return Math.round((m.invitados.pctConfirmado + Math.min(100, m.dinero.pctContratado) + acomodado + alDia) / 4)
}

function diasDeTarea(t: TaskRow, hoy: Date): { texto: string; clase: string } {
  if (!t.task_date) return { texto: '', clase: '' }
  const [y, mo, d] = t.task_date.split('T')[0].split('-').map(Number)
  const dias = Math.round(
    (new Date(y, mo - 1, d).getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000,
  )
  if (dias < 0)  return { texto: dias === -1 ? 'Vencida ayer' : `Vencida hace ${Math.abs(dias)} días`, clase: CHIP_BAD }
  if (dias === 0) return { texto: 'Hoy', clase: CHIP_WARN }
  if (dias === 1) return { texto: 'Mañana', clase: CHIP_MUTE }
  return { texto: `En ${dias} días`, clase: CHIP_MUTE }
}

const ICONO_ACTIVIDAD: Record<string, React.ElementType> = {
  guest: Users, party_member: Users, table: LayoutGrid,
  settings: Settings, collaborator: UserPlus,
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

const ROL_LABEL: Record<string, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }

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

function Ficha({ valor, label, tono }: { valor: number | string; label: string; tono?: 'aviso' | 'teal' }) {
  const fondo = tono === 'aviso' ? 'bg-[#FFF8E8]' : tono === 'teal' ? 'bg-[#F0FDFB]' : 'bg-[#F8F8F8]'
  const color = tono === 'aviso' ? 'text-[#B8860B]' : tono === 'teal' ? 'text-[#1A9E88]' : 'text-[#1D1E20]'
  return (
    <div className={`rounded-[10px] px-1.5 py-2.5 text-center ${fondo}`}>
      <b className={`block font-display text-[17px] font-extrabold leading-[1.1] ${color}`}>{valor}</b>
      <span className="mt-0.5 block text-[9.5px] text-[#888]">{label}</span>
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

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
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
          <Briefcase size={13} className="text-[#8A6A1E]" />
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

  const pctAcomodado = m.mesas.conLugar + m.mesas.sinLugar > 0
    ? Math.round((m.mesas.conLugar / (m.mesas.conLugar + m.mesas.sinLugar)) * 100)
    : 0

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

      <div className={'grid grid-cols-1 gap-3 md:grid-cols-2 ' + (puedeVerDinero ? 'xl:grid-cols-4' : 'xl:grid-cols-2')}>
        {tarjetas}
      </div>

      <FeedAtencion urgencias={urgencias} titulo="Requiere tu atención" mostrarEvento={false} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

        <div className="flex flex-col gap-3">
          <div className="rounded-[13px] border border-[#E8E8E8] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#E8E8E8] px-[15px] py-3">
              <div>
                <h3 className="font-display text-[13.5px] font-bold tracking-[-0.01em]">Pendientes de la semana</h3>
                <p className="text-[11px] text-[#888]">Márcalas aquí, sin entrar al timeline</p>
              </div>
              <button
                onClick={() => { window.location.href = `/events/${ev.id}/timeline` }}
                className="shrink-0 rounded-[9px] border border-[#E0E0E0] bg-[#F8F8F8] px-3 py-1.5 text-[11.5px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]"
              >
                Ver timeline
              </button>
            </div>
            <div className="px-[15px] py-1">
              {tareas.length === 0 ? (
                <p className="py-7 text-center text-xs text-[#888]">No hay tareas pendientes.</p>
              ) : tareas.slice(0, 5).map(t => {
                const chip = diasDeTarea(t, now)
                return (
                  <div key={t.id} className="flex items-start gap-2.5 border-t border-[#F0F0F0] py-2.5 first:border-t-0">
                    <button
                      onClick={() => marcarHecha(t.id)}
                      aria-label={`Marcar "${t.title}" como hecha`}
                      className="mt-0.5 grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] border-[1.5px] border-[#E0E0E0] bg-white transition hover:border-[#48C9B0] hover:bg-[#F0FDFB]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium leading-[1.35] text-[#1D1E20]">{t.title}</p>
                      <p className="text-[11px] text-[#888]">
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
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <span className={LABEL}>Mesas y acomodo</span>
              <span className="text-[11px] text-[#888]">{m.mesas.mesas} mesas · {m.mesas.conGente} con gente</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Ficha valor={m.mesas.conLugar} label="Con lugar" />
              <Ficha valor={m.mesas.sinLugar} label="Sin lugar" tono={m.mesas.sinLugar > 0 ? 'aviso' : undefined} />
              <Ficha valor={m.mesas.sillasLibres} label="Sillas libres" />
              <Ficha valor={`${pctAcomodado}%`} label="Acomodado" tono="teal" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-[13px] border border-[#E8E8E8] bg-white">
            <div className="border-b border-[#E8E8E8] px-[15px] py-3">
              <h3 className="font-display text-[13.5px] font-bold tracking-[-0.01em]">Actividad reciente</h3>
            </div>
            <div className="px-[15px] py-1">
              {actividad.length === 0 ? (
                <p className="py-7 text-center text-xs text-[#888]">Todavía no hay actividad en este evento.</p>
              ) : actividad.map(a => {
                const Icono = ICONO_ACTIVIDAD[a.action.split('.')[0]] ?? Activity
                return (
                  <div key={a.id} className="flex items-start gap-2.5 border-t border-[#F0F0F0] py-2.5 first:border-t-0">
                    <span className="mt-px grid h-7 w-7 shrink-0 place-items-center rounded-[9px] border border-[#E8E8E8] bg-[#F8F8F8]">
                      <Icono size={13} className="text-[#888]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-[#1D1E20]">
                        {AUDIT_ACTION_LABEL[a.action as AuditAction] ?? a.action}
                        {a.entity_label && <span className="font-normal text-[#666]"> · {a.entity_label}</span>}
                      </p>
                      <p className="truncate text-[11px] text-[#888]">
                        {a.user_name || 'Alguien'} · {haceCuanto(a.created_at, now)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-[13px] border border-[#E8E8E8] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#E8E8E8] px-[15px] py-3">
              <h3 className="font-display text-[13.5px] font-bold tracking-[-0.01em]">Equipo</h3>
              <button
                onClick={() => { window.location.href = `/events/${ev.id}/configuracion` }}
                className="shrink-0 rounded-[9px] border border-[#E0E0E0] bg-[#F8F8F8] px-3 py-1.5 text-[11.5px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]"
              >
                + Invitar
              </button>
            </div>
            <div className="px-[15px] py-1">
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
                <div key={p.id} className="flex items-center gap-2.5 border-t border-[#F0F0F0] py-2.5 first:border-t-0">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F0FDFB] text-[11px] font-bold text-[#1A9E88]">
                    {p.nombre.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[#1D1E20]">{p.nombre}</span>
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
