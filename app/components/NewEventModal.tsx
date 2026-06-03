'use client'

import DatePicker from '@/app/components/ui/DatePicker'
import TimePicker from '@/app/components/ui/TimePicker'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, ArrowLeft, X } from 'lucide-react'
import { EVENT_TYPES, CATEGORIES, EventTypeConfig, EventCategory } from '@/lib/event-types'

function generatePlaylistToken(): string {
  return Math.random().toString(36).substring(2, 10) +
    Math.random().toString(36).substring(2, 10)
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface NewEventModalProps {
  open: boolean
  onClose: () => void
  onCreated: (eventId: string) => void
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function NewEventModal({ open, onClose, onCreated }: NewEventModalProps) {
  const [step, setStep]                   = useState<1 | 2>(1)
  const [category, setCategory]           = useState<EventCategory>('social')
  const [eventType, setEventType]         = useState<EventTypeConfig | null>(null)

  const [name, setName]                   = useState('')
  const [hostName, setHostName]           = useState('')
  const [hostName2, setHostName2]         = useState('')
  const [organization, setOrganization]   = useState('')
  const [date, setDate]                   = useState('')
  const [time, setTime]                   = useState('')
  const [venue, setVenue]                 = useState('')

  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const resetForm = () => {
    setStep(1)
    setCategory('social')
    setEventType(null)
    setName(''); setHostName(''); setHostName2(''); setOrganization('')
    setDate(''); setTime(''); setVenue('')
    setError('')
    setLoading(false)
  }

  const handleClose = () => {
    if (loading) return
    resetForm()
    onClose()
  }

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

    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .insert({
        user_id:        user.id,
        name:           name.trim(),
        event_type:     eventType.value,
        event_category: eventType.category,
        event_date:     date,
        event_time:     time || null,
        venue:          venue.trim() || null,
        host_name:      hostName.trim() || null,
        host_name_2:    hostName2.trim() || null,
        organization:   organization.trim() || null,
        total_guests:   0,
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

    resetForm()
    onCreated(eventData.id)
  }

  const filteredTypes = EVENT_TYPES.filter(t => t.category === category)

  // ─── Paso 1 — Selector de tipo ───────────────────────────────────────────

  const renderStep1 = () => (
    <div className="flex flex-col gap-4">
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="contents"
          >
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
                  <p className="text-sm font-medium text-[#1D1E20]">{type.label}</p>
                  <ChevronRight size={13} className="self-end text-[#ccc] transition group-hover:text-[#48C9B0]" />
                </button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )

  // ─── Paso 2 — Formulario dinámico ────────────────────────────────────────

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
          <label className="mb-1.5 block text-xs font-medium text-[#555]">Nombre del evento *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={eventType.value === 'boda' ? 'Boda Ana & Carlos' : 'Nombre del evento'}
            className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
          />
        </div>

        {/* Host / Host 2 */}
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

        {/* Fecha */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#555]">Fecha *</label>
          <DatePicker value={date} onChange={setDate} placeholder="Seleccionar fecha" />
        </div>

        {/* Hora */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#555]">
            Hora
            <span className="ml-1 font-normal text-[#bbb]">(opcional)</span>
          </label>
          <TimePicker value={time} onChange={setTime} />
        </div>

        {/* Venue — solo bodas */}
        {eventType.showVenue && (
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
        )}



      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px]"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-4 bottom-4 top-[4vh] z-[101] mx-auto flex max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2"
            style={{ maxHeight: '92vh' }}
          >
            {/* Header fijo */}
            <div className="shrink-0 border-b border-[#e8e8e8] px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Steps */}
                  <div className="flex items-center gap-2">
                    <div className={
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition ' +
                      (step === 1 ? 'bg-[#48C9B0] text-white' : 'bg-[#d0f5ec] text-[#0F6E56]')
                    }>
                      {step === 1 ? '1' : '✓'}
                    </div>
                    <span className={'text-xs font-medium ' + (step === 1 ? 'text-[#1D1E20]' : 'text-[#48C9B0]')}>
                      Tipo
                    </span>
                    <div className="h-px w-4 bg-[#e8e8e8]" />
                    <div className={
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition ' +
                      (step === 2 ? 'bg-[#48C9B0] text-white' : 'border border-[#e0e0e0] bg-white text-[#bbb]')
                    }>
                      2
                    </div>
                    <span className={'text-xs font-medium ' + (step === 2 ? 'text-[#1D1E20]' : 'text-[#bbb]')}>
                      Datos
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#aaa] transition hover:bg-[#f0f0f0] hover:text-[#555] disabled:opacity-40"
                >
                  <X size={16} />
                </button>
              </div>
              <h2 className="mt-3 text-lg font-bold text-[#1D1E20]">
                {step === 1 ? 'Nuevo evento' : eventType?.label ?? 'Nuevo evento'}
              </h2>
              <p className="mt-0.5 text-xs text-[#888]">
                {step === 1
                  ? 'Elige el tipo para personalizar los campos'
                  : 'Completa los datos del evento'}
              </p>
            </div>

            {/* Contenido scrolleable */}
            <div className="flex-1 px-5 py-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: step === 2 ? 16 : -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: step === 2 ? -16 : 16 }}
                  transition={{ duration: 0.18 }}
                >
                  {step === 1 ? renderStep1() : renderStep2()}
                </motion.div>
              </AnimatePresence>

              {error && (
                <div className="mt-4 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2.5 text-xs text-[#cc3333]">
                  {error}
                </div>
              )}
            </div>

            {/* Footer fijo — solo en paso 2 */}
            {step === 2 && (
              <div className="shrink-0 border-t border-[#e8e8e8] px-5 py-4">
                <div className="flex gap-3">
                  <button
                    onClick={handleBack}
                    disabled={loading}
                    className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-4 py-2.5 text-sm text-[#888] transition hover:bg-[#f5f5f5] disabled:opacity-40"
                  >
                    <ArrowLeft size={14} /> Atras
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="flex-1 rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-60"
                  >
                    {loading ? 'Creando evento...' : 'Crear evento'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}