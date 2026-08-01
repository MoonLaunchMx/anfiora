'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { EventStatus } from '@/lib/types'
import { loadDashboard } from '@/lib/dashboard/load'
import type { ColaboradorRow, Contexto, EventMetrics, Rol } from '@/lib/dashboard/types'
import EventSelector from './EventSelector'
import ContextoEvento from './ContextoEvento'
import ContextoCartera from './ContextoCartera'
import { Bell, Layers, MessageSquarePlus } from 'lucide-react'
import { WhatsNewModal } from '@/app/components/WhatsNewModal'
import { NewEventModal } from '@/app/components/NewEventModal'
import { OnboardingModal } from '@/app/components/OnboardingModal'

export const dynamic = 'force-dynamic'

// El dashboard es una pantalla de tablero: usa todo el ancho disponible, sin
// tope de columna, para que las cuatro tarjetas y la cartera respiren.
const CONTENEDOR = 'w-full px-4 sm:px-6 lg:px-10 xl:px-14'

type ReminderTask = {
  id: string
  event_id: string
  title: string
  category: string
  reminder_date: string
  event_name?: string
}

function ReminderCategoryIcon({ category }: { category: string }) {
  const s = {
    width: 13, height: 13, viewBox: "0 0 24 24",
    fill: "none", stroke: "#888", strokeWidth: 1.5,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  }
  const icons: Record<string, React.ReactElement> = {
    evento:       <svg {...s}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
    tarea:        <svg {...s}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
    recordatorio: <svg {...s}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
    reunion:      <svg {...s}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    entrega:      <svg {...s}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    pago:         <svg {...s}><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
    comunicacion: <svg {...s}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    otro:         <svg {...s}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>,
  }
  return icons[category] || icons.otro
}

function formatReminderDate(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  if (target.getTime() === today.getTime()) return 'Hoy'
  if (target.getTime() < today.getTime()) return 'Vencido'
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function Dashboard() {
  const [loading, setLoading]             = useState(true)
  const [userEmail, setUserEmail]         = useState('')
  const [reminders, setReminders]         = useState<ReminderTask[]>([])
  const [showBellMenu, setShowBellMenu]   = useState(false)
  const [showNewEvent, setShowNewEvent]   = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [metrics, setMetrics]             = useState<EventMetrics[]>([])
  const [rol, setRol]                     = useState<Rol>(null)
  const [colaboradores, setColaboradores] = useState<ColaboradorRow[]>([])
  const [contexto, setContexto]           = useState<Contexto>({ kind: 'cartera' })
  const [ultimoEvento, setUltimoEvento]   = useState<string | null>(null)

  useEffect(() => { init() }, [])

  // El anfitrion tiene un solo evento: arrancar en cartera le muestra una
  // tarjeta sola. El planner necesita ver el panorama primero.
  useEffect(() => {
    if (loading || metrics.length === 0) return
    const activos = metrics.filter(m => m.event.event_status === 'active')
    if (rol === 'planner' || activos.length > 1) setContexto({ kind: 'cartera' })
    else if (activos[0]) setContexto({ kind: 'evento', eventId: activos[0].event.id })
  }, [loading, metrics, rol])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-bell]')) setShowBellMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Una sola lectura de sesion para toda la pantalla: cada getUser() toma un
  // candado global exclusivo en el cliente de Supabase, y varias en paralelo se
  // encolan hasta agotar el timeout de 5s en redes lentas.
  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }
    checkAuth(user)
    loadData(user)
  }

  const checkAuth = async (user: User) => {
    setUserEmail(user.email || '')
    const { data: profile, error: profErr } = await supabase
      .from('users').select('role').eq('id', user.id).single()
    if (!profErr && profile && !profile.role) {
      setShowOnboarding(true)
      return
    }
    if (!localStorage.getItem('gf_welcomed')) localStorage.setItem('gf_welcomed', '1')
  }

  const loadData = async (user: User) => {
    const data = await loadDashboard(user.id)

    setMetrics(data.metrics)
    setRol(data.rol)
    setColaboradores(data.colaboradores)

    const allEventIds = data.metrics.map(m => m.event.id)
    if (allEventIds.length === 0) {
      setReminders([])
      setLoading(false)
      return
    }

    const today = new Date()
    today.setHours(23, 59, 59, 999)

    const remindersRes = await supabase
      .from('event_timeline_tasks')
      .select('id, event_id, title, category, reminder_date')
      .in('event_id', allEventIds)
      .not('reminder_date', 'is', null)
      .eq('is_completed', false)
      .lte('reminder_date', today.toISOString())

    if (remindersRes.error) console.error('recordatorios:', remindersRes.error)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reminderData = (remindersRes.data || []) as any[]

    setReminders(reminderData.map(r => ({
      ...r,
      event_name: data.metrics.find(m => m.event.id === r.event_id)?.event.name || '',
    })) as ReminderTask[])
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const cambiarEstado = async (eventId: string, estado: EventStatus) => {
    setMetrics(prev => prev.map(m =>
      m.event.id === eventId ? { ...m, event: { ...m.event, event_status: estado } } : m
    ))
    await supabase.from('events').update({ event_status: estado }).eq('id', eventId)
  }

  const markDone = async (id: string) => {
    await supabase.from('event_timeline_tasks').update({ is_completed: true }).eq('id', id)
    setReminders(prev => prev.filter(x => x.id !== id))
  }

  const markAllDone = async () => {
    await supabase
      .from('event_timeline_tasks')
      .update({ is_completed: true })
      .in('id', reminders.map(r => r.id))
    setReminders([])
  }

  const elegirContexto = (c: Contexto) => {
    if (c.kind === 'evento') setUltimoEvento(c.eventId)
    setContexto(c)
  }

  const totalReminders = reminders.length

  const totalAlertas = metrics
    .filter(m => m.event.event_status === 'active')
    .reduce((s, m) => s + m.tareas.vencidas, 0)

  const enFoco = contexto.kind === 'evento'
    ? metrics.find(m => m.event.id === contexto.eventId) ?? null
    : null

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f8f8f8] font-sans text-[#1D1E20]">

      <WhatsNewModal />
      <OnboardingModal open={showOnboarding} onCompleted={() => setShowOnboarding(false)} />

      <header className="shrink-0 border-b border-[#e8e8e8] bg-white">
        <div className={'flex h-14 items-center justify-between gap-3 sm:h-16 sm:gap-4 ' + CONTENEDOR}>
          <button onClick={() => window.location.href = '/dashboard'} className="shrink-0">
            <img src="/images/isotipo.svg" alt="Anfiora" className="h-11 w-11 sm:hidden" />
            <img src="/images/logo.svg" alt="Anfiora" className="hidden h-11 sm:block lg:h-14" />
          </button>
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <div data-bell className="relative">
              <button
                onClick={() => setShowBellMenu(p => !p)}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e0e0] text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
              >
                <Bell size={15} />
                {totalReminders > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#48C9B0] text-[9px] font-bold text-white">
                    {totalReminders > 9 ? '9+' : totalReminders}
                  </span>
                )}
              </button>
              {showBellMenu && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-2.5">
                    <p className="text-xs font-semibold text-[#1D1E20]">Recordatorios</p>
                    {reminders.length > 0 && (
                      <button onClick={markAllDone} className="text-[11px] text-[#aaa] transition hover:text-[#48C9B0]">
                        Marcar todos
                      </button>
                    )}
                  </div>
                  {reminders.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-xs text-[#aaa]">Sin recordatorios pendientes</p>
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {reminders.map(r => (
                        <div key={r.id} className="flex items-center gap-3 border-b border-[#f5f5f5] px-4 py-2.5 last:border-0">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-[#e8e8e8] bg-[#f8f8f8]">
                            <ReminderCategoryIcon category={r.category} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-[#1D1E20]">{r.title}</p>
                            <p className="truncate text-[11px] text-[#aaa]">
                              {r.event_name}
                              <span className={`ml-1 ${formatReminderDate(r.reminder_date) === 'Vencido' ? 'text-red-400' : 'text-[#aaa]'}`}>
                                · {formatReminderDate(r.reminder_date)}
                              </span>
                            </p>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-1.5">
                            <button title="Marcar como hecha" onClick={() => markDone(r.id)}
                              className="flex h-6 w-6 items-center justify-center rounded-md bg-[#E1F5EE] transition hover:bg-[#9FE1CB]">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5"/>
                              </svg>
                            </button>
                            <button title="Abrir tarea"
                              onClick={() => { setShowBellMenu(false); window.location.href = '/events/' + r.event_id + '/timeline?task=' + r.id }}
                              className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f8f8f8] transition hover:bg-[#e8e8e8]">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('anfiora:open-feedback'))}
              title="Enviar feedback"
              className="rounded-lg border border-[#e0e0e0] p-2 text-[#888] transition hover:border-[#48C9B0] hover:text-[#1a9e88]"
            >
              <MessageSquarePlus size={16} />
            </button>
            <button
              onClick={() => window.location.href = '/perfil'}
              title="Mi perfil"
              className="flex items-center gap-2 rounded-lg border border-[#e0e0e0] p-1 transition hover:border-[#48C9B0] sm:pr-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0fdfb] text-xs font-bold text-[#1a9e88]">
                {(userEmail || '?').charAt(0).toUpperCase()}
              </span>
              <span className="hidden truncate text-xs text-[#888] sm:block sm:max-w-[160px] sm:text-sm">{userEmail}</span>
            </button>
            <button onClick={handleLogout} className="rounded-md border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#888] transition hover:bg-[#f5f5f5] sm:px-4 sm:text-sm">Salir</button>
          </div>
        </div>
      </header>

      <div className="shrink-0 border-b border-[#e8e8e8] bg-white">
        <div className={CONTENEDOR + ' flex h-12 items-center gap-2 sm:gap-3'}>
          <button
            onClick={() => setContexto({ kind: 'cartera' })}
            className={'flex shrink-0 items-center gap-2 rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-semibold transition sm:px-3 ' + (
              contexto.kind === 'cartera'
                ? 'bg-[#1D1E20] text-white'
                : 'border border-[#E0E0E0] bg-white text-[#1D1E20] hover:border-[#48C9B0]'
            )}
          >
            <Layers size={13} />
            <span className="hidden sm:inline">Cartera</span>
            {totalAlertas > 0 && (
              <span className={'rounded-full px-1.5 py-px text-[10px] font-bold ' + (
                contexto.kind === 'cartera' ? 'bg-white/15 text-white' : 'bg-[#FFF0F0] text-[#CC3333]'
              )}>
                {totalAlertas}
              </span>
            )}
          </button>

          <span className="h-5 w-px shrink-0 bg-[#e8e8e8]" />

          {!loading && metrics.length > 0 && (
            <EventSelector
              metrics={metrics}
              contexto={contexto}
              onChange={elegirContexto}
              onNuevoEvento={() => setShowNewEvent(true)}
            />
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              onClick={() => setShowNewEvent(true)}
              className="rounded-[9px] bg-[#48C9B0] px-3 py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-[#3ab89f] active:scale-95 sm:px-4"
            >
              <span className="sm:hidden">+ Nuevo</span>
              <span className="hidden sm:inline">+ Nuevo evento</span>
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={CONTENEDOR + ' py-4 pb-8'}>
          {contexto.kind === 'evento' && enFoco ? (
            <ContextoEvento
              m={enFoco}
              colaboradores={colaboradores.filter(c => c.event_id === enFoco.event.id)}
              rol={rol}
              usuarioEmail={userEmail}
              puedeVerDinero={enFoco.event.shared_role !== 'viewer'}
              onAbrirEvento={() => { window.location.href = '/events/' + enFoco.event.id }}
            />
          ) : (
            <ContextoCartera
              metrics={metrics}
              rol={rol}
              loading={loading}
              eventoPrevio={ultimoEvento}
              onElegirEvento={id => elegirContexto({ kind: 'evento', eventId: id })}
              onNuevoEvento={() => setShowNewEvent(true)}
              onCambiarEstado={cambiarEstado}
            />
          )}
        </div>
      </div>

      <NewEventModal
        open={showNewEvent}
        onClose={() => setShowNewEvent(false)}
        onCreated={(eventId) => {
          setShowNewEvent(false)
          window.location.href = '/events/' + eventId
        }}
      />

    </div>
  )
}
