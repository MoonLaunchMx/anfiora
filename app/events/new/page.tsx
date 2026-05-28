'use client'

import DatePicker from '@/app/components/ui/DatePicker'
import TimePicker from '@/app/components/ui/TimePicker'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Gem, Crown, Cake, GraduationCap, Sun, PartyPopper, Wine,
  Presentation, Monitor, UsersRound, Rocket, Building2,
  Tent, Mic, Flame, HeartHandshake, CalendarDays,
  ChevronRight, ArrowLeft,
} from 'lucide-react'

// ─── Tipos de evento ────────────────────────────────────────────────────────

type EventCategory = 'social' | 'corporativo' | 'impacto'

interface EventTypeConfig {
  value: string
  label: string
  category: EventCategory
  icon: React.ElementType
  hostLabel?: string        // label del campo host_name
  host2Label?: string       // label del campo host_name_2 (opcional)
  showOrg?: boolean         // mostrar campo organización
  showEndDate?: boolean     // mostrar fecha de término
  showCurrency?: boolean    // mostrar selector de moneda
}

const EVENT_TYPES: EventTypeConfig[] = [
  // Social
  { value: 'boda',        label: 'Boda',        category: 'social',      icon: Gem,          hostLabel: 'Novia',       host2Label: 'Novio' },
  { value: 'xv',          label: 'XV años',     category: 'social',      icon: Crown,        hostLabel: 'Festejada' },
  { value: 'cumpleanos',  label: 'Cumpleaños',  category: 'social',      icon: Cake,         hostLabel: 'Festejado/a' },
  { value: 'graduacion',  label: 'Graduación',  category: 'social',      icon: GraduationCap,hostLabel: 'Graduado/a' },
  { value: 'bautizo',     label: 'Bautizo',     category: 'social',      icon: Sun,          hostLabel: 'Nombre del bautizado/a' },
  { value: 'fiesta',      label: 'Fiesta',      category: 'social',      icon: PartyPopper,  hostLabel: 'Anfitrión/a' },
  { value: 'despedida',   label: 'Despedida',   category: 'social',      icon: Wine,         hostLabel: 'Festejado/a' },
  // Corporativo
  { value: 'conferencia', label: 'Conferencia', category: 'corporativo', icon: Presentation, hostLabel: 'Organizador principal', showOrg: true, showEndDate: true, showCurrency: true },
  { value: 'capacitacion',label: 'Capacitación',category: 'corporativo', icon: Monitor,      hostLabel: 'Organizador principal', showOrg: true, showCurrency: true },
  { value: 'teambuilding',label: 'Team Building',category: 'corporativo',icon: UsersRound,   hostLabel: 'Organizador principal', showOrg: true, showCurrency: true },
  { value: 'lanzamiento', label: 'Lanzamiento', category: 'corporativo', icon: Rocket,       hostLabel: 'Organizador principal', showOrg: true, showCurrency: true },
  { value: 'asamblea',    label: 'Asamblea',    category: 'corporativo', icon: Building2,    hostLabel: 'Organizador principal', showOrg: true, showEndDate: true, showCurrency: true },
  // Impacto
  { value: 'retiro',      label: 'Retiro',      category: 'impacto',     icon: Tent,         hostLabel: 'Organizador principal', showEndDate: true },
  { value: 'congreso',    label: 'Congreso',    category: 'impacto',     icon: Mic,          hostLabel: 'Organizador principal', showOrg: true, showEndDate: true, showCurrency: true },
  { value: 'campamento',  label: 'Campamento',  category: 'impacto',     icon: Flame,        hostLabel: 'Organizador principal', showEndDate: true },
  { value: 'caridad',     label: 'Caridad',     category: 'impacto',     icon: HeartHandshake,hostLabel: 'Organizador principal', showOrg: true },
  { value: 'otro',        label: 'Otro',        category: 'social',      icon: CalendarDays, hostLabel: 'Anfitrión/a' },
]

const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: 'social',      label: 'Social' },
  { value: 'corporativo', label: 'Corporativo' },
  { value: 'impacto',     label: 'Impacto' },
]

const CURRENCIES = [
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'USD', label: 'USD — Dólar americano' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
]

function generatePlaylistToken(): string {
  return Math.random().toString(36).substring(2, 10) +
    Math.random().toString(36).substring(2, 10)
}

// ─── Componente ─────────────────────────────────────────────────────────────

export default function NewEvent() {
  const [step, setStep]               = useState<1 | 2>(1)
  const [category, setCategory]       = useState<EventCategory>('social')
  const [eventType, setEventType]     = useState<EventTypeConfig | null>(null)

  // Campos del evento
  const [name, setName]               = useState('')
  const [hostName, setHostName]       = useState('')
  const [hostName2, setHostName2]     = useState('')
  const [organization, setOrganization] = useState('')
  const [date, setDate]               = useState('')
  const [endDate, setEndDate]         = useState('')
  const [time, setTime]               = useState('')
  const [venue, setVenue]             = useState('')
  const [address, setAddress]         = useState('')
  const [currency, setCurrency]       = useState('MXN')

  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  const filteredTypes = EVENT_TYPES.filter(t => t.category === category)

  const handleSelectType = (type: EventTypeConfig) => {
    setEventType(type)
    setStep(2)
    setError('')
  }

  const handleBack = () => {
    setStep(1)
    setError('')
  }

  const handleCreate = async () => {
    if (!name.trim()) { setError('El nombre del evento es obligatorio'); return }
    if (!date)        { setError('La fecha del evento es obligatoria'); return }
    if (!eventType)   { setError('Selecciona un tipo de evento'); return }

    setLoading(true); setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }

    // extra_data agrupa campos opcionales sin tocar el schema todavía
    const extraData: Record<string, string> = {}
    if (hostName.trim())     extraData.host_name    = hostName.trim()
    if (hostName2.trim())    extraData.host_name_2  = hostName2.trim()
    if (organization.trim()) extraData.organization = organization.trim()

    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .insert({
        user_id:        user.id,
        name:           name.trim(),
        event_type:     eventType.value,
        event_date:     date,
        event_end_date: endDate || null,
        event_time:     time || null,
        venue:          venue.trim() || null,
        address:        address.trim() || null,
        currency:       currency,
        total_guests:   0,
        canvas_data:    Object.keys(extraData).length > 0 ? extraData : null,
      })
      .select()
      .single()

    if (eventError) {
      setError('Error al crear el evento: ' + eventError.message)
      setLoading(false)
      return
    }

    const { error: settingsError } = await supabase
      .from('event_settings')
      .insert({
        event_id:          eventData.id,
        playlist_token:    generatePlaylistToken(),
        message_templates: [],
        template_names:    [],
      })

    if (settingsError) {
      console.error('Error creando event_settings:', settingsError.message)
    }

    window.location.href = `/events/${eventData.id}`
  }

  // ─── Render paso 1 ──────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="flex flex-col gap-5">

      {/* Tabs de categoría */}
      <div className="flex gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={
              'rounded-lg border px-4 py-2 text-sm font-medium transition ' +
              (category === cat.value
                ? 'border-[#48C9B0] bg-[#f0fdfb] text-[#0F6E56]'
                : 'border-[#e0e0e0] bg-white text-[#666] hover:border-[#48C9B0] hover:text-[#0F6E56]')
            }
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid de tipos */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {filteredTypes.map(type => {
          const Icon = type.icon
          return (
            <button
              key={type.value}
              onClick={() => handleSelectType(type)}
              className="group flex flex-col items-start gap-3 rounded-xl border border-[#e8e8e8] bg-white p-4 text-left transition hover:border-[#48C9B0] hover:bg-[#f0fdfb] active:scale-[0.98]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f4f4f4] transition group-hover:bg-[#d0f5ec]">
                <Icon size={18} className="text-[#888] transition group-hover:text-[#0F6E56]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1D1E20]">{type.label}</p>
              </div>
              <ChevronRight size={14} className="self-end text-[#ccc] transition group-hover:text-[#48C9B0]" />
            </button>
          )
        })}
      </div>

    </div>
  )

  // ─── Render paso 2 ──────────────────────────────────────────────────────

  const renderStep2 = () => {
    if (!eventType) return null
    const Icon = eventType.icon

    return (
      <div className="flex flex-col gap-4">

        {/* Tipo seleccionado */}
        <div className="flex items-center gap-3 rounded-xl border border-[#c8ede7] bg-[#f0fdfb] px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#d0f5ec]">
            <Icon size={16} className="text-[#0F6E56]" />
          </div>
          <p className="text-sm font-medium text-[#0F6E56]">{eventType.label}</p>
          <button
            onClick={handleBack}
            className="ml-auto flex items-center gap-1 text-xs text-[#888] transition hover:text-[#1D1E20]"
          >
            <ArrowLeft size={12} /> Cambiar
          </button>
        </div>

        {/* Nombre */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#555]">
            Nombre del evento *
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={eventType.value === 'boda' ? 'Boda Ana & Carlos' : 'Nombre del evento'}
            className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
          />
        </div>

        {/* Host name / Host name 2 */}
        {eventType.hostLabel && (
          <div className={eventType.host2Label ? 'grid grid-cols-2 gap-3' : ''}>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#555]">
                {eventType.hostLabel}
                <span className="ml-1 font-normal text-[#bbb]">(opcional)</span>
              </label>
              <input
                type="text"
                value={hostName}
                onChange={e => setHostName(e.target.value)}
                placeholder={eventType.hostLabel}
                className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
              />
            </div>
            {eventType.host2Label && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#555]">
                  {eventType.host2Label}
                  <span className="ml-1 font-normal text-[#bbb]">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={hostName2}
                  onChange={e => setHostName2(e.target.value)}
                  placeholder={eventType.host2Label}
                  className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                />
              </div>
            )}
          </div>
        )}

        {/* Organización */}
        {eventType.showOrg && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#555]">
              Empresa u organización
              <span className="ml-1 font-normal text-[#bbb]">(opcional)</span>
            </label>
            <input
              type="text"
              value={organization}
              onChange={e => setOrganization(e.target.value)}
              placeholder="Grupo Femsa, ITESM, etc."
              className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
            />
          </div>
        )}

        {/* Fechas */}
        <div className={eventType.showEndDate ? 'grid grid-cols-2 gap-3' : ''}>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#555]">
              Fecha *
            </label>
            <DatePicker
              value={date}
              onChange={setDate}
              placeholder="Seleccionar fecha"
            />
          </div>
          {eventType.showEndDate && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#555]">
                Fecha de término
                <span className="ml-1 font-normal text-[#bbb]">(opcional)</span>
              </label>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                placeholder="Fecha de término"
                minDate={date || undefined}
              />
            </div>
          )}
        </div>

        {/* Hora */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#555]">
            Hora
            <span className="ml-1 font-normal text-[#bbb]">(opcional)</span>
          </label>
          <TimePicker value={time} onChange={setTime} />
        </div>

        {/* Venue */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#555]">
            Venue
            <span className="ml-1 font-normal text-[#bbb]">(opcional)</span>
          </label>
          <input
            type="text"
            value={venue}
            onChange={e => setVenue(e.target.value)}
            placeholder="Hacienda San Miguel"
            className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
          />
        </div>

        {/* Dirección */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#555]">
            Dirección
            <span className="ml-1 font-normal text-[#bbb]">(opcional)</span>
          </label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Carr. Saltillo-Monterrey Km 4.5"
            className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
          />
        </div>

        {/* Moneda */}
        {eventType.showCurrency && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#555]">Moneda</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
            >
              {CURRENCIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        )}

      </div>
    )
  }

  // ─── Layout principal ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white font-sans text-[#1D1E20]">

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#e8e8e8] bg-white">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4 sm:h-16 sm:px-6">
          <button onClick={() => window.location.href = '/dashboard'} className="shrink-0">
            <img src="/images/Logo SVG.svg" alt="Anfiora" className="h-8 object-contain" />
          </button>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#888] transition hover:bg-[#f5f5f5]"
          >
            <ArrowLeft size={12} /> Volver
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 sm:px-6 sm:py-10">

        {/* Indicador de pasos */}
        <div className="mb-6 flex items-center gap-2">
          <div className={
            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ' +
            (step === 1 ? 'bg-[#48C9B0] text-white' : 'bg-[#d0f5ec] text-[#0F6E56]')
          }>
            {step === 1 ? '1' : '✓'}
          </div>
          <span className={
            'text-xs font-medium ' +
            (step === 1 ? 'text-[#1D1E20]' : 'text-[#48C9B0]')
          }>
            Tipo de evento
          </span>
          <div className="mx-1 h-px w-6 bg-[#e8e8e8]" />
          <div className={
            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ' +
            (step === 2 ? 'bg-[#48C9B0] text-white' : 'border border-[#e0e0e0] bg-white text-[#bbb]')
          }>
            2
          </div>
          <span className={
            'text-xs font-medium ' +
            (step === 2 ? 'text-[#1D1E20]' : 'text-[#bbb]')
          }>
            Datos del evento
          </span>
        </div>

        {/* Título */}
        <h1 className="text-xl font-bold text-[#1D1E20] sm:text-2xl">
          {step === 1 ? 'Nuevo evento' : eventType?.label ?? 'Nuevo evento'}
        </h1>
        <p className="mt-1 mb-6 text-sm text-[#888]">
          {step === 1
            ? 'Elige el tipo de evento para personalizar los campos'
            : 'Completa los datos del evento'}
        </p>

        {step === 1 ? renderStep1() : renderStep2()}

        {error && (
          <div className="mt-4 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2.5 text-xs text-[#cc3333]">
            {error}
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleBack}
              className="rounded-lg border border-[#e0e0e0] px-5 py-3 text-sm text-[#888] transition hover:bg-[#f5f5f5]"
            >
              Atras
            </button>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="flex-1 rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-60"
            >
              {loading ? 'Creando evento...' : 'Crear evento'}
            </button>
          </div>
        )}

      </main>
    </div>
  )
}