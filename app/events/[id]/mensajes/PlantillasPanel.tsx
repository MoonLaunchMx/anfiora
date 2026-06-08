'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getTemplatePack } from '@/lib/message-templates'
import { Smartphone } from 'lucide-react'

// ─── Constantes ───────────────────────────────────────────────────────────────

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

const EVENT_TYPE_LABELS: Record<string, string> = {
  boda: 'Boda', xv: 'XV años', cumpleanos: 'Cumpleaños', graduacion: 'Graduación',
  bautizo: 'Bautizo', fiesta: 'Fiesta', despedida: 'Despedida', otro: 'Otro',
  conferencia: 'Conferencia', capacitacion: 'Capacitación', teambuilding: 'Team',
  lanzamiento: 'Lanzamiento', asamblea: 'Asamblea', retiro: 'Retiro',
  congreso: 'Congreso', campamento: 'Campamento', caridad: 'Caridad',
}

const DEFAULT_NAMES = [
  'Bienvenida', 'Recordatorio', 'Confirmacion', 'Invitacion playlist',
  'Invitacion fotos', 'Plantilla 6', 'Plantilla 7', 'Plantilla 8', 'Plantilla 9', 'Plantilla 10',
]

// ─── TemplateInput ────────────────────────────────────────────────────────────

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

// ─── PlantillasPanel ──────────────────────────────────────────────────────────

export default function PlantillasPanel({ eventId }: { eventId: string }) {
  const [loading, setLoading]     = useState(true)
  const [saved, setSaved]         = useState(false)
  const [eventType, setEventType] = useState('')
  const [settingsId, setSettingsId] = useState<string | null>(null)

  const [templates, setTemplates]               = useState<string[]>(Array(10).fill(''))
  const [templateNames, setTemplateNames]       = useState<string[]>([...DEFAULT_NAMES])
  const [visibleTemplates, setVisibleTemplates] = useState(2)

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasChangesRef      = useRef(false)

  useEffect(() => {
    load()
    return () => { if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current) }
  }, [eventId])

  const applyPack = (pack: { name: string; body: string }[]) => {
    const newTemplates = [...pack.map(t => t.body), ...Array(10).fill('')].slice(0, 10)
    const newNames     = [...pack.map(t => t.name), ...DEFAULT_NAMES].slice(0, 10).map((n, i) => n || DEFAULT_NAMES[i])
    setTemplates(newTemplates)
    setTemplateNames(newNames)
    setVisibleTemplates(Math.max(2, pack.length))
    return { newTemplates, newNames }
  }

  const templatesArePristine = (forType: string) =>
    templates.every((t, i) => !t?.trim() || t === (getTemplatePack(forType)[i]?.body ?? ''))

  const load = async () => {
    const [{ data: eventData }, { data: settingsData }] = await Promise.all([
      supabase.from('events').select('event_type').eq('id', eventId).single(),
      supabase.from('event_settings').select('*').eq('event_id', eventId).single(),
    ])

    const loadedType = eventData?.event_type || ''
    setEventType(loadedType)

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

    const loadedTemplates = Array.isArray(settingsData?.message_templates) ? settingsData!.message_templates : []
    const allEmpty = !loadedTemplates.some((t: string) => t?.trim())
    if (allEmpty && loadedType) {
      const { newTemplates, newNames } = applyPack(getTemplatePack(loadedType))
      await supabase.from('event_settings').upsert({
        ...(settingsData?.id ? { id: settingsData.id } : {}),
        event_id:          eventId,
        message_templates: newTemplates,
        template_names:    newNames,
        updated_at:        new Date().toISOString(),
      }, { onConflict: 'event_id' })
    }

    setLoading(false)
  }

  const saveTemplates = async (tmpl: string[], names: string[]) => {
    const { error } = await supabase.from('event_settings').upsert({
      ...(settingsId ? { id: settingsId } : {}),
      event_id:          eventId,
      message_templates: tmpl,
      template_names:    names,
      updated_at:        new Date().toISOString(),
    }, { onConflict: 'event_id' })
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    hasChangesRef.current = false
  }

  const scheduleAutoSave = (tmpl: string[], names: string[]) => {
    hasChangesRef.current = true
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (hasChangesRef.current) saveTemplates(tmpl, names)
    }, 2000)
  }

  const updateTemplate = (i: number, value: string) => {
    const next = templates.map((t, idx) => idx === i ? value : t)
    setTemplates(next)
    scheduleAutoSave(next, templateNames)
  }

  const updateTemplateName = (i: number, value: string) => {
    const next = templateNames.map((n, idx) => idx === i ? value : n)
    setTemplateNames(next)
    scheduleAutoSave(templates, next)
  }

  const handleDeleteTemplate = (i: number) => {
    if (!confirm('Eliminar esta plantilla?')) return
    const newTemplates = templates.filter((_, idx) => idx !== i)
    while (newTemplates.length < 10) newTemplates.push('')
    const newNames = templateNames.filter((_, idx) => idx !== i)
    while (newNames.length < 10) newNames.push(DEFAULT_NAMES[newNames.length])
    setTemplates(newTemplates)
    setTemplateNames(newNames)
    const newVisible = Math.max(1, visibleTemplates - 1)
    setVisibleTemplates(newVisible)
    scheduleAutoSave(newTemplates, newNames)
  }

  const handleClearTemplate = (i: number) => {
    const next = templates.map((t, idx) => idx === i ? '' : t)
    setTemplates(next)
    scheduleAutoSave(next, templateNames)
  }

  if (loading) return <div className="p-6 text-sm text-[#666]">Cargando...</div>

  const eventTypeLabel = EVENT_TYPE_LABELS[eventType] ?? eventType

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-5 sm:px-6">

        {/* Autosave indicator */}
        {saved && (
          <div className="mb-4 rounded-lg border border-[#c8ede7] bg-[#f0fdfb] px-3 py-2 text-xs font-semibold text-[#1a9e88]">
            Guardado
          </div>
        )}

        <div className="flex flex-col gap-4 sm:gap-5">

          {/* Numero WhatsApp — card informativa */}
          <div className="rounded-xl border border-dashed border-[#e0e0e0] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0fdfb]">
                <Smartphone size={18} className="text-[#48C9B0]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#1D1E20]">Número de WhatsApp</p>
                <p className="mt-0.5 text-xs text-[#888]">
                  Los mensajes se envían desde el número compartido de Anfiora. Próximamente podrás conectar tu propio número de WhatsApp Business.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full border border-[#c8ede7] bg-[#f0fdfb] px-2.5 py-1 text-[11px] font-semibold text-[#1a9e88]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#48C9B0]" />
                    Activo — Número Anfiora
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Plantillas */}
          <div>
            <h2 className="mb-1 text-sm font-semibold text-[#1D1E20]">Plantillas de mensajes</h2>
            <p className="mb-4 text-xs text-[#666]">
              Doble click en el nombre para renombrarlo. Usa los chips para insertar variables dinámicas.
              {eventType && (
                <span className="ml-1 text-[#48C9B0]">
                  Variables de {eventTypeLabel} incluidas.
                </span>
              )}
            </p>
            {eventType && (
              <button
                onClick={() => {
                  if (!templatesArePristine(eventType) && !window.confirm('Esto reemplazará tus plantillas por las recomendadas para ' + eventTypeLabel + '. Continuar?')) return
                  const { newTemplates, newNames } = applyPack(getTemplatePack(eventType))
                  scheduleAutoSave(newTemplates, newNames)
                }}
                className="mb-4 rounded-lg border border-[#c8ede7] bg-[#f0fdfb] px-3 py-2 text-xs font-semibold text-[#1a9e88] transition hover:bg-[#e3f7f3]"
              >
                Cargar plantillas recomendadas de {eventTypeLabel}
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
                <button
                  onClick={() => setVisibleTemplates(v => Math.min(v + 1, 10))}
                  className="flex items-center gap-1.5 text-xs text-[#48C9B0] transition hover:text-[#3ab89f] sm:col-span-2"
                >
                  <span className="text-base leading-none">+</span> Agregar plantilla
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
