'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { EventStatus } from '@/lib/types'
import { getTemplatePack } from '@/lib/message-templates'
import DatePicker from '@/app/components/ui/DatePicker'
import TimePicker from '@/app/components/ui/TimePicker'
import { TabToggle, type TabItem } from '@/app/components/ui/TabToggle'
import { useEventAccess } from '@/lib/event-access-context'
import { FEATURES, ALWAYS_ON_FEATURES, getDefaultFeatures, type FeatureKey } from '@/lib/features'
import { Copy, Check, UserPlus, X, Shield, Pencil, Eye, Settings2, MessageCircle, Users, Smartphone, Gem, Crown, Cake, GraduationCap, Sun, PartyPopper, Wine, CalendarDays, Presentation, Monitor, UsersRound, Rocket, Building2, Tent, Mic, Flame, HeartHandshake, type LucideIcon } from 'lucide-react'

// ─── Constantes ──────────────────────────────────────────────────────────────

const EVENT_TYPES: { value: string; label: string; category: string; icon: LucideIcon }[] = [
  { value: 'boda',         label: 'Boda',        category: 'social',      icon: Gem },
  { value: 'xv',           label: 'XV anos',     category: 'social',      icon: Crown },
  { value: 'cumpleanos',   label: 'Cumpleanos',  category: 'social',      icon: Cake },
  { value: 'graduacion',   label: 'Graduacion',  category: 'social',      icon: GraduationCap },
  { value: 'bautizo',      label: 'Bautizo',     category: 'social',      icon: Sun },
  { value: 'fiesta',       label: 'Fiesta',      category: 'social',      icon: PartyPopper },
  { value: 'despedida',    label: 'Despedida',   category: 'social',      icon: Wine },
  { value: 'otro',         label: 'Otro',        category: 'social',      icon: CalendarDays },
  { value: 'conferencia',  label: 'Conferencia', category: 'corporativo', icon: Presentation },
  { value: 'capacitacion', label: 'Capacitacion',category: 'corporativo', icon: Monitor },
  { value: 'teambuilding', label: 'Team',        category: 'corporativo', icon: UsersRound },
  { value: 'lanzamiento',  label: 'Lanzamiento', category: 'corporativo', icon: Rocket },
  { value: 'asamblea',     label: 'Asamblea',    category: 'corporativo', icon: Building2 },
  { value: 'retiro',       label: 'Retiro',      category: 'impacto',     icon: Tent },
  { value: 'congreso',     label: 'Congreso',    category: 'impacto',     icon: Mic },
  { value: 'campamento',   label: 'Campamento',  category: 'impacto',     icon: Flame },
  { value: 'caridad',      label: 'Caridad',     category: 'impacto',     icon: HeartHandshake },
]

const TYPE_CATEGORIES = [
  { value: 'social',      label: 'Social' },
  { value: 'corporativo', label: 'Corporativo' },
  { value: 'impacto',     label: 'Impacto' },
]

// Variables base disponibles para todos los tipos
const BASE_VARIABLES = [
  { key: '{planner}',   label: 'planner' },
  { key: '{nombre}',    label: 'nombre' },
  { key: '{evento}',    label: 'evento' },
  { key: '{fecha}',     label: 'fecha' },
  { key: '{hora}',      label: 'hora' },
  { key: '{venue}',     label: 'venue' },
  { key: '{direccion}', label: 'direccion' },
  { key: '{playlist}',  label: 'playlist' },
  { key: '{album}',     label: 'album' },
]

// Variables extra según tipo de evento
const EXTRA_VARIABLES: Record<string, { key: string; label: string }[]> = {
  boda:       [{ key: '{novia}', label: 'novia' }, { key: '{novio}', label: 'novio' }],
  xv:         [{ key: '{festejada}', label: 'festejada' }],
  cumpleanos: [{ key: '{festejado}', label: 'festejado' }],
  graduacion: [{ key: '{graduado}',  label: 'graduado' }],
  bautizo:    [{ key: '{bautizado}', label: 'bautizado' }],
  despedida:  [{ key: '{festejado}', label: 'festejado' }],
  fiesta:     [{ key: '{anfitrion}', label: 'anfitrion' }],
  conferencia:  [{ key: '{empresa}', label: 'empresa' }],
  capacitacion: [{ key: '{empresa}', label: 'empresa' }],
  teambuilding: [{ key: '{empresa}', label: 'empresa' }],
  lanzamiento:  [{ key: '{empresa}', label: 'empresa' }],
  asamblea:     [{ key: '{empresa}', label: 'empresa' }],
  congreso:     [{ key: '{empresa}', label: 'empresa' }],
  caridad:      [{ key: '{empresa}', label: 'empresa' }],
}

const DEFAULT_NAMES = [
  'Bienvenida', 'Recordatorio', 'Confirmacion', 'Invitacion playlist',
  'Invitacion fotos', 'Plantilla 6', 'Plantilla 7', 'Plantilla 8', 'Plantilla 9', 'Plantilla 10',
]

const STATUS_STYLES: Record<EventStatus, { dot: string; badge: string; label: string }> = {
  active:    { dot: 'bg-[#48C9B0]', badge: 'border-[#c8ede7] bg-[#f0fdfb] text-[#1a9e88]', label: 'Activo' },
  paused:    { dot: 'bg-blue-400',  badge: 'border-blue-200 bg-blue-50 text-blue-700',      label: 'Pausado' },
  cancelled: { dot: 'bg-red-400',   badge: 'border-red-200 bg-red-50 text-red-600',         label: 'Cancelado' },
  completed: { dot: 'bg-[#888]',    badge: 'border-[#e0e0e0] bg-[#f8f8f8] text-[#888]',    label: 'Completado' },
}

const STATUS_OPTIONS: { status: EventStatus; label: string; dot: string }[] = [
  { status: 'active',    label: 'Activo',    dot: 'bg-[#48C9B0]' },
  { status: 'paused',    label: 'Pausado',   dot: 'bg-blue-400' },
  { status: 'cancelled', label: 'Cancelado', dot: 'bg-red-400' },
]

const ROLES = [
  { value: 'admin',  label: 'Admin',  description: 'Edita e invita colaboradores', icon: Shield },
  { value: 'editor', label: 'Editor', description: 'Edita invitados y mesas',      icon: Pencil },
  { value: 'viewer', label: 'Viewer', description: 'Solo lectura',                 icon: Eye },
]

const TABS: TabItem[] = [
  { key: 'evento',   label: 'Evento',   icon: Settings2 },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'equipo',   label: 'Equipo',   icon: Users },
]

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Collaborator {
  id: string
  email: string
  role: string
  status: string
  invite_token: string
  invited_at: string
  accepted_at: string | null
  user_id: string | null
}

// ─── TemplateInput ───────────────────────────────────────────────────────────

function TemplateInput({
  index, value, name, eventType, onChange, onNameChange, placeholder, onDelete, onClear, canDelete,
}: {
  index: number
  value: string
  name: string
  eventType: string
  onChange: (val: string) => void
  onNameChange: (val: string) => void
  placeholder: string
  onDelete?: () => void
  onClear?: () => void
  canDelete?: boolean
}) {
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState(name)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const variables = [
    ...BASE_VARIABLES,
    ...(EXTRA_VARIABLES[eventType] || []),
  ]

  const insertVariable = (variable: string) => {
    const el = textareaRef.current
    if (!el) { onChange(value + variable); return }
    const start  = el.selectionStart
    const end    = el.selectionEnd
    const newVal = value.substring(0, start) + variable + value.substring(end)
    onChange(newVal)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + variable.length, start + variable.length)
    }, 0)
  }

  const startEditName = () => {
    setNameInput(name)
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.select(), 0)
  }

  const commitName = () => {
    const trimmed = nameInput.trim()
    onNameChange(trimmed || DEFAULT_NAMES[index])
    setEditingName(false)
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') { setEditingName(false); setNameInput(name) }
              }}
              className="rounded border border-[#48C9B0] bg-white px-2 py-0.5 text-xs font-semibold text-[#1D1E20] outline-none"
              style={{ minWidth: 0, width: Math.max(nameInput.length, 8) + 'ch' }}
            />
          ) : (
            <button
              onDoubleClick={startEditName}
              title="Doble click para renombrar"
              className="group flex items-center gap-1 text-xs font-semibold text-[#555] transition hover:text-[#48C9B0]"
            >
              {name}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onClear && (
            <button onClick={onClear} className="text-xs text-[#888] transition hover:text-[#1D1E20]">
              Limpiar
            </button>
          )}
          {canDelete && onDelete && (
            <button onClick={onDelete} className="text-xs text-[#cc3333] transition hover:text-[#aa2222]">
              Eliminar
            </button>
          )}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-y rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 font-sans text-sm leading-relaxed text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
      />
      <div className="mt-1.5 flex flex-wrap gap-1">
        {variables.map(v => (
          <button
            key={v.key}
            type="button"
            onClick={() => insertVariable(v.key)}
            className="rounded-full border border-[#e0e0e0] bg-[#f8f8f8] px-2 py-0.5 font-mono text-[11px] text-[#888] transition hover:border-[#48C9B0] hover:bg-[#f0fdfb] hover:text-[#1a9e88]"
          >
            {'{' + v.label + '}'}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const { id } = useParams()
  const { features, updateFeatures, canAdmin } = useEventAccess()
  const [featureSaving, setFeatureSaving] = useState<FeatureKey | null>(null)

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')
  const [activeTab, setActiveTab] = useState('evento')
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [typeCategory, setTypeCategory] = useState('social')
  const autoSaveTimeoutRef      = useRef<NodeJS.Timeout | null>(null)
  const hasChangesRef           = useRef(false)
  const handleSaveRef           = useRef<(autoSave?: boolean) => void>(() => {})

  // Datos del evento
  const [name, setName]               = useState('')
  const [eventType, setEventType]     = useState('')
  const [hostName, setHostName]       = useState('')
  const [hostName2, setHostName2]     = useState('')
  const [organization, setOrganization] = useState('')
  const [eventDate, setEventDate]     = useState('')
  const [eventEndDate, setEventEndDate] = useState('')
  const [eventTime, setEventTime]     = useState('')
  const [venue, setVenue]             = useState('')
  const [address, setAddress]         = useState('')
  const [eventStatus, setEventStatus] = useState<EventStatus>('active')

  // Acceso

  // Datos de event_settings
  const [settingsId, setSettingsId]           = useState<string | null>(null)
  const [templates, setTemplates]             = useState<string[]>(Array(10).fill(''))
  const [templateNames, setTemplateNames]     = useState<string[]>([...DEFAULT_NAMES])
  const [visibleTemplates, setVisibleTemplates] = useState(2)

  // Status dropdown
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [statusSaving, setStatusSaving]             = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Colaboradores
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [inviteEmail, setInviteEmail]     = useState('')
  const [inviteRole, setInviteRole]       = useState<'admin' | 'editor' | 'viewer'>('editor')
  const [inviting, setInviting]           = useState(false)
  const [inviteError, setInviteError]     = useState('')
  const [copiedToken, setCopiedToken]     = useState<string | null>(null)
  const [revoking, setRevoking]           = useState<string | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  useEffect(() => { loadEvent() }, [])
  useEffect(() => {
    return () => { if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current) }
  }, [])

  const applyPack = (pack: { name: string; body: string }[]) => {
    const newTemplates = [...pack.map(t => t.body), ...Array(10).fill('')].slice(0, 10)
    const newNames     = [...pack.map(t => t.name), ...DEFAULT_NAMES].slice(0, 10).map((n, i) => n || DEFAULT_NAMES[i])
    setTemplates(newTemplates)
    setTemplateNames(newNames)
    setVisibleTemplates(Math.max(2, pack.length))
    return { newTemplates, newNames }
  }

  // true si los slots no han sido editados a mano (vacios o iguales al pack del tipo dado)
  const templatesArePristine = (forType: string) =>
    templates.every((t, i) => !t?.trim() || t === (getTemplatePack(forType)[i]?.body ?? ''))

  const loadEvent = async () => {
    const [{ data: eventData }, { data: settingsData }, { data: collabData }] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase.from('event_settings').select('*').eq('event_id', id).single(),
      supabase.from('event_collaborators').select('*').eq('event_id', id).neq('status', 'revoked').order('invited_at', { ascending: true }),
    ])

    if (eventData) {
      setName(eventData.name || '')
      const loadedType = eventData.event_type || ''
      setEventType(loadedType)
      if (loadedType) {
        const found = EVENT_TYPES.find(t => t.value === loadedType)
        if (found) setTypeCategory(found.category)
      }
      setHostName(eventData.host_name || '')
      setHostName2(eventData.host_name_2 || '')
      setOrganization(eventData.organization || '')
      setEventDate(eventData.event_date ? eventData.event_date.split('T')[0] : '')
      setEventEndDate(eventData.event_end_date ? eventData.event_end_date.split('T')[0] : '')
      setEventTime(eventData.event_time || '')
      setVenue(eventData.venue || '')
      setAddress(eventData.address || '')
      setEventStatus(eventData.event_status || 'active')
    }

    if (settingsData) {
      setSettingsId(settingsData.id)
      if (Array.isArray(settingsData.message_templates)) {
        const loaded = [...settingsData.message_templates, ...Array(10).fill('')].slice(0, 10)
        setTemplates(loaded)
        let lastFilledIndex = -1
        for (let i = loaded.length - 1; i >= 0; i--) {
          if (loaded[i]?.trim()) { lastFilledIndex = i; break }
        }
        setVisibleTemplates(Math.max(2, lastFilledIndex + 1))
      }
      if (Array.isArray(settingsData.template_names)) {
        const loadedNames = [...settingsData.template_names, ...DEFAULT_NAMES].slice(0, 10)
        setTemplateNames(loadedNames.map((n: string, i: number) => n || DEFAULT_NAMES[i]))
      }
    }

    // Sembrar plantillas recomendadas por tipo si los slots estan vacios
    const loadedTemplates = Array.isArray(settingsData?.message_templates) ? settingsData!.message_templates : []
    const allEmpty = !loadedTemplates.some((t: string) => t?.trim())
    if (allEmpty && eventData?.event_type) {
      const { newTemplates, newNames } = applyPack(getTemplatePack(eventData.event_type))
      await supabase.from('event_settings').upsert({
        ...(settingsData?.id ? { id: settingsData.id } : {}),
        event_id:          id,
        message_templates: newTemplates,
        template_names:    newNames,
        updated_at:        new Date().toISOString(),
      }, { onConflict: 'event_id' })
    }

    if (collabData) setCollaborators(collabData as Collaborator[])
    setLoading(false)
  }

  const handleSave = async (autoSave = false) => {
    if (!name) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError(''); setSaved(false)

    // Campos contextuales según tipo
    const isSocial = ['boda','xv','cumpleanos','graduacion','bautizo','fiesta','despedida','otro'].includes(eventType)
    const isCorp   = ['conferencia','capacitacion','teambuilding','lanzamiento','asamblea','congreso','caridad'].includes(eventType)

    // El acceso (modo, aprobacion, cupo y precio) ya NO se guarda aqui: vive en
    // la pestana Enviar de la invitacion. Escribirlo desde aqui pisaria con
    // estado viejo lo que el anfitrion acabe de cambiar alla.
    const { error: eventErr } = await supabase.from('events').update({
      name,
      event_type:     eventType || null,
      event_date:     eventDate || null,
      event_end_date: eventEndDate || null,
      event_time:     eventTime || null,
      venue:          venue || null,
      address:        address || null,
      host_name:      isSocial ? (hostName || null) : null,
      host_name_2:    eventType === 'boda' ? (hostName2 || null) : null,
      organization:   isCorp ? (organization || null) : null,
    }).eq('id', id)

    if (eventErr) { setError('Error: ' + eventErr.message); setSaving(false); return }

    const { error: settingsErr } = await supabase.from('event_settings').upsert({
      ...(settingsId ? { id: settingsId } : {}),
      event_id:          id,
      message_templates: templates,
      template_names:    templateNames,
      updated_at:        new Date().toISOString(),
    }, { onConflict: 'event_id' })

    if (settingsErr) { setError('Error: ' + settingsErr.message); setSaving(false); return }

    setSaving(false); setSaved(true)
    hasChangesRef.current = false
    if (!autoSave) {
      setTimeout(() => window.location.reload(), 800)
    } else {
      setTimeout(() => setSaved(false), 2000)
    }
  }

  handleSaveRef.current = handleSave

  const scheduleAutoSave = () => {
    hasChangesRef.current = true
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (hasChangesRef.current) handleSaveRef.current(true)
    }, 2000)
  }

  const handleToggleFeature = async (key: FeatureKey) => {
    if (!features || !canAdmin || featureSaving) return
    setFeatureSaving(key)
    await updateFeatures({ ...features, [key]: !features[key] })
    setFeatureSaving(null)
  }

  const handleStatusChange = async (newStatus: EventStatus) => {
    setStatusSaving(true)
    setShowStatusDropdown(false)
    const { error: err } = await supabase.from('events').update({ event_status: newStatus }).eq('id', id)
    if (!err) setEventStatus(newStatus)
    setStatusSaving(false)
  }

  const updateTemplate = (i: number, value: string) => {
    setTemplates(prev => prev.map((t, idx) => idx === i ? value : t))
    scheduleAutoSave()
  }

  const updateTemplateName = (i: number, value: string) => {
    setTemplateNames(prev => prev.map((n, idx) => idx === i ? value : n))
    scheduleAutoSave()
  }

  const handleDeleteTemplate = (i: number) => {
    if (!confirm('Eliminar esta plantilla?')) return
    const newTemplates = templates.filter((_, idx) => idx !== i)
    while (newTemplates.length < 10) newTemplates.push('')
    const newNames = templateNames.filter((_, idx) => idx !== i)
    while (newNames.length < 10) newNames.push(DEFAULT_NAMES[newNames.length])
    setTemplates(newTemplates)
    setTemplateNames(newNames)
    setVisibleTemplates(Math.max(1, visibleTemplates - 1))
    scheduleAutoSave()
  }

  const handleClearTemplate = (i: number) => {
    setTemplates(prev => prev.map((t, idx) => idx === i ? '' : t))
    scheduleAutoSave()
  }

  const openMaps = () => {
    window.open('https://maps.google.com?q=' + encodeURIComponent(address), '_blank', 'noopener,noreferrer')
  }

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) { setInviteError('Ingresa un email'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setInviteError('Email invalido'); return }
    if (collaborators.find(c => c.email === email)) { setInviteError('Este email ya tiene acceso'); return }
    setInviting(true); setInviteError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setInviteError('Sesion expirada'); setInviting(false); return }
    const { data, error: err } = await supabase
      .from('event_collaborators')
      .insert({ event_id: id, invited_by: user.id, email, role: inviteRole, status: 'pending' })
      .select().single()
    if (err) { setInviteError('Error al crear invitacion'); setInviting(false); return }
    setCollaborators(prev => [...prev, data as Collaborator])
    setInviteEmail('')
    setInviting(false)
  }

  const handleCopyLink = async (token: string) => {
    const link = `${window.location.origin}/invite/${token}`
    await navigator.clipboard.writeText(link)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const handleRevoke = async (collaboratorId: string) => {
    if (!confirm('Revocar acceso a este colaborador?')) return
    setRevoking(collaboratorId)
    const { error: err } = await supabase
      .from('event_collaborators')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', collaboratorId)
    if (!err) setCollaborators(prev => prev.filter(c => c.id !== collaboratorId))
    setRevoking(null)
  }

  const eventDays = eventDate && eventEndDate
    ? Math.max(1, Math.round((new Date(eventEndDate).getTime() - new Date(eventDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : null

  const isBoda    = eventType === 'boda'
  const isSocial  = ['boda','xv','cumpleanos','graduacion','bautizo','fiesta','despedida','otro'].includes(eventType)
  const isCorp    = ['conferencia','capacitacion','teambuilding','lanzamiento','asamblea','congreso','caridad'].includes(eventType)

  // Labels dinámicos según tipo
  const hostLabel = isBoda ? 'Novia' : eventType === 'xv' ? 'Festejada' : eventType === 'graduacion' ? 'Graduado/a' : eventType === 'bautizo' ? 'Bautizado/a' : 'Festejado/a'

  if (loading) return <div className="p-8 text-sm text-[#666]">Cargando...</div>

  const badgeStyle      = STATUS_STYLES[eventStatus]
  const dropdownOptions = STATUS_OPTIONS.filter(o => o.status !== eventStatus)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">

      {/* HEADER */}
      <div className="shrink-0 border-b border-[#e8e8e8] bg-white px-4 py-4 sm:px-6 lg:px-8">

        {/* Desktop: 3 zonas — titulo | toggle centrado | guardar */}
        <div className="hidden sm:grid sm:grid-cols-3 sm:items-center">

          {/* Izquierda: titulo + status */}
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-[#1D1E20]">Configuracion</h1>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                disabled={statusSaving}
                className={'flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-50 ' + badgeStyle.badge}
              >
                <span className={'h-1.5 w-1.5 rounded-full ' + badgeStyle.dot} />
                {statusSaving ? 'Guardando...' : badgeStyle.label}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-60">
                  <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {showStatusDropdown && (
                <div className="absolute left-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
                  <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#bbb]">Cambiar estado</div>
                  {dropdownOptions.map(opt => (
                    <button key={opt.status} onClick={() => handleStatusChange(opt.status)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs text-[#555] transition hover:bg-[#f8f8f8]">
                      <span className={'h-2 w-2 rounded-full ' + opt.dot} />{opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Centro: toggle */}
          <div className="flex justify-center">
            <TabToggle tabs={TABS} active={activeTab} onChange={setActiveTab} />
          </div>

          {/* Derecha: guardar */}
          <div className="flex justify-end">
            {activeTab !== 'equipo' && (
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className={(saved ? 'border border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]' : saving ? 'bg-[#a0e0d8] text-white' : 'bg-[#48C9B0] text-white hover:bg-[#3ab89f]') + ' rounded-lg px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed'}
              >
                {saved ? 'Guardado' : saving ? 'Guardando...' : 'Guardar'}
              </button>
            )}
          </div>
        </div>

        {/* Mobile: titulo + guardar en fila, toggle full width abajo */}
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-[#1D1E20]">Configuracion</h1>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                disabled={statusSaving}
                className={'flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-50 ' + badgeStyle.badge}
              >
                <span className={'h-1.5 w-1.5 rounded-full ' + badgeStyle.dot} />
                {statusSaving ? 'Guardando...' : badgeStyle.label}
              </button>
              {showStatusDropdown && (
                <div className="absolute left-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
                  <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#bbb]">Cambiar estado</div>
                  {dropdownOptions.map(opt => (
                    <button key={opt.status} onClick={() => handleStatusChange(opt.status)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs text-[#555] transition hover:bg-[#f8f8f8]">
                      <span className={'h-2 w-2 rounded-full ' + opt.dot} />{opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {activeTab !== 'equipo' && (
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className={(saved ? 'border border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]' : saving ? 'bg-[#a0e0d8] text-white' : 'bg-[#48C9B0] text-white hover:bg-[#3ab89f]') + ' rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed'}
            >
              {saved ? 'Guardado' : saving ? 'Guardando...' : 'Guardar'}
            </button>
          )}
        </div>

        {/* Mobile: toggle full width */}
        <div className="mt-3 sm:hidden">
          <div className="grid grid-cols-4 gap-0.5 rounded-lg border border-[#e8e8e8] bg-[#f4f4f4] p-0.5">
            {TABS.map(tab => {
              const Icon = tab.icon
              const isActive = tab.key === activeTab
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={'flex items-center justify-center gap-1.5 rounded-md py-2 text-xs transition ' +
                    (isActive ? 'bg-white font-medium text-[#1D1E20] shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#e8e8e8]' : 'font-normal text-[#888]')}
                >
                  <Icon size={13} className={isActive ? 'text-[#48C9B0]' : 'text-[#bbb]'} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2.5 text-xs text-[#cc3333]">{error}</div>
        )}
      </div>

      {/* CONTENIDO */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-6">

          {/* ── TAB: EVENTO ── */}
          {activeTab === 'evento' && (
            <div className="flex flex-col gap-4 sm:gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start lg:gap-8">

              {/* Datos generales */}
              <div>
                <h2 className="mb-4 text-sm font-semibold text-[#1D1E20]">Datos generales</h2>
                <div className="flex flex-col gap-3">

                  {/* Tipo de evento — full width, el grande */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#555]">Tipo de evento</label>
                    {eventType && !showTypeSelector ? (
                      <div className="flex items-center gap-2">
                        {(() => {
                          const found = EVENT_TYPES.find(t => t.value === eventType)
                          const Icon = found?.icon
                          return (
                            <span className="flex items-center gap-1.5 rounded-lg border border-[#48C9B0] bg-[#f0fdfb] px-3 py-2 text-xs font-semibold text-[#1a9e88]">
                              {Icon && <Icon size={13} className="text-[#48C9B0]" />}
                              {found?.label ?? eventType}
                            </span>
                          )
                        })()}
                        <button onClick={() => setShowTypeSelector(true)}
                          className="text-xs text-[#888] underline underline-offset-2 transition hover:text-[#1D1E20]">
                          Cambiar
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
                        <div className="mb-3 flex gap-1.5">
                          {TYPE_CATEGORIES.map(cat => (
                            <button key={cat.value} onClick={() => setTypeCategory(cat.value)}
                              className={'rounded-lg border px-3 py-1.5 text-xs font-medium transition ' + (typeCategory === cat.value ? 'border-[#48C9B0] bg-[#f0fdfb] text-[#0F6E56]' : 'border-[#e0e0e0] text-[#666] hover:border-[#48C9B0]')}>
                              {cat.label}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                          {EVENT_TYPES.filter(t => t.category === typeCategory).map(type => {
                            const Icon = type.icon
                            const isSelected = eventType === type.value
                            return (
                              <button key={type.value}
                                onClick={() => { if (templatesArePristine(eventType)) applyPack(getTemplatePack(type.value)); setEventType(type.value); setShowTypeSelector(false); scheduleAutoSave() }}
                                className={'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 transition ' + (isSelected ? 'border-[#48C9B0] bg-[#f0fdfb]' : 'border-[#e0e0e0] text-[#444] hover:border-[#48C9B0] hover:bg-[#f0fdfb]')}>
                                <Icon size={16} className={isSelected ? 'text-[#48C9B0]' : 'text-[#888]'} />
                                <span className={'text-[11px] leading-tight text-center ' + (isSelected ? 'font-semibold text-[#1a9e88]' : 'text-[#555]')}>
                                  {type.label}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                        {eventType && (
                          <button onClick={() => setShowTypeSelector(false)}
                            className="mt-2 text-xs text-[#bbb] transition hover:text-[#888]">
                            Cancelar
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Resto de campos — grilla uniforme 33% */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-start">

                    {/* Nombre */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#555]">Nombre *</label>
                      <input type="text" value={name} onChange={e => { setName(e.target.value); scheduleAutoSave() }}
                        placeholder="Boda Ana & Carlos"
                        className="w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                      />
                    </div>

                    {/* Anfitrion principal (Novia / Festejada / etc.) */}
                    {isSocial && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#555]">
                          {hostLabel} <span className="font-normal text-[#bbb]">(opc.)</span>
                        </label>
                        <input type="text" value={hostName} onChange={e => { setHostName(e.target.value); scheduleAutoSave() }}
                          placeholder={hostLabel}
                          className="w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                        />
                      </div>
                    )}

                    {/* Novio */}
                    {isBoda && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#555]">
                          Novio <span className="font-normal text-[#bbb]">(opc.)</span>
                        </label>
                        <input type="text" value={hostName2} onChange={e => { setHostName2(e.target.value); scheduleAutoSave() }}
                          placeholder="Novio"
                          className="w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                        />
                      </div>
                    )}

                    {/* Empresa u organizacion */}
                    {isCorp && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#555]">
                          Empresa u organizacion <span className="font-normal text-[#bbb]">(opc.)</span>
                        </label>
                        <input type="text" value={organization} onChange={e => { setOrganization(e.target.value); scheduleAutoSave() }}
                          placeholder="Grupo Femsa, ITESM, etc."
                          className="w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                        />
                      </div>
                    )}

                    {/* Fecha (inicio + fin) */}
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-[#555]">Fecha</label>
                      <DatePicker
                        mode="range"
                        startValue={eventDate}
                        endValue={eventEndDate}
                        onRangeChange={(start, end) => { setEventDate(start); setEventEndDate(end); scheduleAutoSave() }}
                        placeholder="Fecha"
                      />
                    </div>

                    {/* Hora */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#555]">Hora</label>
                      <TimePicker value={eventTime} onChange={v => { setEventTime(v); scheduleAutoSave() }} />
                    </div>

                    {/* Duracion — full width */}
                    {eventDays && (
                      <div className="flex items-center gap-1.5 rounded-lg border border-[#c8ede7] bg-[#f0fdfb] px-3 py-2 sm:col-span-3">
                        <span className="text-xs font-semibold text-[#1a9e88]">{eventDays === 1 ? '1 dia' : `${eventDays} dias`}</span>
                        <span className="text-xs text-[#888]">de duracion</span>
                      </div>
                    )}

                    {/* Venue */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#555]">Venue</label>
                      <input type="text" value={venue} onChange={e => { setVenue(e.target.value); scheduleAutoSave() }}
                        placeholder="Hacienda San Miguel"
                        className="w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                      />
                    </div>

                    {/* Direccion — 2/3 para cerrar la fila */}
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-[#555]">Direccion</label>
                      <div className="flex gap-2">
                        <input type="text" value={address} onChange={e => { setAddress(e.target.value); scheduleAutoSave() }}
                          placeholder="Carr. Saltillo-Monterrey Km 4.5"
                          className="flex-1 rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                        />
                        {address && (
                          <button type="button" onClick={openMaps}
                            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-[#d0d0d0] bg-white px-3 py-2 text-xs text-[#666] transition hover:border-[#48C9B0] hover:text-[#1a9e88]">
                            Maps
                          </button>
                        )}
                      </div>
                    </div>

                  </div>

                </div>
              </div>

              {/* Herramientas del evento */}
              <div>
                <h2 className="mb-1 text-sm font-semibold text-[#1D1E20]">Herramientas del evento</h2>
                <p className="mb-4 text-xs text-[#888]">
                  Activa solo lo que tu evento necesita. Apagar una herramienta no borra sus datos — solo la oculta del menú.
                </p>

                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  {ALWAYS_ON_FEATURES.map(label => (
                    <span key={label} className="rounded-full border border-[#e8e8e8] bg-[#f8f8f8] px-2.5 py-1 text-[11px] font-medium text-[#888]">
                      {label}
                    </span>
                  ))}
                  <span className="text-[11px] text-[#bbb]">siempre incluidas</span>
                </div>

                {features ? (
                  <div className="flex flex-col gap-2">
                    {FEATURES.map(f => {
                      const Icon = f.icon
                      const on = features[f.key]
                      const recommended = getDefaultFeatures(eventType)[f.key]
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => handleToggleFeature(f.key)}
                          disabled={!canAdmin || featureSaving !== null}
                          className={
                            'flex items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed ' +
                            (on ? 'border-[#c8ede7] bg-[#f0fdfb]' : 'border-[#e8e8e8] bg-white hover:border-[#d0d0d0]')
                          }
                        >
                          <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + (on ? 'bg-[#d0f5ec]' : 'bg-[#f4f4f4]')}>
                            <Icon size={18} className={on ? 'text-[#0F6E56]' : 'text-[#888]'} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-[#1D1E20]">{f.label}</p>
                              {recommended && (
                                <span className="rounded-full border border-[#f0e2c0] bg-[#fffbf0] px-2 py-0.5 text-[10px] font-semibold text-[#c49a3a]">
                                  Recomendado
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-[#888]">{f.description}</p>
                          </div>
                          {featureSaving === f.key ? (
                            <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
                          ) : (
                            <div className={'relative h-6 w-11 shrink-0 rounded-full transition ' + (on ? 'bg-[#48C9B0]' : 'bg-[#e0e0e0]')}>
                              <span className={'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ' + (on ? 'left-[22px]' : 'left-0.5')} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-[#aaa]">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
                    Cargando herramientas...
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── TAB: WHATSAPP ── */}
          {activeTab === 'whatsapp' && (
            <div className="flex flex-col gap-4 sm:gap-5">

              {/* Numero WhatsApp — proximamente */}
              <div className="rounded-xl border border-dashed border-[#e0e0e0] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0fdfb]">
                    <Smartphone size={18} className="text-[#48C9B0]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#1D1E20]">Numero de WhatsApp</p>
                    <p className="mt-0.5 text-xs text-[#888]">
                      Los mensajes se envian desde el numero compartido de Anfiora. Proximamente podras conectar tu propio numero de WhatsApp Business.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded-full border border-[#c8ede7] bg-[#f0fdfb] px-2.5 py-1 text-[11px] font-semibold text-[#1a9e88]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#48C9B0]" />
                        Activo — Numero Anfiora
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Plantillas */}
              <div>
                <h2 className="mb-1 text-sm font-semibold text-[#1D1E20]">Plantillas de mensajes</h2>
                <p className="mb-4 text-xs text-[#666]">
                  Doble click en el nombre para renombrarlo. Usa los chips para insertar variables dinamicas.
                  {eventType && (
                    <span className="ml-1 text-[#48C9B0]">
                      Variables de {EVENT_TYPES.find(t => t.value === eventType)?.label ?? eventType} incluidas.
                    </span>
                  )}
                </p>
                {eventType && (
                  <button
                    onClick={() => {
                      const label = EVENT_TYPES.find(t => t.value === eventType)?.label ?? 'este evento'
                      if (!templatesArePristine(eventType) && !window.confirm('Esto reemplazara tus plantillas por las recomendadas para ' + label + '. Continuar?')) return
                      applyPack(getTemplatePack(eventType))
                      scheduleAutoSave()
                    }}
                    className="mb-4 rounded-lg border border-[#c8ede7] bg-[#f0fdfb] px-3 py-2 text-xs font-semibold text-[#1a9e88] transition hover:bg-[#e3f7f3]">
                    Cargar plantillas recomendadas de {EVENT_TYPES.find(t => t.value === eventType)?.label ?? eventType}
                  </button>
                )}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:items-start">
                  {templates.slice(0, visibleTemplates).map((template, i) => (
                    <TemplateInput
                      key={i}
                      index={i}
                      value={template}
                      name={templateNames[i] || DEFAULT_NAMES[i]}
                      eventType={eventType}
                      onChange={val => updateTemplate(i, val)}
                      onNameChange={val => updateTemplateName(i, val)}
                      placeholder={i === 0 ? 'Hola {nombre}, soy {planner}. Te esperamos en {evento} el {fecha} a las {hora}' : 'Escribe aqui tu mensaje...'}
                      onDelete={() => handleDeleteTemplate(i)}
                      onClear={() => handleClearTemplate(i)}
                      canDelete={i > 0}
                    />
                  ))}
                  {visibleTemplates < 10 && (
                    <button onClick={() => setVisibleTemplates(v => Math.min(v + 1, 10))}
                      className="flex items-center gap-1.5 text-xs text-[#48C9B0] transition hover:text-[#3ab89f] sm:col-span-2">
                      <span className="text-base leading-none">+</span> Agregar plantilla
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ── TAB: EQUIPO ── */}
          {activeTab === 'equipo' && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <UserPlus size={16} className="text-[#48C9B0]" />
                <h2 className="text-sm font-semibold text-[#1D1E20]">Acceso al evento</h2>
              </div>
              <p className="mb-4 text-xs text-[#666]">
                Invita a otras personas a colaborar en este evento. Copia el link y mandaselo por WhatsApp o email.
              </p>

              <div className="mb-4 flex flex-col gap-2.5">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => { setInviteEmail(e.target.value); setInviteError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                  placeholder="email@ejemplo.com"
                  className="w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                />
                <div className="grid grid-cols-3 gap-1.5">
                  {ROLES.map(r => {
                    const Icon = r.icon
                    return (
                      <button
                        key={r.value}
                        onClick={() => setInviteRole(r.value as 'admin' | 'editor' | 'viewer')}
                        className={'flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition ' +
                          (inviteRole === r.value
                            ? 'border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]'
                            : 'border-[#e0e0e0] bg-white text-[#888] hover:border-[#48C9B0] hover:text-[#1a9e88]')}
                      >
                        <Icon size={14} />
                        <span className="text-[11px] font-semibold">{r.label}</span>
                        <span className="text-[10px] leading-tight text-[#aaa]">{r.description}</span>
                      </button>
                    )
                  })}
                </div>
                {inviteError && <p className="text-xs text-[#cc3333]">{inviteError}</p>}
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#48C9B0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-40"
                >
                  <UserPlus size={14} />
                  {inviting ? 'Creando invitacion...' : 'Generar link de invitacion'}
                </button>
              </div>

              {collaborators.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#bbb]">Con acceso</p>
                  {collaborators.map(c => {
                    const roleInfo = ROLES.find(r => r.value === c.role)
                    const Icon     = roleInfo?.icon || Eye
                    const isCopied = copiedToken === c.invite_token
                    return (
                      <div key={c.id} className="flex items-center gap-3 rounded-lg border border-[#e8e8e8] bg-white px-3 py-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0fdfb] text-[11px] font-bold text-[#48C9B0]">
                          {c.email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-[#1D1E20]">{c.email}</p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <Icon size={10} className="text-[#aaa]" />
                            <span className="text-[10px] text-[#aaa]">{roleInfo?.label}</span>
                            <span className="text-[10px] text-[#ccc]">·</span>
                            <span className={'text-[10px] font-medium ' + (c.status === 'active' ? 'text-[#48C9B0]' : 'text-[#f0a500]')}>
                              {c.status === 'active' ? 'Activo' : 'Pendiente'}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {c.status === 'pending' && (
                            <button onClick={() => handleCopyLink(c.invite_token)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e0e0e0] text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
                              {isCopied ? <Check size={12} className="text-[#48C9B0]" /> : <Copy size={12} />}
                            </button>
                          )}
                          <button onClick={() => handleRevoke(c.id)} disabled={revoking === c.id}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e0e0e0] text-[#888] transition hover:border-[#cc3333] hover:text-[#cc3333] disabled:opacity-40">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}