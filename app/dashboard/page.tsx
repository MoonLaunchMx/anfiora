'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Event, EventStatus } from '@/lib/types'
import { Bell } from 'lucide-react'
import { WhatsNewModal } from '@/app/components/WhatsNewModal'
import { NewEventModal } from '@/app/components/NewEventModal'
import { OnboardingModal } from '@/app/components/OnboardingModal'

export const dynamic = 'force-dynamic'

type EventWithStats = Event & {
  confirmed: number
  pending: number
  declined: number
  total: number
  pendingReminders: number
  is_shared?: boolean
  shared_role?: 'admin' | 'editor' | 'viewer'
  owner_name?: string | null
}

type Tab = 'activos' | 'pasados' | 'pausados' | 'cancelados'

type ReminderTask = {
  id: string
  event_id: string
  title: string
  category: string
  reminder_date: string
  event_name?: string
}

const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfESosGtmv8JPds_zhTw280121oV1h09WNIbAhW-IyCAFq8cw/viewform?usp=publish-editor'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
}

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-[#E1F5EE] text-[#0F6E56]',
  editor: 'bg-[#FAEEDA] text-[#854F0B]',
  viewer: 'bg-[#f1efe8] text-[#444441]',
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

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-white px-4 py-4 sm:px-5 sm:py-4 animate-pulse">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 h-4 w-3/5 rounded bg-[#f0f0f0]" />
          <div className="h-3 w-2/5 rounded bg-[#f0f0f0]" />
        </div>
        <div className="h-7 w-7 shrink-0 rounded-lg bg-[#f0f0f0]" />
      </div>
      <div className="mb-3 grid grid-cols-4 gap-2">
        {[1,2,3,4].map(j => <div key={j} className="h-12 rounded-lg bg-[#f8f8f8]" />)}
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <div className="h-2 w-20 rounded bg-[#f0f0f0]" />
          <div className="h-2 w-8 rounded bg-[#f0f0f0]" />
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#f0f0f0]" />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [myEvents, setMyEvents]         = useState<EventWithStats[]>([])
  const [sharedEvents, setSharedEvents] = useState<EventWithStats[]>([])
  const [loading, setLoading]           = useState(true)
  const [userEmail, setUserEmail]       = useState('')
  const [sortAsc, setSortAsc]           = useState(true)
  const [now, setNow]                   = useState(new Date())
  const [activeTab, setActiveTab]       = useState<Tab>('activos')
  const [openMenuId, setOpenMenuId]     = useState<string | null>(null)
  const [showWelcome, setShowWelcome]   = useState(false)
  const [reminders, setReminders]       = useState<ReminderTask[]>([])
  const [showBellMenu, setShowBellMenu] = useState(false)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => { checkAuth(); loadData() }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-menu]')) setOpenMenuId(null)
      if (!target.closest('[data-bell]')) setShowBellMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }
    setUserEmail(user.email || '')
    const { data: profile, error: profErr } = await supabase
      .from('users').select('role').eq('id', user.id).single()
    if (!profErr && profile && !profile.role) {
      setShowOnboarding(true)
      return
    }
    const welcomed = localStorage.getItem('gf_welcomed')
    if (!welcomed) { setShowWelcome(true); localStorage.setItem('gf_welcomed', '1') }
  }

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const userId = user.id

    const [myRes, collabRes] = await Promise.all([
      supabase
        .from('events')
        .select('id, name, event_date, event_end_date, event_time, venue, total_guests, event_status')
        .eq('user_id', userId)
        .order('event_date', { ascending: true }),
      supabase
        .from('event_collaborators')
        .select(`
          role,
          event:event_id (
            id, name, event_date, event_end_date, event_time, venue, total_guests, event_status, user_id,
            owner:user_id ( full_name )
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active'),
    ])

    const myEventsData = myRes.data || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collabRows = (collabRes.data || []) as any[]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sharedRaw: any[] = collabRows
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => {
        if (!c.event) return null
        return {
          ...c.event,
          shared_role: c.role,
          is_shared: true,
          owner_name: c.event.owner?.full_name || null,
        }
      })
      .filter(Boolean)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const myIds = myEventsData.map((e: any) => e.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sharedIds = sharedRaw.map((e: any) => e.id)
    const allEventIds = [...myIds, ...sharedIds]

    if (allEventIds.length === 0) {
      setMyEvents([])
      setSharedEvents([])
      setReminders([])
      setLoading(false)
      return
    }

    const today = new Date()
    today.setHours(23, 59, 59, 999)

    const [guestsRes, membersRes, remindersRes] = await Promise.all([
      supabase
        .from('guests')
        .select('event_id, rsvp_status')
        .in('event_id', allEventIds),
      supabase
        .from('party_members')
        .select('event_id, rsvp_status')
        .in('event_id', allEventIds),
      myIds.length > 0
        ? supabase
            .from('timeline_tasks')
            .select('id, event_id, title, category, reminder_date')
            .in('event_id', myIds)
            .not('reminder_date', 'is', null)
            .eq('is_completed', false)
            .lte('reminder_date', today.toISOString())
        : Promise.resolve({ data: [] }),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const guestsByEvent: Record<string, any[]> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membersByEvent: Record<string, any[]> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const g of (guestsRes.data || []) as any[]) {
      if (!guestsByEvent[g.event_id]) guestsByEvent[g.event_id] = []
      guestsByEvent[g.event_id].push(g)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const m of (membersRes.data || []) as any[]) {
      if (!membersByEvent[m.event_id]) membersByEvent[m.event_id] = []
      membersByEvent[m.event_id].push(m)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reminderData = (remindersRes.data || []) as any[]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const computeStats = (event: any): EventWithStats => {
      const guests = guestsByEvent[event.id] || []
      const members = membersByEvent[event.id] || []
      const all = [...guests, ...members]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pendingReminders = reminderData.filter((r: any) => r.event_id === event.id).length
      return {
        ...event,
        event_status: event.event_status || 'active',
        total: all.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        confirmed: all.filter((g: any) => g.rsvp_status === 'confirmed').length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pending:   all.filter((g: any) => g.rsvp_status === 'pending').length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        declined:  all.filter((g: any) => g.rsvp_status === 'declined').length,
        pendingReminders,
      }
    }

    const myEventsWithStats = myEventsData.map(computeStats)
    const sharedEventsWithStats = sharedRaw.map(computeStats)

    const allEventsForLookup = [...myEventsData, ...sharedRaw]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedReminders: ReminderTask[] = reminderData.map((r: any) => ({
      ...r,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event_name: allEventsForLookup.find((e: any) => e.id === r.event_id)?.name || '',
    }))

    setMyEvents(myEventsWithStats)
    setSharedEvents(sharedEventsWithStats)
    setReminders(enrichedReminders)
    setLoading(false)
  }

  const handleStatusChange = async (event: EventWithStats, newStatus: EventStatus, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenMenuId(null)
    if (event.is_shared) return
    setMyEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, event_status: newStatus } : ev))
    await supabase.from('events').update({ event_status: newStatus }).eq('id', event.id)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const getEventDateTime = (event: Event): Date => {
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  const formatTime = (time: string | null) => {
    if (!time) return ''
    const [h, m] = time.split(':').map(Number)
    const ampm = h >= 12 ? 'pm' : 'am'
    const h12 = h % 12 || 12
    return h12 + ':' + m.toString().padStart(2, '0') + ' ' + ampm
  }

  const formatReminderDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(d)
    target.setHours(0, 0, 0, 0)
    if (target.getTime() === today.getTime()) return 'Hoy'
    if (target.getTime() < today.getTime()) return 'Vencido'
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  }

  const getCountdown = (event: Event): string => {
    const target = getEventDateTime(event)
    const diff = target.getTime() - now.getTime()
    if (diff <= 0) return '¡Es hoy!'
    const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24))
    const months    = Math.floor(totalDays / 30)
    const days      = totalDays % 30
    const hours     = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes   = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds   = Math.floor((diff % (1000 * 60)) / 1000)
    if (totalDays >= 1) {
      if (months > 0) return `${months}m ${days}d ${hours}h`
      return `${days}d ${hours}h`
    }
    return `${hours}h ${minutes}m ${seconds}s`
  }

  const confirmPct = (e: EventWithStats) =>
    e.total > 0 ? Math.round((e.confirmed / e.total) * 100) : 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const isUpcoming = (e: Event) => {
    const d = getEventDateTime(e)
    d.setHours(0, 0, 0, 0)
    return d >= today
  }

  const filterByTab = (list: EventWithStats[]) => {
    const active = list
      .filter(e => e.event_status === 'active' && isUpcoming(e))
      .sort((a, b) => {
        const diff = getEventDateTime(a).getTime() - getEventDateTime(b).getTime()
        return sortAsc ? diff : -diff
      })
    const past = list
      .filter(e => e.event_status === 'active' && !isUpcoming(e))
      .sort((a, b) => getEventDateTime(b).getTime() - getEventDateTime(a).getTime())
    const paused = list
      .filter(e => e.event_status === 'paused')
      .sort((a, b) => getEventDateTime(b).getTime() - getEventDateTime(a).getTime())
    const cancelled = list
      .filter(e => e.event_status === 'cancelled')
      .sort((a, b) => getEventDateTime(b).getTime() - getEventDateTime(a).getTime())
    return { active, past, paused, cancelled }
  }

  const myFiltered = filterByTab(myEvents)
  const sharedFiltered = filterByTab(sharedEvents)

  const currentMy =
    activeTab === 'activos'    ? myFiltered.active :
    activeTab === 'pasados'    ? myFiltered.past :
    activeTab === 'pausados'   ? myFiltered.paused :
    myFiltered.cancelled

  const currentShared =
    activeTab === 'activos'    ? sharedFiltered.active :
    activeTab === 'pasados'    ? sharedFiltered.past :
    activeTab === 'pausados'   ? sharedFiltered.paused :
    sharedFiltered.cancelled

  const nextCandidates = [
    ...myFiltered.active,
    ...sharedFiltered.active.filter(e => e.shared_role !== 'viewer'),
  ].sort((a, b) => getEventDateTime(a).getTime() - getEventDateTime(b).getTime())

  const nextEvent = nextCandidates[0] || null

  const sameDay = nextEvent
    ? nextCandidates.filter(e =>
        e.id !== nextEvent.id &&
        e.event_date?.split('T')[0] === nextEvent.event_date?.split('T')[0]
      )
    : []

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'activos',    label: 'Activos',    count: myFiltered.active.length    + sharedFiltered.active.length    },
    { key: 'pasados',    label: 'Pasados',    count: myFiltered.past.length      + sharedFiltered.past.length      },
    { key: 'pausados',   label: 'Pausados',   count: myFiltered.paused.length    + sharedFiltered.paused.length    },
    { key: 'cancelados', label: 'Cancelados', count: myFiltered.cancelled.length + sharedFiltered.cancelled.length },
  ]

  const getMenuOptions = (event: EventWithStats) => {
    const all: { label: string; status: EventStatus; color?: string }[] = [
      { label: '● Activo',    status: 'active' },
      { label: '⏸ Pausado',   status: 'paused' },
      { label: '✕ Cancelado', status: 'cancelled', color: '#cc3333' },
    ]
    return all.filter(o => o.status !== event.event_status)
  }

  const totalReminders = reminders.length

  const markDone = async (id: string) => {
    await supabase.from('timeline_tasks').update({ is_completed: true }).eq('id', id)
    const target = reminders.find(r => r.id === id)
    setReminders(prev => prev.filter(x => x.id !== id))
    if (target) {
      setMyEvents(prev => prev.map(e => ({
        ...e,
        pendingReminders: e.id === target.event_id ? Math.max(0, e.pendingReminders - 1) : e.pendingReminders,
      })))
    }
  }

  const markAllDone = async () => {
    await supabase
      .from('timeline_tasks')
      .update({ is_completed: true })
      .in('id', reminders.map(r => r.id))
    setReminders([])
    setMyEvents(prev => prev.map(e => ({ ...e, pendingReminders: 0 })))
  }

  const EventCard = ({ event }: { event: EventWithStats }) => {
    const pct = confirmPct(event)
    const isNext = event.id === nextEvent?.id
    const isDimmed = activeTab !== 'activos'
    const menuOpen = openMenuId === event.id

    return (
      <div
        onClick={() => window.location.href = '/events/' + event.id}
        className={'group relative cursor-pointer rounded-xl border bg-white px-4 py-4 transition hover:border-[#48C9B0] hover:shadow-[0_2px_12px_rgba(72,201,176,0.12)] active:scale-[0.99] sm:px-5 sm:py-4 ' + (isNext ? 'border-[#48C9B0]/40' : 'border-[#e8e8e8]') + (isDimmed ? ' opacity-70' : '')}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-[#1D1E20]">{event.name}</p>
              {event.is_shared && event.shared_role && (
                <span className={'rounded px-1.5 py-0.5 text-[10px] font-semibold ' + (ROLE_STYLES[event.shared_role] || '')}>
                  {ROLE_LABEL[event.shared_role] || event.shared_role}
                </span>
              )}
              {event.pendingReminders > 0 && (
                <span className="flex items-center gap-1 rounded-full border border-[#48C9B0]/40 bg-[#f0fdfb] px-2 py-0.5 text-[10px] font-semibold text-[#1a9e88]">
                  <Bell size={10} className="text-[#48C9B0]" />
                  {event.pendingReminders}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[#888]">
              {formatDate(event.event_date)}
              {event.event_time && ' · ' + formatTime(event.event_time)}
              {event.venue && ' · ' + event.venue}
            </p>
            {event.is_shared && event.owner_name && (
              <p className="mt-0.5 text-[11px] text-[#aaa]">por {event.owner_name}</p>
            )}
          </div>
          {!event.is_shared && (
            <div data-menu className="relative shrink-0" onClick={e => e.stopPropagation()}>
              <button
                onClick={e => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : event.id) }}
                className={'flex h-7 w-7 items-center justify-center rounded-lg text-[#bbb] transition hover:bg-[#f0f0f0] hover:text-[#555] ' + (menuOpen ? 'bg-[#f0f0f0] text-[#555]' : '')}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <circle cx="7" cy="2.5" r="1.2"/>
                  <circle cx="7" cy="7" r="1.2"/>
                  <circle cx="7" cy="11.5" r="1.2"/>
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
                  <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#bbb]">Cambiar estado</div>
                  {getMenuOptions(event).map(opt => (
                    <button key={opt.status} onClick={e => handleStatusChange(event, opt.status, e)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs transition hover:bg-[#f8f8f8]"
                      style={{ color: opt.color || '#555' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mb-3 grid grid-cols-4 gap-2">
          {[
            { label: 'Total',  value: event.total,     color: '#1D1E20' },
            { label: 'Conf.',  value: event.confirmed, color: '#2a7a50' },
            { label: 'Pend.',  value: event.pending,   color: '#b8860b' },
            { label: 'Decl.',  value: event.declined,  color: '#cc3333' },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-[#f8f8f8] p-2 text-center">
              <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-[#999]">{s.label}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] text-[#aaa]">Confirmados</span>
            <span className="text-[10px] font-semibold text-[#48C9B0]">{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f0f0f0]">
            <div className="h-full rounded-full bg-[#48C9B0] transition-all duration-500" style={{ width: pct + '%' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f8f8f8] font-sans text-[#1D1E20]">

      <WhatsNewModal />
      <OnboardingModal open={showOnboarding} onCompleted={() => setShowOnboarding(false)} />

      {showWelcome && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl">
            <div className="mb-5 flex items-center gap-3">
              <span style={{ fontFamily: 'Georgia, serif' }} className="text-xl font-bold text-[#1D1E20]">
                Anfi<span className="text-[#48C9B0]">ora</span>
              </span>
              <span className="rounded-full border border-[#48C9B0]/40 bg-[#f0fdfb] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#48C9B0]">Beta</span>
            </div>
            <h2 className="mb-2 text-lg font-bold text-[#1D1E20]">Bienvenido a Anfiora</h2>
            <p className="mb-4 text-sm leading-relaxed text-[#666]">
              Gracias por ser parte de esta version beta. Anfiora te ayuda a gestionar listas de invitados y automatizar comunicacion por WhatsApp para tus eventos.
            </p>
            <div className="mb-5 flex flex-col gap-2 rounded-xl bg-[#f8f8f8] p-4">
              {[
                'Crea eventos y agrega invitados facilmente',
                'Envia mensajes de WhatsApp con plantillas personalizadas',
                'Rastrea confirmaciones, pendientes y declinados en tiempo real',
                'Importa listas desde CSV con un clic',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#48C9B0]" />
                  <p className="text-xs leading-relaxed text-[#555]">{text}</p>
                </div>
              ))}
            </div>
            <p className="mb-5 text-xs leading-relaxed text-[#888]">Estas usando una version beta. Tu feedback es muy valioso para mejorar la app.</p>
            <div className="flex flex-col gap-2.5">
              <button onClick={() => window.open(FEEDBACK_URL, '_blank')}
                className="w-full rounded-lg border border-[#48C9B0] bg-[#f0fdfb] py-2.5 text-sm font-semibold text-[#1a9e88] transition hover:bg-[#e0faf5]">
                Dar feedback
              </button>
              <button onClick={() => setShowWelcome(false)}
                className="w-full rounded-lg bg-[#1D1E20] py-2.5 text-sm font-semibold text-white transition hover:bg-[#2d2e30]">
                Empezar
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="shrink-0 border-b border-[#e8e8e8] bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <button onClick={() => window.location.href = '/dashboard'} className="shrink-0">
            <img src="/images/isotipo.svg" alt="Anfiora" className="h-11 w-11 sm:hidden" />
            <img src="/images/logo.svg" alt="Anfiora" className="hidden h-11 sm:block lg:h-14" />
          </button>
          <div className="flex items-center gap-3 sm:gap-4">
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
            <span className="hidden truncate text-xs text-[#888] sm:block sm:max-w-[200px] sm:text-sm">{userEmail}</span>
            <button onClick={handleLogout} className="rounded-md border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#888] transition hover:bg-[#f5f5f5] sm:px-4 sm:text-sm">Salir</button>
          </div>
        </div>
      </header>

      <div className="shrink-0 bg-[#f8f8f8]">
        <div className="mx-auto max-w-4xl px-4 pt-3 sm:px-6 sm:pt-4 lg:px-8">
          <div className="mb-5 flex items-center justify-between sm:mb-6">
            <div>
              <h1 className="text-xl font-bold text-[#1D1E20] sm:text-2xl">Dashboard</h1>
              <p className="mt-0.5 text-xs text-[#888] sm:text-sm">Resumen de tus eventos</p>
            </div>
            <button
              onClick={() => setShowNewEvent(true)}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3ab89f] active:scale-95 sm:px-5 sm:py-2.5"
            >
              <span className="sm:hidden">+ Nuevo</span>
              <span className="hidden sm:inline">+ Nuevo evento</span>
            </button>
          </div>

          {!loading && nextEvent && (
            <div onClick={() => window.location.href = '/events/' + nextEvent.id}
              className="mb-5 cursor-pointer rounded-2xl border border-[#48C9B0]/30 bg-white p-4 shadow-[0_2px_16px_rgba(72,201,176,0.1)] transition hover:shadow-[0_4px_24px_rgba(72,201,176,0.18)] sm:mb-6">
              <div className="flex items-stretch gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-block rounded-full bg-[#e8f7f3] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#48C9B0]">
                      Proximo evento
                    </span>
                    {nextEvent.is_shared && nextEvent.shared_role && (
                      <span className={'rounded px-1.5 py-0.5 text-[10px] font-semibold ' + (ROLE_STYLES[nextEvent.shared_role] || '')}>
                        {ROLE_LABEL[nextEvent.shared_role] || nextEvent.shared_role}
                      </span>
                    )}
                  </div>
                  <h2 className="truncate text-sm font-bold text-[#1D1E20] sm:text-base">{nextEvent.name}</h2>
                  <p className="mt-0.5 text-xs text-[#888]">
                    {formatDate(nextEvent.event_date)}
                    {nextEvent.event_time && ' · ' + formatTime(nextEvent.event_time)}
                    {nextEvent.venue && ' · ' + nextEvent.venue}
                  </p>
                  {nextEvent.is_shared && nextEvent.owner_name && (
                    <p className="mt-0.5 text-[11px] text-[#aaa]">por {nextEvent.owner_name}</p>
                  )}
                  <div className="mt-3 rounded-xl bg-[#f8f5f0] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Faltan</p>
                    <p className="font-mono text-xl font-bold text-[#48C9B0] sm:text-2xl">{getCountdown(nextEvent)}</p>
                  </div>
                </div>
                <div className="grid flex-1 grid-cols-2 gap-2">
                  {[
                    { label: 'Total',  value: nextEvent.total,     color: '#1D1E20' },
                    { label: 'Conf.',  value: nextEvent.confirmed, color: '#2a7a50' },
                    { label: 'Pend.',  value: nextEvent.pending,   color: '#b8860b' },
                    { label: 'Decl.',  value: nextEvent.declined,  color: '#cc3333' },
                  ].map(s => (
                    <div key={s.label} className="flex flex-1 flex-col items-center justify-center rounded-lg border border-[#e8e8e8] bg-[#f8f8f8]">
                      <p className="text-sm font-bold sm:text-base" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px] text-[#999]">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              {sameDay.length > 0 && (
                <div className="mt-3 border-t border-[#f0f0f0] pt-2">
                  {sameDay.map(e => (
                    <p key={e.id} className="text-xs text-[#aaa]">
                      Tambien tienes: <span className="font-semibold text-[#888]">{e.name}</span>
                      {e.event_time && ' a las ' + formatTime(e.event_time)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pb-3">
            <div className="grid flex-1 grid-cols-4 gap-1">
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={'flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition ' + (activeTab === tab.key ? 'bg-[#1D1E20] text-white' : 'text-[#888] hover:bg-[#efefef]')}>
                  {tab.label}
                  <span className={'rounded-full px-1.5 py-0.5 text-[10px] font-bold ' + (activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-[#e8e8e8] text-[#666]')}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            {activeTab === 'activos' && (
              <button onClick={() => setSortAsc(!sortAsc)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 4l4-3 4 3M2 8l4 3 4-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {sortAsc ? 'Fecha ↑' : 'Fecha ↓'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 pb-8 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1,2,3].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : (myEvents.length === 0 && sharedEvents.length === 0) ? (
            <div className="rounded-xl border border-dashed border-[#e0e0e0] px-6 py-16 text-center sm:py-20">
              <p className="text-sm text-[#888] sm:text-base">Aun no tienes eventos</p>
              <p className="mt-1 text-xs text-[#bbb] sm:text-sm">Crea tu primer evento para empezar</p>
              <button
                onClick={() => setShowNewEvent(true)}
                className="mt-4 rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
              >
                + Crear evento
              </button>
            </div>
          ) : (currentMy.length === 0 && currentShared.length === 0) ? (
            <div className="rounded-xl border border-dashed border-[#e0e0e0] px-6 py-16 text-center sm:py-20">
              <p className="text-sm text-[#888]">
                {activeTab === 'activos'    && 'No tienes eventos activos'}
                {activeTab === 'pasados'    && 'No tienes eventos pasados'}
                {activeTab === 'pausados'   && 'No tienes eventos pausados'}
                {activeTab === 'cancelados' && 'No tienes eventos cancelados'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {currentMy.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#888]">Mis eventos</h3>
                    <span className="rounded-full bg-[#e8e8e8] px-1.5 py-0.5 text-[10px] font-bold text-[#666]">{currentMy.length}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {currentMy.map(event => <EventCard key={event.id} event={event} />)}
                  </div>
                </section>
              )}
              {currentShared.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#888]">Compartidos conmigo</h3>
                    <span className="rounded-full bg-[#e8e8e8] px-1.5 py-0.5 text-[10px] font-bold text-[#666]">{currentShared.length}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {currentShared.map(event => <EventCard key={event.id} event={event} />)}
                  </div>
                </section>
              )}
            </div>
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