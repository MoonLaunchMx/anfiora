'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Users, Images, Music2, Settings, LayoutGrid, PanelLeftClose, PanelLeftOpen, CalendarDays, House, User, LogOut, Wallet, Briefcase, Heart, MessageCircle, Receipt, Gift, UtensilsCrossed } from 'lucide-react'
import { LEGACY_FEATURES, type FeatureKey } from '@/lib/features'
import { Event } from '@/lib/types'
import { EventAccessProvider, useEventAccess } from '@/lib/event-access-context'

const EVENT_TYPE_LABELS: Record<string, string> = {
  boda:        'Boda',
  cumpleanos:  'Cumpleanos',
  fiesta:      'Fiesta',
  corporativo: 'Corporativo',
  bautizo:     'Bautizo',
  otro:        'Otro',
}

const EVENT_STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  active:    { dot: 'bg-[#48C9B0]', badge: 'border-[#c8ede7] bg-[#f0fdfb] text-[#1a9e88]', label: 'Activo' },
  paused:    { dot: 'bg-blue-400',  badge: 'border-blue-200 bg-blue-50 text-blue-700',      label: 'Pausado' },
  cancelled: { dot: 'bg-red-400',   badge: 'border-red-200 bg-red-50 text-red-600',         label: 'Cancelado' },
  completed: { dot: 'bg-[#888]',    badge: 'border-[#e0e0e0] bg-[#f8f8f8] text-[#888]',    label: 'Completado' },
}

type NavSubItem = {
  label: string
  labelMobile?: string
  path: string
  pro?: boolean
  iconOutline: React.ReactNode
  iconFilled: React.ReactNode
}

type NavItem = {
  type: 'item'
  label: string
  labelMobile: string
  path: string
  adminOnly: boolean
  pro?: boolean
  iconOutline: React.ReactNode
  iconFilled: React.ReactNode
}

type NavGroup = {
  type: 'group'
  label: string
  labelMobile: string
  defaultPath: string
  iconOutline: React.ReactNode
  iconFilled: React.ReactNode
  children: NavSubItem[]
}

type NavEntry = NavItem | NavGroup

const NAV_ITEMS: NavEntry[] = [
  {
    type: 'item',
    label: 'Invitados', labelMobile: 'Invitados', path: '', adminOnly: false,
    iconOutline: <Users         width={18} height={18} strokeWidth={1.5} />,
    iconFilled:  <Users         width={18} height={18} strokeWidth={2.5} />,
  },
  {
    type: 'item',
    label: 'Mensajes', labelMobile: 'Mensajes', path: '/mensajes', adminOnly: false,
    pro: true,
    iconOutline: <MessageCircle width={18} height={18} strokeWidth={1.5} />,
    iconFilled:  <MessageCircle width={18} height={18} strokeWidth={2.5} />,
  },
  {
    type: 'item',
    label: 'Mesas', labelMobile: 'Mesas', path: '/mesas', adminOnly: false,
    iconOutline: <LayoutGrid    width={18} height={18} strokeWidth={1.5} />,
    iconFilled:  <LayoutGrid    width={18} height={18} strokeWidth={2.5} />,
  },
  {
    type: 'item',
    label: 'Timeline', labelMobile: 'Timeline', path: '/timeline', adminOnly: false,
    iconOutline: <CalendarDays  width={18} height={18} strokeWidth={1.5} />,
    iconFilled:  <CalendarDays  width={18} height={18} strokeWidth={2.5} />,
  },
  {
    type: 'item',
    label: 'Comida', labelMobile: 'Comida', path: '/comida', adminOnly: false,
    iconOutline: <UtensilsCrossed width={18} height={18} strokeWidth={1.5} />,
    iconFilled:  <UtensilsCrossed width={18} height={18} strokeWidth={2.5} />,
  },
  {
    type: 'item',
    label: 'Mesa de regalos', labelMobile: 'Regalos', path: '/mesa-regalos', adminOnly: false,
    iconOutline: <Gift width={18} height={18} strokeWidth={1.5} />,
    iconFilled:  <Gift width={18} height={18} strokeWidth={2.5} />,
  },
  {
    type: 'group',
    label: 'Finanzas', labelMobile: 'Finanzas',
    defaultPath: '/presupuesto',
    iconOutline: <Wallet width={18} height={18} strokeWidth={1.5} />,
    iconFilled:  <Wallet width={18} height={18} strokeWidth={2.5} />,
    children: [
      {
        label: 'Presupuesto', path: '/presupuesto',
        iconOutline: <Wallet    width={18} height={18} strokeWidth={1.5} />,
        iconFilled:  <Wallet    width={18} height={18} strokeWidth={2.5} />,
      },
      {
        label: 'Proveedores', path: '/proveedores', pro: true,
        iconOutline: <Briefcase width={18} height={18} strokeWidth={1.5} />,
        iconFilled:  <Briefcase width={18} height={18} strokeWidth={2.5} />,
      },
      {
        label: 'Pagos', path: '/pagos', pro: true,
        iconOutline: <Receipt width={18} height={18} strokeWidth={1.5} />,
        iconFilled:  <Receipt width={18} height={18} strokeWidth={2.5} />,
      },
    ],
  },
  {
    type: 'group',
    label: 'Recuerdos', labelMobile: 'Recuerdos',
    defaultPath: '/album',
    iconOutline: <Heart width={18} height={18} strokeWidth={1.5} />,
    iconFilled:  <Heart width={18} height={18} strokeWidth={2.5} />,
    children: [
      {
        label: 'Album', path: '/album',
        iconOutline: <Images width={18} height={18} strokeWidth={1.5} />,
        iconFilled:  <Images width={18} height={18} strokeWidth={2.5} />,
      },
      {
        label: 'Playlist', path: '/playlist',
        iconOutline: <Music2 width={18} height={18} strokeWidth={1.5} />,
        iconFilled:  <Music2 width={18} height={18} strokeWidth={2.5} />,
      },
    ],
  },
  {
    type: 'item',
    label: 'Configuracion', labelMobile: 'Config', path: '/configuracion', adminOnly: true,
    iconOutline: <Settings      width={18} height={18} strokeWidth={1.5} />,
    iconFilled:  <Settings      width={18} height={18} strokeWidth={2.5} />,
  },
]

const FEATURE_BY_PATH: Record<string, FeatureKey> = {
  '/mesas':        'mesas',
  '/mesa-regalos': 'regalos',
  '/album':        'album',
  '/playlist':     'playlist',
  '/comida':       'comida',
}

function filterNavByFeatures(entries: NavEntry[], features: Record<FeatureKey, boolean> | null): NavEntry[] {
  const effective = features ?? LEGACY_FEATURES
  const result: NavEntry[] = []
  for (const entry of entries) {
    if (entry.type === 'item') {
      const fk = FEATURE_BY_PATH[entry.path]
      if (fk && !effective[fk]) continue
      result.push(entry)
    } else {
      const children = entry.children.filter(child => {
        const fk = FEATURE_BY_PATH[child.path]
        return !fk || effective[fk]
      })
      if (children.length === 0) continue
      result.push({
        ...entry,
        children,
        defaultPath: children.some(c => c.path === entry.defaultPath) ? entry.defaultPath : children[0].path,
      })
    }
  }
  return result
}

function ProBadge({ active = false }: { active?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider
      ${active ? 'bg-white text-[#1D1E20]' : 'bg-[#1D1E20] text-white'}`}>
      PRO
    </span>
  )
}

function getInitials(name: string, email: string): string {
  if (name) {
    const parts = name.trim().split(' ').filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return parts[0][0].toUpperCase()
  }
  return email?.[0]?.toUpperCase() || '?'
}

function Avatar({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-8 w-8 text-[12px]'
  return (
    <div className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-[#48C9B0] font-semibold text-white`}>
      {initials}
    </div>
  )
}

// Aplana entries para mobile nav: grupos → hijos individuales
function buildMobileItems(entries: NavEntry[], isActive: (p: string) => boolean) {
  const result: {
    key: string
    label: string
    path: string
    iconOutline: React.ReactNode
    iconFilled: React.ReactNode
    active: boolean
  }[] = []

  for (const entry of entries) {
    if (entry.type === 'item') {
      result.push({
        key: entry.path || '__invitados',
        label: entry.labelMobile,
        path: entry.path,
        iconOutline: entry.iconOutline,
        iconFilled: entry.iconFilled,
        active: isActive(entry.path),
      })
    } else {
      for (const child of entry.children) {
        result.push({
          key: child.path,
          label: child.label,
          path: child.path,
          iconOutline: child.iconOutline,
          iconFilled: child.iconFilled,
          active: isActive(child.path),
        })
      }
    }
  }
  return result
}

// Aplana entries para sidebar colapsado: grupos → hijos individuales como íconos
function buildCollapsedItems(entries: NavEntry[], canAdmin: boolean) {
  const result: {
    key: string
    label: string
    path: string
    iconOutline: React.ReactNode
    iconFilled: React.ReactNode
  }[] = []

  for (const entry of entries) {
    if (entry.type === 'item') {
      if (entry.adminOnly && !canAdmin) continue
      result.push({
        key: entry.path || '__invitados',
        label: entry.label,
        path: entry.path,
        iconOutline: entry.iconOutline,
        iconFilled: entry.iconFilled,
      })
    } else {
      for (const child of entry.children) {
        result.push({
          key: child.path,
          label: child.label,
          path: child.path,
          iconOutline: child.iconOutline,
          iconFilled: child.iconFilled,
        })
      }
    }
  }
  return result
}

function EventLayoutInner({ children }: { children: React.ReactNode }) {
  const { id } = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const { canAdmin, features } = useEventAccess()

  const [event, setEvent]             = useState<Event | null>(null)
  const [drawerOpen, setDrawerOpen]   = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [collapsed, setCollapsed]     = useState(false)
  const [userName, setUserName]       = useState('')
  const [userEmail, setUserEmail]     = useState('')
  const [avatarOpen, setAvatarOpen]   = useState(false)

  const navScrollRef = useRef<HTMLDivElement>(null)
  const avatarRef    = useRef<HTMLDivElement>(null)

  const visibleEntries = filterNavByFeatures(
    NAV_ITEMS.filter(entry =>
      entry.type === 'item' ? (!entry.adminOnly || canAdmin) : true
    ),
    features,
  )

  useEffect(() => {
    const stored = localStorage.getItem('gf_sidebar_collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  const toggleSidebar = () => {
    setCollapsed(prev => {
      localStorage.setItem('gf_sidebar_collapsed', String(!prev))
      return !prev
    })
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-avatar-menu]')) {
        setAvatarOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION' && !session) {
        router.replace('/')
      } else if (session) {
        setAuthChecked(true)
        const meta = session.user.user_metadata
        setUserName(meta?.full_name || '')
        setUserEmail(session.user.email || '')
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    if (!authChecked) return
    const loadEvent = async () => {
      const { data } = await supabase
        .from('events')
        .select('id, name, event_date, event_end_date, venue, event_type, event_status')
        .eq('id', id)
        .single()
      if (data) setEvent(data as any)
    }
    loadEvent()
  }, [id, authChecked])

  const formatDate = (d: string) => {
    const [year, month, day] = d.split('T')[0].split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  const getDisplayStatus = (): 'active' | 'paused' | 'cancelled' | 'completed' => {
    const es = event?.event_status || 'active'
    if (es === 'paused' || es === 'cancelled') return es
    if (event?.event_date) {
      const [year, month, day] = event.event_date.split('T')[0].split('-').map(Number)
      const eventDay = new Date(year, month - 1, day)
      eventDay.setHours(0, 0, 0, 0)
      const today = new Date(); today.setHours(0, 0, 0, 0)
      if (eventDay < today) return 'completed'
    }
    return 'active'
  }

  const isActive = (path: string) => {
    const full = `/events/${id}${path}`
    if (path === '') return pathname === `/events/${id}`
    return pathname === full || pathname.startsWith(full + '/')
  }

  const isGroupActive = (group: NavGroup) => group.children.some(child => isActive(child.path))

  const navigate = (path: string) => {
    router.push(`/events/${id}${path}`)
    setDrawerOpen(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const mobileItems    = buildMobileItems(visibleEntries, isActive)
  const collapsedItems = buildCollapsedItems(visibleEntries, canAdmin)

  // Scroll al item activo en mobile
  useEffect(() => {
    const container = navScrollRef.current
    if (!container) return
    const activeIndex = mobileItems.findIndex(item => item.active)
    if (activeIndex === -1) return
    const totalButtons = mobileItems.length + 1 // +1 por Inicio
    const btnWidth = container.scrollWidth / totalButtons
    container.scrollTo({ left: Math.max(0, btnWidth * activeIndex - btnWidth), behavior: 'smooth' })
  }, [pathname, id, mobileItems.length])

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
          <p className="text-sm text-[#999]">Cargando...</p>
        </div>
      </div>
    )
  }

  const initials      = getInitials(userName, userEmail)
  const displayStatus = event ? getDisplayStatus() : null
  const badgeStyle    = displayStatus ? EVENT_STATUS_STYLES[displayStatus] : null

  const AvatarDropdown = () => (
    <div className="absolute bottom-full right-0 z-50 mb-2 w-52 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
      <div className="border-b border-[#f0f0f0] px-4 py-3">
        <p className="truncate text-xs font-semibold text-[#1D1E20]">{userName || 'Mi cuenta'}</p>
        <p className="truncate text-[11px] text-[#aaa]">{userEmail}</p>
      </div>
      <button
        onClick={() => { setAvatarOpen(false); router.push('/perfil') }}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-[#555] transition hover:bg-[#f8f8f8]"
      >
        <User size={14} className="text-[#aaa]" />
        Mi perfil
      </button>
      <button
        onClick={handleLogout}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-[#cc3333] transition hover:bg-[#fff0f0]"
      >
        <LogOut size={14} />
        Cerrar sesion
      </button>
    </div>
  )

  // ── Sidebar expandido: item normal ──
  const renderSidebarItem = (entry: NavItem) => {
    const active = isActive(entry.path)
    return (
      <button
        key={entry.path}
        onClick={() => navigate(entry.path)}
        className={`flex w-full items-center gap-2.5 border-l-[3px] px-4 py-2.5 text-left text-sm transition
          ${active
            ? 'border-[#48C9B0] bg-white font-semibold text-[#1D1E20]'
            : 'border-transparent font-normal text-[#888] hover:bg-white/60 hover:text-[#1D1E20]'
          }`}
      >
        {active ? entry.iconFilled : entry.iconOutline}
        <span className="flex-1">{entry.label}</span>
        {entry.pro && <ProBadge active={active} />}
      </button>
    )
  }

  // ── Sidebar expandido: grupo con header + sub-items indentados ──
  const renderSidebarGroup = (group: NavGroup) => (
    <div key={group.label} className="mt-1">
      <div className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">
        {group.label}
      </div>
      {group.children.map(child => {
        const active = isActive(child.path)
        return (
          <button
            key={child.path}
            onClick={() => navigate(child.path)}
            className={`flex w-full items-center gap-2.5 border-l-[3px] py-2.5 pl-7 pr-4 text-left text-sm transition
              ${active
                ? 'border-[#48C9B0] bg-white font-semibold text-[#1D1E20]'
                : 'border-transparent font-normal text-[#888] hover:bg-white/60 hover:text-[#1D1E20]'
              }`}
          >
            {active ? child.iconFilled : child.iconOutline}
            <span className="flex-1">{child.label}</span>
            {child.pro && <ProBadge active={active} />}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white font-sans text-[#1D1E20]">

      {/* HEADER MOBILE */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#e8e8e8] bg-white px-4 sm:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="shrink-0 text-[#bbb] transition hover:text-[#48C9B0]"
          >
            <House size={16} />
          </button>
          <span className="truncate text-sm font-semibold text-[#1D1E20]">
            {event?.name || '...'}
          </span>
        </div>
        <div ref={avatarRef} data-avatar-menu className="relative ml-3 shrink-0">
          <button onClick={() => setAvatarOpen(p => !p)} className="flex items-center">
            <Avatar initials={initials} size="sm" />
          </button>
          {avatarOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
              <div className="border-b border-[#f0f0f0] px-4 py-3">
                <p className="truncate text-xs font-semibold text-[#1D1E20]">{userName || 'Mi cuenta'}</p>
                <p className="truncate text-[11px] text-[#aaa]">{userEmail}</p>
              </div>
              <button
                onClick={() => { setAvatarOpen(false); router.push('/perfil') }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-[#555] transition hover:bg-[#f8f8f8]"
              >
                <User size={14} className="text-[#aaa]" />
                Mi perfil
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-[#cc3333] transition hover:bg-[#fff0f0]"
              >
                <LogOut size={14} />
                Cerrar sesion
              </button>
            </div>
          )}
        </div>
      </header>

      {/* HEADER DESKTOP */}
      <header className="hidden h-14 shrink-0 items-center justify-between border-b border-[#e8e8e8] bg-white px-4 sm:flex sm:h-16 sm:px-6">
        <button onClick={() => router.push('/dashboard')} className="shrink-0">
          <img src="/images/Logo-010526newest.svg" alt="Anfiora" className="h-10 sm:h-11 lg:h-14" />
        </button>

        {event && (
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-4">
            <span className="max-w-[200px] truncate text-sm font-semibold text-[#1D1E20] lg:max-w-xs">
              {event.name}
            </span>
            {event.event_type && (
              <span className="hidden text-xs text-[#888] lg:block">
                {EVENT_TYPE_LABELS[event.event_type]}
              </span>
            )}
            {badgeStyle && (
              <span className={'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ' + badgeStyle.badge}>
                <span className={'h-1.5 w-1.5 rounded-full ' + badgeStyle.dot} />
                {badgeStyle.label}
              </span>
            )}
            {event.event_date && (
              <span className="hidden text-xs text-[#aaa] lg:block">
                {formatDate(event.event_date)}
              </span>
            )}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-xs text-[#999] transition hover:text-[#48C9B0]">
            Mis eventos
          </button>
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="hidden h-8 w-8 items-center justify-center rounded-md border border-[#e0e0e0] text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0] sm:flex lg:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
      </header>

      {/* BODY */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* SIDEBAR desktop lg+ */}
        <aside
          className="hidden shrink-0 flex-col overflow-hidden border-r border-[#e8e8e8] bg-[#f8f5f0] lg:flex"
          style={{ width: collapsed ? '56px' : '224px', transition: 'width 0.2s ease' }}
        >
          <nav className="flex-1 overflow-y-auto py-2">
            {collapsed
              ? collapsedItems.map(item => {
                  const active = isActive(item.path)
                  return (
                    <button
                      key={item.key}
                      onClick={() => navigate(item.path)}
                      title={item.label}
                      className={`flex w-full items-center justify-center border-l-[3px] py-2.5 transition
                        ${active
                          ? 'border-[#48C9B0] bg-white text-[#1D1E20]'
                          : 'border-transparent text-[#888] hover:bg-white/60 hover:text-[#1D1E20]'
                        }`}
                    >
                      {active ? item.iconFilled : item.iconOutline}
                    </button>
                  )
                })
              : visibleEntries.map(entry =>
                  entry.type === 'item' ? renderSidebarItem(entry) : renderSidebarGroup(entry)
                )
            }
          </nav>

          <div className="shrink-0 border-t border-[#e8e8e8]">
            <div ref={avatarRef} data-avatar-menu className="relative px-3 py-3">
              <button
                onClick={() => setAvatarOpen(p => !p)}
                title={collapsed ? (userName || userEmail) : undefined}
                className={`flex w-full items-center rounded-lg transition hover:bg-white/70
                  ${collapsed ? 'justify-center py-1.5' : 'gap-2.5 px-2 py-1.5'}`}
              >
                <Avatar initials={initials} />
                {!collapsed && (
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xs font-semibold text-[#1D1E20]">{userName || 'Mi cuenta'}</p>
                    <p className="truncate text-[10px] text-[#aaa]">{userEmail}</p>
                  </div>
                )}
              </button>
              {avatarOpen && <AvatarDropdown />}
            </div>
            <div className="px-3 pb-3">
              <button
                onClick={toggleSidebar}
                title={collapsed ? 'Expandir' : 'Colapsar'}
                className={`flex w-full items-center rounded-md border border-[#e0e0e0] text-[#aaa] transition hover:border-[#48C9B0] hover:text-[#48C9B0]
                  ${collapsed ? 'h-7 justify-center' : 'gap-2 px-2.5 py-2'}`}
              >
                {collapsed
                  ? <PanelLeftOpen width={14} height={14} />
                  : <><PanelLeftClose width={14} height={14} /><span className="text-xs font-medium">Colapsar</span></>
                }
              </button>
            </div>
          </div>
        </aside>

        {/* DRAWER tablet */}
        {drawerOpen && (
          <>
            <div onClick={() => setDrawerOpen(false)} className="fixed inset-0 top-16 z-40 bg-black/30 lg:hidden" />
            <div className="fixed left-0 top-16 z-50 flex h-[calc(100vh-64px)] w-56 flex-col overflow-y-auto border-r border-[#e8e8e8] bg-[#f8f5f0] shadow-lg lg:hidden">
              <div className="border-b border-[#e8e8e8] px-4 py-5">
                {event?.event_type && (
                  <p className="mb-1 text-[11px] text-[#999]">{EVENT_TYPE_LABELS[event.event_type] || event.event_type}</p>
                )}
                <p className="text-sm font-bold leading-snug text-[#1D1E20]">{event?.name || '...'}</p>
                {event?.event_date && (
                  <p className="mt-1 text-[11px] text-[#999]">{formatDate(event.event_date)}</p>
                )}
                {event?.venue && (
                  <p className="mt-0.5 text-[11px] text-[#aaa]">{event.venue}</p>
                )}
              </div>
              <nav className="flex-1 py-2">
                {visibleEntries.map(entry =>
                  entry.type === 'item' ? renderSidebarItem(entry) : renderSidebarGroup(entry)
                )}
              </nav>
            </div>
          </>
        )}

        {/* MAIN */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white pb-16 sm:pb-0">
          {children}
        </main>
      </div>

      {/* BOTTOM NAV mobile — todos los sub-items aplanados individualmente */}
      <nav
        ref={navScrollRef}
        className="fixed bottom-0 left-0 right-0 z-40 flex overflow-x-auto border-t border-[#e8e8e8] bg-white sm:hidden"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <button
          onClick={() => router.push('/dashboard')}
          className="flex shrink-0 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-[#bbb] transition"
          style={{ minWidth: '72px', scrollSnapAlign: 'center' }}
        >
          <House width={18} height={18} strokeWidth={1.5} />
          <span>Inicio</span>
        </button>

        {mobileItems.map(item => (
          <button
            key={item.key}
            onClick={() => navigate(item.path)}
            className={`flex shrink-0 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition
              ${item.active ? 'text-[#48C9B0]' : 'text-[#bbb]'}`}
            style={{ minWidth: '72px', scrollSnapAlign: 'center' }}
          >
            {item.active ? item.iconFilled : item.iconOutline}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function EventLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams()
  return (
    <EventAccessProvider eventId={id as string}>
      <EventLayoutInner>{children}</EventLayoutInner>
    </EventAccessProvider>
  )
}