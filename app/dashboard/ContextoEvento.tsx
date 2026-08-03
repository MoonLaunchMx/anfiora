'use client'

import { useEffect, useState } from 'react'
import { Activity, LayoutGrid, Settings, UserPlus, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AUDIT_ACTION_LABEL, type AuditAction } from '@/lib/audit'
import { haceCuanto } from '@/lib/dashboard/salud'
import { buildUrgencias } from '@/lib/dashboard/urgencias'
import { CIFRAS_BASE, cifrasDisponibles, type CifraId } from '@/lib/dashboard/tablero'
import BannerEvento from './BannerEvento'
import FeedAtencion from './FeedAtencion'
import type { ColaboradorRow, EventMetrics, Rol, TaskRow } from '@/lib/dashboard/types'

type ActividadRow = {
  id: string
  action: string
  entity_label: string | null
  user_name: string | null
  created_at: string
}

const CHIP_BASE = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap'
const CHIP_MUTE = `${CHIP_BASE} border-[#E8E8E8] bg-[#F8F8F8] text-[#777]`
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

const ROL_LABEL: Record<string, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }

// Escala tipografica del tablero. Un solo lugar donde cambiarla.
const T_SECCION = 'font-display text-[18px] font-bold tracking-[-0.015em] sm:text-[20px]'
const T_META    = 'text-[12.5px] text-[#888]'

const CARD = 'rounded-2xl border border-[#E8E8E8] bg-white px-5 py-4'
const BTN_SEC = 'rounded-[10px] border border-[#E0E0E0] bg-[#F8F8F8] px-3.5 py-2 text-[13px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]'

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

export default function ContextoEvento({ m, colaboradores, puedeVerDinero, usuarioEmail, onAbrirEvento }: Props) {
  const [now, setNow] = useState(new Date())
  const [tareas, setTareas] = useState<TaskRow[]>(m.tareasProximas)
  const [fallo, setFallo] = useState<string | null>(null)
  const [actividad, setActividad] = useState<ActividadRow[]>([])

  // Un tic por minuto alcanza: la urgencia de una tarea y el "hace cuanto" de la
  // actividad se miden en minutos y horas, no en segundos.
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000)
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
  const urgencias = buildUrgencias([m], { puedeVerDinero })

  // Paso intermedio: las cifras del banner todavia no se guardan por evento.
  // Se muestran las de fabrica que apliquen; el selector se enciende cuando
  // aterrice la columna dashboard_layout.
  const cifrasDisp = cifrasDisponibles(ev.event_type, null, puedeVerDinero)
  const cifras: CifraId[] = CIFRAS_BASE.filter(c => cifrasDisp.includes(c))

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

  const pctAcomodado = m.mesas.conLugar + m.mesas.sinLugar > 0
    ? Math.round((m.mesas.conLugar / (m.mesas.conLugar + m.mesas.sinLugar)) * 100)
    : 0

  return (
    <div className="flex flex-col gap-4">

      <BannerEvento
        m={m}
        cifras={cifras}
        cifrasDisp={cifrasDisp}
        modoPersonalizar={false}
        onCambiarCifra={() => {}}
        onAbrirEvento={onAbrirEvento}
      />

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
