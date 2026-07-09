'use client'

import { useEffect, useState } from 'react'
import { ItineraryMoment, ItineraryPhase } from '@/lib/types'
import { ITINERARY_PHASES, PHASE_LABEL, computeEndTime } from '@/lib/itinerary'
import { X, ChevronDown, Eye, EyeOff } from 'lucide-react'

export interface MomentDraft {
  title: string
  start_time: string
  duration_min: number | null
  location: string | null
  phase: ItineraryPhase
  event_supplier_id: string | null
  assigned_to_name: string | null
  notes: string | null
  visible_to_guests: boolean
}

interface MomentModalProps {
  editMoment: ItineraryMoment | null
  eventId: string
  suppliers: { id: string; name: string }[]
  onClose: () => void
  onSave: (data: MomentDraft) => void
  onDelete: (m: ItineraryMoment) => void
}

export function MomentModal({ editMoment, suppliers, onClose, onSave, onDelete }: MomentModalProps) {
  const [form, setForm] = useState({
    title: '',
    start_time: '',
    duration_min: '' as string,
    location: '',
    phase: 'otro' as ItineraryPhase,
    event_supplier_id: '' as string,
    assigned_to_name: '',
    notes: '',
    visible_to_guests: false,
  })

  useEffect(() => {
    if (editMoment) {
      setForm({
        title: editMoment.title,
        start_time: editMoment.start_time.slice(0, 5),
        duration_min: editMoment.duration_min !== null ? String(editMoment.duration_min) : '',
        location: editMoment.location || '',
        phase: editMoment.phase,
        event_supplier_id: editMoment.event_supplier_id || '',
        assigned_to_name: editMoment.assigned_to_name || '',
        notes: editMoment.notes || '',
        visible_to_guests: editMoment.visible_to_guests,
      })
    } else {
      setForm({
        title: '', start_time: '', duration_min: '', location: '',
        phase: 'otro', event_supplier_id: '', assigned_to_name: '', notes: '',
        visible_to_guests: true,
      })
    }
  }, [editMoment])

  const durationNum = form.duration_min.trim() === '' ? null : Math.max(0, parseInt(form.duration_min, 10) || 0)
  const endPreview = form.start_time ? computeEndTime(form.start_time, durationNum) : null

  const handleSave = () => {
    if (!form.title.trim() || !form.start_time) return
    onSave({
      title: form.title.trim(),
      start_time: form.start_time,
      duration_min: durationNum,
      location: form.location.trim() || null,
      phase: form.phase,
      event_supplier_id: form.event_supplier_id || null,
      assigned_to_name: form.assigned_to_name.trim() || null,
      notes: form.notes.trim() || null,
      visible_to_guests: form.visible_to_guests,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#f0f0f0]">
          <h2 className="text-base font-semibold text-[#1D1E20]">
            {editMoment ? 'Editar momento' : 'Nuevo momento'}
          </h2>
          <button onClick={onClose} className="text-[#aaa] hover:text-[#555] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3.5">
          {/* Titulo */}
          <input
            type="text"
            placeholder="Titulo del momento (ej. Ceremonia)"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#d4a853] bg-[#f8f8f8]"
          />

          {/* Hora + Duracion */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#555] mb-1 block">Hora de inicio</label>
              <input
                type="time"
                value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#d4a853] bg-[#f8f8f8]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#555] mb-1 block">
                Duracion (min) <span className="font-normal text-[#ccc]">— vacio = hasta cierre</span>
              </label>
              <input
                type="number"
                min={0}
                step={5}
                placeholder="40"
                value={form.duration_min}
                onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))}
                className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#d4a853] bg-[#f8f8f8]"
              />
            </div>
          </div>
          {endPreview && (
            <p className="-mt-1.5 text-[11px] text-[#c49a3a]">Termina aprox. a las {endPreview}</p>
          )}

          {/* Fase + Ubicacion */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#555] mb-1 block">Fase</label>
              <div className="relative">
                <select
                  value={form.phase}
                  onChange={e => setForm(f => ({ ...f, phase: e.target.value as ItineraryPhase }))}
                  className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:border-[#d4a853] bg-[#f8f8f8]"
                >
                  {ITINERARY_PHASES.map(p => <option key={p} value={p}>{PHASE_LABEL[p]}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aaa] pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#555] mb-1 block">
                Ubicacion <span className="font-normal text-[#ccc]">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Jardin, terraza..."
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#d4a853] bg-[#f8f8f8]"
              />
            </div>
          </div>

          {/* Proveedor */}
          <div>
            <label className="text-xs font-medium text-[#555] mb-1 block">
              Proveedor <span className="font-normal text-[#ccc]">(opcional)</span>
            </label>
            <div className="relative">
              <select
                value={form.event_supplier_id}
                onChange={e => setForm(f => ({ ...f, event_supplier_id: e.target.value }))}
                className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:border-[#d4a853] bg-[#f8f8f8]"
              >
                <option value="">Sin proveedor</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#aaa] pointer-events-none" />
            </div>
          </div>

          {/* Responsable libre */}
          <div>
            <label className="text-xs font-medium text-[#555] mb-1 block">
              Responsable <span className="font-normal text-[#ccc]">(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Coordinador, MC, maestro de ceremonias..."
              value={form.assigned_to_name}
              onChange={e => setForm(f => ({ ...f, assigned_to_name: e.target.value }))}
              className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#d4a853] bg-[#f8f8f8]"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-medium text-[#555] mb-1 block">
              Notas de guion <span className="font-normal text-[#ccc]">(opcional)</span>
            </label>
            <textarea
              placeholder="Instrucciones para el coordinador..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#d4a853] resize-none bg-[#f8f8f8]"
            />
          </div>

          {/* Visibilidad */}
          <button
            onClick={() => setForm(f => ({ ...f, visible_to_guests: !f.visible_to_guests }))}
            className={[
              'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors',
              form.visible_to_guests
                ? 'border-[#c8ede7] bg-[#f0fdfb] text-[#0F6E56]'
                : 'border-[#e0e0e0] text-[#888] hover:bg-[#f8f8f8]',
            ].join(' ')}
          >
            {form.visible_to_guests ? <Eye size={14} /> : <EyeOff size={14} />}
            {form.visible_to_guests ? 'Visible en la invitacion' : 'Solo interno (no lo ven los invitados)'}
          </button>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-[#f0f0f0] px-5 py-4 flex gap-2.5">
          {editMoment && (
            <button
              onClick={() => onDelete(editMoment)}
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
            disabled={!form.title.trim() || !form.start_time}
            className="flex-[2] py-2.5 text-sm bg-[#48C9B0] text-white rounded-xl font-semibold disabled:opacity-40 hover:bg-[#3ab89f] transition-colors"
          >
            {editMoment ? 'Guardar cambios' : 'Agregar momento'}
          </button>
        </div>
      </div>
    </div>
  )
}
