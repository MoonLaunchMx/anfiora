'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, Users, CreditCard, Activity, Megaphone } from 'lucide-react'
import { AdminUser, GlobalStats, AuditEntry, EventOption } from './lib/types'
import ResumenTab from './ResumenTab'
import UsuariosTab from './UsuariosTab'
import PagosTab from './PagosTab'
import ActividadTab from './ActividadTab'
import MarketingTab from './MarketingTab'

const ADMIN_EMAIL = 'diego.garza@moonlaunch.mx'

type Tab = 'resumen' | 'marketing' | 'users' | 'pagos' | 'activity'

interface ApiUser {
  id: string
  email: string
  full_name: string | null
  plan: string
  created_at: string
  last_sign_in: string | null
  banned: boolean
  terms_version: string | null
  terms_accepted_at: string | null
  terms_history: { version: string; accepted_at: string; ip_address: string | null }[]
  role: string | null
  event_focus: string[] | null
  acquisition_source: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  referrer_domain: string | null
  device_type: string | null
  acquired_at: string | null
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('resumen')

  const [loading, setLoading]             = useState(true)
  const [authed, setAuthed]               = useState(false)
  const [sessionToken, setSessionToken]   = useState<string | null>(null)
  const [stats, setStats]                 = useState<GlobalStats | null>(null)
  const [users, setUsers]                 = useState<AdminUser[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null)

  const [auditEntries, setAuditEntries]   = useState<AuditEntry[]>([])
  const [auditLoading, setAuditLoading]   = useState(false)
  const [eventOptions, setEventOptions]   = useState<EventOption[]>([])

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || session.user.email !== ADMIN_EMAIL) {
        window.location.href = '/dashboard'
        return
      }
      setSessionToken(session.access_token)
      setAuthed(true)
      await loadData(session.access_token)
    }
    checkAuth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeTab === 'activity' && auditEntries.length === 0) {
      loadAuditLog()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function loadData(token: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!res.ok) throw new Error('Error cargando datos')

      const { users: usersRaw, events, guests, partyMembers } = await res.json()

      const enriched: AdminUser[] = (usersRaw as ApiUser[]).map(u => {
        const userEvents   = events.filter((e: { user_id: string }) => e.user_id === u.id)
        const userEventIds = userEvents.map((e: { id: string }) => e.id)
        const userGuests   = guests.filter((g: { event_id: string }) => userEventIds.includes(g.event_id))
        const userParty    = partyMembers.filter((p: { event_id: string }) => userEventIds.includes(p.event_id))

        const eventsWithCounts = userEvents.map((e: { id: string; name: string; created_at: string }) => {
          const evGuests = guests.filter((g: { event_id: string }) => g.event_id === e.id).length
          const evParty  = partyMembers.filter((p: { event_id: string }) => p.event_id === e.id).length
          return { ...e, guest_count: evGuests, party_count: evParty, total_count: evGuests + evParty }
        })

        return {
          ...u,
          plan:         u.plan || 'free',
          event_count:  userEvents.length,
          guest_count:  userGuests.length,
          party_count:  userParty.length,
          total_count:  userGuests.length + userParty.length,
          last_sign_in: u.last_sign_in ?? null,
          events:       eventsWithCounts,
          banned:       u.banned ?? false,
          terms_version:     u.terms_version ?? null,
          terms_accepted_at: u.terms_accepted_at ?? null,
          terms_history:     u.terms_history ?? [],
        }
      })

      const now          = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()

      setStats({
        total_users:   usersRaw.length,
        free_users:    usersRaw.filter((u: ApiUser) => (u.plan || 'free') === 'free').length,
        pro_users:     usersRaw.filter((u: ApiUser) => u.plan === 'pro').length,
        agency_users:  usersRaw.filter((u: ApiUser) => u.plan === 'agency').length,
        total_events:  events.length,
        total_guests:  guests.length + partyMembers.length,
        confirmed:     guests.filter((g: { rsvp_status: string }) => g.rsvp_status === 'confirmed').length,
        pending:       guests.filter((g: { rsvp_status: string }) => g.rsvp_status === 'pending').length,
        declined:      guests.filter((g: { rsvp_status: string }) => g.rsvp_status === 'declined').length,
        new_users_7d:  usersRaw.filter((u: ApiUser) => u.created_at >= sevenDaysAgo).length,
        new_events_7d: events.filter((e: { created_at: string }) => e.created_at >= sevenDaysAgo).length,
      })

      setUsers(enriched)
      setEventOptions(events.map((e: { id: string; name: string }) => ({ id: e.id, name: e.name })))

    } catch {
      showToast('Error cargando datos', false)
    } finally {
      setLoading(false)
    }
  }

  async function loadAuditLog() {
    setAuditLoading(true)
    try {
      const { data, error } = await supabase
        .from('event_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setAuditEntries((data || []) as AuditEntry[])
    } catch {
      showToast('Error cargando actividad', false)
    } finally {
      setAuditLoading(false)
    }
  }

  async function changePlan(userId: string, newPlan: string) {
    await supabase.from('users').update({ plan: newPlan }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan: newPlan } : u))
  }

  async function callAdminAction(userId: string, action: 'delete' | 'ban' | 'unban', emailConfirm?: string) {
    const token = sessionToken
    if (!token) return
    setActionLoading(userId + action)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ userId, action, emailConfirm })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (action === 'delete') {
        setUsers(prev => prev.filter(u => u.id !== userId))
        showToast('Usuario eliminado')
      } else if (action === 'ban') {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, banned: true } : u))
        showToast('Usuario suspendido')
      } else {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, banned: false } : u))
        showToast('Usuario reactivado')
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Error desconocido', false)
    } finally {
      setActionLoading(null)
    }
  }

  if (!authed && !loading) return null

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#f8f5f0]">
      <div className="text-center">
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#48C9B0] border-t-transparent mx-auto" />
        <p className="text-sm text-[#888]">Cargando datos...</p>
      </div>
    </div>
  )

  const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: 'resumen',  label: 'Resumen',   icon: LayoutDashboard },
    { key: 'marketing', label: 'Marketing', icon: Megaphone },
    { key: 'users',    label: 'Usuarios',  icon: Users },
    { key: 'pagos',    label: 'Pagos',     icon: CreditCard },
    { key: 'activity', label: 'Actividad', icon: Activity },
  ]

  return (
    <div className="min-h-screen bg-[#f8f5f0]">

      {toast && (
        <div className={'fixed top-4 right-4 z-50 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ' + (toast.ok ? 'bg-[#48C9B0]' : 'bg-red-500')}>
          {toast.msg}
        </div>
      )}

      <div className="border-b border-[#e8e8e8] bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#48C9B0]">
              <span className="text-xs font-bold text-white">A</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-[#1D1E20]">Anfiora Superadmin</h1>
              <p className="text-xs text-[#888]">Panel de control del negocio</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { if (sessionToken) loadData(sessionToken); if (activeTab === 'activity') loadAuditLog() }}
              className="rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#555] transition hover:bg-[#f5f5f5]"
            >
              Actualizar
            </button>
            <button onClick={() => { window.location.href = '/dashboard' }} className="rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#555] transition hover:bg-[#f5f5f5]">
              Volver al app
            </button>
          </div>
        </div>

        <div className="mx-auto mt-4 flex max-w-7xl flex-wrap gap-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ' +
                (activeTab === key ? 'bg-[#1D1E20] text-white' : 'text-[#888] hover:bg-[#f5f5f5]')}
            >
              <Icon size={14} />
              {label}
              {key === 'activity' && auditEntries.length > 0 && (
                <span className="rounded-full bg-[#48C9B0] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {auditEntries.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === 'resumen'  && <ResumenTab users={users} />}
        {activeTab === 'marketing' && <MarketingTab users={users} />}
        {activeTab === 'users'    && (
          <UsuariosTab
            users={users}
            stats={stats}
            actionLoading={actionLoading}
            onChangePlan={changePlan}
            onAdminAction={callAdminAction}
          />
        )}
        {activeTab === 'pagos'    && <PagosTab users={users} />}
        {activeTab === 'activity' && (
          <ActividadTab
            entries={auditEntries}
            loading={auditLoading}
            eventOptions={eventOptions}
            onReload={loadAuditLog}
          />
        )}
      </div>
    </div>
  )
}
