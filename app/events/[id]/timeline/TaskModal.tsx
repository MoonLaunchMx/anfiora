'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { TimelineTask, TimelinePriority, EventCollaborator } from '@/lib/types'
import {
  X, Plus, ChevronDown, Bell, Building2, User, Star, AlertTriangle
} from 'lucide-react'
import { formatDate } from './TaskCard'

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'evento',        label: 'Evento' },
  { value: 'tarea',         label: 'Tarea' },
  { value: 'recordatorio',  label: 'Recordatorio' },
  { value: 'reunion',       label: 'Reunión' },
  { value: 'entrega',       label: 'Entrega' },
  { value: 'pago',          label: 'Pago' },
  { value: 'comunicacion',  label: 'Comunicación' },
  { value: 'otro',          label: 'Otro' },
]

export const REMINDER_OPTIONS = [
  { value: '15min',  label: '15 minutos antes', minutes: 15 },
  { value: '30min',  label: '30 minutos antes', minutes: 30 },
  { value: '1h',     label: '1 hora antes',     minutes: 60 },
  { value: '2h',     label: '2 horas antes',    minutes: 120 },
  { value: '1d',     label: '1 día antes',      minutes: 60 * 24 },
  { value: '2d',     label: '2 días antes',     minutes: 60 * 24 * 2 },
  { value: '1w',     label: '1 semana antes',   minutes: 60 * 24 * 7 },
  { value: 'custom', label: 'Fecha personalizada', minutes: null },
]

const EMOJIS = ['📩','✅','💳','💐','🎉','🤝','📦','🔔','📅','🎊','🍽️','📸','🎶','✈️','🏨','💍','👗','💄','🌸','🎁']

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface SupplierOption {
  id: string
  name: string
}

interface TaskModalProps {
  editTask: TimelineTask | null
  prefillDate: string | null
  eventId: string
  onClose: () => void
  onSaved: () => void
}

// ─── REMINDER HELPERS ────────────────────────────────────────────────────────

function computeReminderDate(taskDate: string, taskTime: string | null, reminderKey: string): string | null {
  if (!taskDate || reminderKey === 'custom') return null
  const opt = REMINDER_OPTIONS.find(o => o.value === reminderKey)
  if (!opt || opt.minutes === null) return null
  const baseTime = taskTime || '09:00'
  const [y, mo, d] = taskDate.split('-').map(Number)
  const [h, min] = baseTime.split(':').map(Number)
  const base = new Date(y, mo - 1, d, h, min, 0)
  const reminder = new Date(base.getTime() - opt.minutes * 60000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${reminder.getFullYear()}-${pad(reminder.getMonth() + 1)}-${pad(reminder.getDate())}T${pad(reminder.getHours())}:${pad(reminder.getMinutes())}:00`
}

function detectReminderKey(reminderDate: string | null, taskDate: string, taskTime: string | null): string {
  if (!reminderDate) return ''
  const base = taskTime || '09:00'
  const [y, mo, d] = taskDate.split('-').map(Number)
  const [h, min] = base.split(':').map(Number)
  const baseTs = new Date(y, mo - 1, d, h, min).getTime()
  const remTs  = new Date(reminderDate).getTime()
  const diffMin = Math.round((baseTs - remTs) / 60000)
  const match = REMINDER_OPTIONS.find(o => o.minutes === diffMin)
  return match ? match.value : 'custom'
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function TaskModal({ editTask, prefillDate, eventId, onClose, onSaved }: TaskModalProps) {
  const [form, setForm] = useState({
    title:                '',
    emoji:                '',
    category:             'tarea' as TimelineTask['category'],
    task_date:            '',
    task_time:            '',
    notes:                '',
    is_highlighted:       false,
    priority:             null as TimelinePriority | null,
    assigned_to_user_id:  null as string | null,
    assigned_to_name:     '',
    event_supplier_id:    null as string | null,
    reminder_key:         '',
    reminder_custom_date: '',
    reminder_custom_time: '09:00',
  })

  const [saving, setSaving]               = useState(false)
  const [showEmoji, setShowEmoji]         = useState(false)
  const [collaborators, setCollaborators] = useState<EventCollaborator[]>([])
  const [suppliers, setSuppliers]         = useState<SupplierOption[]>([])
  const [assignMode, setAssignMode]       = useState<'collab' | 'free'>('collab')

  // ── Load collaborators + suppliers on mount ───────────────────────────────
  useEffect(() => {
    async function load() {
      const [{ data: collabs }, { data: sups }] = await Promise.all([
        supabase
          .from('event_collaborators')
          .select('*, user:user_id(id, full_name, email)')
          .eq('event_id', eventId)
          .eq('status', 'active'),          // ← fix: 'active' not 'accepted'
        supabase
          .from('event_suppliers')
          .select('id, supplier:supplier_id(id, name)')
          .eq('event_id', eventId),
      ])
      setCollaborators((collabs || []) as EventCollaborator[])
      setSuppliers((sups || []).map((s: any) => ({ id: s.id, name: s.supplier?.name || 'Proveedor' })))
    }
    load()
  }, [eventId])

  // ── Populate form when editing an existing task ───────────────────────────
  useEffect(() => {
    if (editTask) {
      const reminderKey = editTask.reminder_date
        ? detectReminderKey(editTask.reminder_date, editTask.task_date, editTask.task_time)
        : ''
      const isCustom = reminderKey === 'custom'
      setForm({
        title:                editTask.title,
        emoji:                editTask.emoji || '',
        category:             editTask.category,
        task_date:            editTask.task_date,
        task_time:            editTask.task_time || '',
        notes:                editTask.notes || '',
        is_highlighted:       editTask.is_highlighted,
        priority:             editTask.priority || null,
        assigned_to_user_id:  editTask.assigned_to_user_id || null,
        assigned_to_name:     editTask.assigned_to_name || '',
        event_supplier_id:    editTask.event_supplier_id || null,
        reminder_key:         reminderKey,
        reminder_custom_date: isCustom && editTask.reminder_date ? editTask.reminder_date.split('T')[0] : '',
        reminder_custom_time: isCustom && editTask.reminder_date ? (editTask.reminder_date.split('T')[1]?.slice(0, 5) || '09:00') : '09:00',
      })
      setAssignMode(editTask.assigned_to_name && !editTask.assigned_to_user_id ? 'free' : 'collab')
    } else {
      setForm({
        title: '', emoji: '', category: 'tarea',
        task_date: prefillDate || '', task_time: '', notes: '',
        is_highlighted: false, priority: null,
        assigned_to_user_id: null, assigned_to_name: '',
        event_supplier_id: null, reminder_key: '',
        reminder_custom_date: '', reminder_custom_time: '09:00',
      })
      setAssignMode('collab')
    }
  }, [editTask, prefillDate])

  // ── Compute reminder timestamp from selected option ───────────────────────
  const computedReminderDate = useMemo((): string | null => {
    if (!form.reminder_key) return null
    if (form.reminder_key === 'custom') {
      if (!form.reminder_custom_date) return null
      return form.reminder_custom_date + 'T' + (form.reminder_custom_time || '09:00') + ':00'
    }
    return computeReminderDate(form.task_date, form.task_time || null, form.reminder_key)
  }, [form.reminder_key, form.task_date, form.task_time, form.reminder_custom_date, form.reminder_custom_time])

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim() || !form.task_date) return
    setSaving(true)

    const payload = {
      event_id:            eventId,
      title:               form.title.trim(),
      emoji:               form.emoji || null,
      category:            form.category,
      task_date:           form.task_date,
      task_time:           form.task_time || null,
      notes:               form.notes.trim() || null,
      is_highlighted:      form.is_highlighted,
      priority:            form.priority,
      assigned_to_user_id: assignMode === 'collab' ? form.assigned_to_user_id : null,
      assigned_to_name:    assignMode === 'free'   ? (form.assigned_to_name.trim() || null) : null,
      event_supplier_id:   form.event_supplier_id,
      reminder_date:       computedReminderDate,
    }

    if (editTask) {
      await supabase.from('event_timeline_tasks').update(payload).eq('id', editTask.id)
    } else {
      await supabase.from('event_timeline_tasks').insert(payload)
    }

    setSaving(false)
    onSaved()
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!editTask) return
    await supabase.from('event_timeline_tasks').delete().eq('id', editTask.id)
    onSaved()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#f0f0f0]">
          <h2 className="text-base font-semibold text-[#1D1E20]">
            {editTask ? 'Editar tarea' : 'Nueva tarea'}
          </h2>
          <button onClick={onClose} className="text-[#aaa] hover:text-[#555] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3.5">

          {/* Fila 1: Categoría + Bloqueante en la misma línea */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as TimelineTask['category'] }))}
                className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8]"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aaa] pointer-events-none" />
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, priority: f.priority === 'bloqueante' ? null : 'bloqueante' }))}
              className={[
                'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0',
                form.priority === 'bloqueante'
                  ? 'border-[#1D1E20] bg-[#1D1E20] text-white'
                  : 'border-[#e0e0e0] text-[#888] hover:bg-[#f8f8f8]',
              ].join(' ')}
            >
              <AlertTriangle size={12} />Bloqueante
            </button>
          </div>

          {/* Fila 2: Emoji + Título */}
          <div className="flex gap-2">
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowEmoji(p => !p)}
                className="w-10 h-10 border border-[#e0e0e0] rounded-xl flex items-center justify-center text-lg hover:bg-[#f8f8f8] transition-colors"
              >
                {form.emoji || <Plus size={14} className="text-[#bbb]" />}
              </button>
              {showEmoji && (
                <div className="absolute top-12 left-0 z-20 bg-white border border-[#e0e0e0] rounded-xl p-2 grid grid-cols-5 gap-1 w-44 shadow-lg">
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => { setForm(f => ({ ...f, emoji: e })); setShowEmoji(false) }}
                      className="text-lg hover:bg-[#f8f8f8] rounded-lg p-1">{e}
                    </button>
                  ))}
                  {form.emoji && (
                    <button
                      onClick={() => { setForm(f => ({ ...f, emoji: '' })); setShowEmoji(false) }}
                      className="col-span-5 text-xs text-[#aaa] hover:text-[#888] pt-1 border-t border-[#e8e8e8] mt-1"
                    >
                      Quitar emoji
                    </button>
                  )}
                </div>
              )}
            </div>
            <input
              type="text"
              placeholder="Título de la tarea"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="flex-1 border border-[#e0e0e0] rounded-xl px-3 text-sm focus:outline-none focus:border-[#48C9B0] h-10 bg-[#f8f8f8]"
            />
          </div>

          {/* Fecha + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#555] mb-1 block">Fecha</label>
              <input
                type="date"
                value={form.task_date}
                onChange={e => setForm(f => ({ ...f, task_date: e.target.value, reminder_key: '' }))}
                className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#555] mb-1 block">
                Hora <span className="font-normal text-[#ccc]">(opcional)</span>
              </label>
              <input
                type="time"
                value={form.task_time}
                onChange={e => setForm(f => ({ ...f, task_time: e.target.value, reminder_key: '' }))}
                className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8]"
              />
            </div>
          </div>

          {/* Recordatorio estilo Google Calendar */}
          <div>
            <label className="text-xs font-medium text-[#555] mb-1 flex items-center gap-1.5 block">
              <Bell size={11} />Recordatorio
            </label>
            <div className="relative">
              <select
                value={form.reminder_key}
                onChange={e => setForm(f => ({ ...f, reminder_key: e.target.value }))}
                disabled={!form.task_date}
                className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8] disabled:opacity-40"
              >
                <option value="">Sin recordatorio</option>
                {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aaa] pointer-events-none" />
            </div>
            {!form.task_date && (
              <p className="text-[11px] text-[#bbb] mt-1">Elige una fecha primero</p>
            )}
            {form.reminder_key && form.reminder_key !== 'custom' && computedReminderDate && (
              <p className="text-[11px] text-[#48C9B0] mt-1 flex items-center gap-1">
                <Bell size={10} />
                Aviso el {formatDate(computedReminderDate.split('T')[0])} a las {computedReminderDate.split('T')[1]?.slice(0, 5)}
              </p>
            )}
            {form.reminder_key === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-2 p-3 border border-[#48C9B0] rounded-xl bg-[#f0fdfb]">
                <div>
                  <label className="text-[11px] font-medium text-[#0F6E56] mb-1 block">Fecha</label>
                  <input type="date" value={form.reminder_custom_date}
                    onChange={e => setForm(f => ({ ...f, reminder_custom_date: e.target.value }))}
                    className="w-full border border-[#9FE1CB] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#48C9B0] bg-white" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#0F6E56] mb-1 block">Hora</label>
                  <input type="time" value={form.reminder_custom_time}
                    onChange={e => setForm(f => ({ ...f, reminder_custom_time: e.target.value }))}
                    className="w-full border border-[#9FE1CB] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#48C9B0] bg-white" />
                </div>
              </div>
            )}
          </div>

          {/* Proveedor vinculado */}
          <div>
            <label className="text-xs font-medium text-[#555] mb-1 flex items-center gap-1.5 block">
              <Building2 size={11} />Proveedor vinculado <span className="font-normal text-[#ccc]">(opcional)</span>
            </label>
            <div className="relative">
              <select
                value={form.event_supplier_id || ''}
                onChange={e => setForm(f => ({ ...f, event_supplier_id: e.target.value || null }))}
                className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8]"
              >
                <option value="">Sin proveedor</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aaa] pointer-events-none" />
            </div>
            {suppliers.length === 0 && (
              <p className="text-[11px] text-[#bbb] mt-1">No hay proveedores en este evento</p>
            )}
          </div>

          {/* Asignado a */}
          <div>
            <label className="text-xs font-medium text-[#555] mb-1 flex items-center gap-1.5 block">
              <User size={11} />Asignado a <span className="font-normal text-[#ccc]">(opcional)</span>
            </label>
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => setAssignMode('collab')}
                className={['text-xs px-2.5 py-1 rounded-lg border transition-colors', assignMode === 'collab' ? 'bg-[#1D1E20] text-white border-[#1D1E20]' : 'border-[#e0e0e0] text-[#888] hover:bg-[#f8f8f8]'].join(' ')}
              >
                Colaborador
              </button>
              <button
                onClick={() => setAssignMode('free')}
                className={['text-xs px-2.5 py-1 rounded-lg border transition-colors', assignMode === 'free' ? 'bg-[#1D1E20] text-white border-[#1D1E20]' : 'border-[#e0e0e0] text-[#888] hover:bg-[#f8f8f8]'].join(' ')}
              >
                Escribir nombre
              </button>
            </div>
            {assignMode === 'collab' ? (
              <div className="relative">
                <select
                  value={form.assigned_to_user_id || ''}
                  onChange={e => setForm(f => ({ ...f, assigned_to_user_id: e.target.value || null }))}
                  className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8]"
                >
                  <option value="">Sin asignar</option>
                  {collaborators.map(c => (
                    <option key={c.id} value={c.user_id || ''}>
                      {c.user?.full_name || c.email}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aaa] pointer-events-none" />
                {collaborators.length === 0 && (
                  <p className="text-[11px] text-[#bbb] mt-1">Sin colaboradores. Invítalos desde Configuración.</p>
                )}
              </div>
            ) : (
              <input
                type="text"
                placeholder="Ej: Mamá de la novia, Asistente..."
                value={form.assigned_to_name}
                onChange={e => setForm(f => ({ ...f, assigned_to_name: e.target.value }))}
                className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8]"
              />
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-medium text-[#555] mb-1 block">
              Notas <span className="font-normal text-[#ccc]">(opcional)</span>
            </label>
            <textarea
              placeholder="Agrega detalles, instrucciones..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#48C9B0] resize-none bg-[#f8f8f8]"
            />
          </div>

          {/* Destacar */}
          <button
            onClick={() => setForm(f => ({ ...f, is_highlighted: !f.is_highlighted }))}
            className={[
              'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors',
              form.is_highlighted
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-[#e0e0e0] text-[#888] hover:bg-[#f8f8f8]',
            ].join(' ')}
          >
            <Star size={14} className={form.is_highlighted ? 'fill-amber-400 text-amber-400' : 'text-[#aaa]'} />
            {form.is_highlighted ? 'Tarea destacada' : 'Marcar como destacada'}
          </button>
        </div>

        {/* Footer sticky */}
        <div className="sticky bottom-0 bg-white border-t border-[#f0f0f0] px-5 py-4 flex gap-2.5">
          {editTask && (
            <button
              onClick={handleDelete}
              className="px-4 py-2.5 text-sm text-[#cc3333] border border-[#ffc0c0] rounded-xl hover:bg-[#fff0f0] transition-colors"
            >
              Eliminar
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm border border-[#e0e0e0] rounded-xl text-[#888] hover:bg-[#f8f8f8] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!form.title.trim() || !form.task_date || saving}
            className="flex-[2] py-2.5 text-sm bg-[#48C9B0] text-white rounded-xl font-semibold disabled:opacity-40 hover:bg-[#3ab89f] transition-colors"
          >
            {saving ? 'Guardando...' : editTask ? 'Guardar cambios' : 'Agregar tarea'}
          </button>
        </div>
      </div>
    </div>
  )
}