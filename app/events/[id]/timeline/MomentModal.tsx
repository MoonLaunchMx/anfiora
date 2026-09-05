'use client'

import { useEffect, useState } from 'react'
import { ItineraryMoment, ItineraryPhase } from '@/lib/types'
import { ITINERARY_PHASES, PHASE_LABEL, computeEndTime, dayLabel } from '@/lib/itinerary'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import TimePicker from '@/app/components/ui/TimePicker'
import { Puede } from '@/lib/permisos/Puede'
import { usePermiso } from '@/lib/event-access-context'

export interface MomentDraft {
  title: string
  moment_date: string
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
  suppliers: { id: string; name: string }[]
  days: string[]
  defaultDate: string
  onClose: () => void
  onSave: (data: MomentDraft) => void
  onDelete: (m: ItineraryMoment) => void
}

export function MomentModal({ editMoment, suppliers, days, defaultDate, onClose, onSave, onDelete }: MomentModalProps) {
  const permiso = usePermiso('timeline')
  const soloLectura = !permiso.editar
  const [form, setForm] = useState({
    title: '',
    moment_date: defaultDate,
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
        moment_date: editMoment.moment_date,
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
        title: '', moment_date: defaultDate, start_time: '', duration_min: '', location: '',
        phase: 'otro', event_supplier_id: '', assigned_to_name: '', notes: '',
        visible_to_guests: true,
      })
    }
  }, [editMoment, defaultDate])

  const durationNum = form.duration_min.trim() === '' ? null : Math.max(0, parseInt(form.duration_min, 10) || 0)
  const endPreview = form.start_time ? computeEndTime(form.start_time, durationNum) : null

  // Un momento editado puede vivir en un dia que ya salio del rango del evento:
  // su chip se pinta en rojo para que se vea que esta fuera, pero sigue elegible
  // para no perderlo al guardar.
  const orphanDate = form.moment_date && !days.includes(form.moment_date) ? form.moment_date : null
  const dayChips = orphanDate ? [...days, orphanDate] : days

  const handleSave = () => {
    if (!form.title.trim() || !form.start_time || !form.moment_date) return
    onSave({
      title: form.title.trim(),
      moment_date: form.moment_date,
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
    <Modal open onClose={onClose} size="lg">
      <Modal.Header title={soloLectura ? 'Detalle del momento' : editMoment ? 'Editar momento' : 'Nuevo momento'} />
      <Modal.Body className="[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex flex-col gap-3.5">
          {/* Titulo */}
          <input
            type="text"
            placeholder="Titulo del momento (ej. Ceremonia)"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            readOnly={soloLectura}
            className={[
              'w-full border border-[#e0e0e0] rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8]',
              soloLectura ? 'cursor-default text-[#666]' : '',
            ].join(' ')}
          />

          {dayChips.length > 1 && (
            <div>
              <label className="text-xs font-medium text-[#555] mb-1 block">Día</label>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(74px,1fr))] gap-2">
                {dayChips.map(d => {
                  const l = dayLabel(d)
                  const activo = d === form.moment_date
                  const fuera = d === orphanDate
                  return (
                    <button
                      key={d}
                      onClick={() => setForm(f => ({ ...f, moment_date: d }))}
                      disabled={soloLectura}
                      className={[
                        'rounded-xl border px-2 py-2 text-center transition disabled:opacity-70',
                        activo && fuera
                          ? 'border-[#cc3333] bg-[#fff0f0]'
                          : activo
                            ? 'border-[#48C9B0] bg-[#48C9B0]'
                            : fuera
                              ? 'border-[#ffc0c0] hover:bg-[#fff0f0]'
                              : 'border-[#e0e0e0] hover:bg-[#f8f8f8]',
                      ].join(' ')}
                    >
                      <span className={[
                        'block text-[10px] font-semibold uppercase tracking-[0.12em]',
                        activo && fuera ? 'text-[#cc3333]' : activo ? 'text-white/85' : fuera ? 'text-[#cc3333]/70' : 'text-[#999]',
                      ].join(' ')}>
                        {fuera ? 'Fuera' : l.dow.slice(0, 3)}
                      </span>
                      <span className={[
                        'block text-[14px] font-semibold tabular-nums',
                        activo && fuera ? 'text-[#cc3333]' : activo ? 'text-white' : fuera ? 'text-[#cc3333]' : 'text-[#666]',
                      ].join(' ')}>
                        {l.num}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Hora + Duracion */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#555] mb-1 block">Hora de inicio</label>
              <TimePicker
                value={form.start_time}
                onChange={v => setForm(f => ({ ...f, start_time: v }))}
                disabled={soloLectura}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#555] mb-1 block">
                Duración (min) <span className="font-normal text-[#ccc]">(opcional)</span>
              </label>
              <input
                type="number"
                min={0}
                step={5}
                placeholder="40"
                value={form.duration_min}
                onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))}
                readOnly={soloLectura}
                className={[
                  'w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-base focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8]',
                  soloLectura ? 'cursor-default text-[#666]' : '',
                ].join(' ')}
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
                  disabled={soloLectura}
                  className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-base appearance-none focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8] cursor-pointer disabled:cursor-default disabled:opacity-70"
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
                readOnly={soloLectura}
                className={[
                  'w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-base focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8]',
                  soloLectura ? 'cursor-default text-[#666]' : '',
                ].join(' ')}
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
                disabled={soloLectura}
                className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-base appearance-none focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8] cursor-pointer disabled:cursor-default disabled:opacity-70"
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
              readOnly={soloLectura}
              className={[
                'w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-base focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8]',
                soloLectura ? 'cursor-default text-[#666]' : '',
              ].join(' ')}
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
              readOnly={soloLectura}
              className={[
                'w-full border border-[#e0e0e0] rounded-xl px-3 py-2 text-base focus:outline-none focus:border-[#48C9B0] resize-none bg-[#f8f8f8]',
                soloLectura ? 'cursor-default text-[#666]' : '',
              ].join(' ')}
            />
          </div>

          {/* Visibilidad */}
          <button
            onClick={() => setForm(f => ({ ...f, visible_to_guests: !f.visible_to_guests }))}
            disabled={soloLectura}
            className={[
              'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors disabled:opacity-70',
              form.visible_to_guests
                ? 'border-[#c8ede7] bg-[#f0fdfb] text-[#0F6E56]'
                : 'border-[#e0e0e0] text-[#888] hover:bg-[#f8f8f8]',
            ].join(' ')}
          >
            {form.visible_to_guests ? <Eye size={14} /> : <EyeOff size={14} />}
            {form.visible_to_guests ? 'Visible en la invitacion' : 'Solo interno (no lo ven los invitados)'}
          </button>
        </div>
      </Modal.Body>
      <Modal.Footer>
        {editMoment && (
          <Puede modulo="timeline" accion="borrar">
            <button
              onClick={() => onDelete(editMoment)}
              className="px-4 py-2.5 text-sm text-[#cc3333] border border-[#ffc0c0] rounded-xl hover:bg-[#fff0f0] transition-colors"
            >
              Eliminar
            </button>
          </Puede>
        )}
        <button
          onClick={onClose}
          className="flex-1 py-2.5 text-sm border border-[#e0e0e0] rounded-xl text-[#888] hover:bg-[#f8f8f8] transition-colors"
        >
          {soloLectura ? 'Cerrar' : 'Cancelar'}
        </button>
        <Puede modulo="timeline" accion="editar">
          <button
            onClick={handleSave}
            disabled={!form.title.trim() || !form.start_time}
            className="flex-[2] py-2.5 text-sm bg-[#48C9B0] text-white rounded-xl font-semibold disabled:opacity-40 hover:bg-[#3ab89f] transition-colors"
          >
            {editMoment ? 'Guardar cambios' : 'Agregar momento'}
          </button>
        </Puede>
      </Modal.Footer>
    </Modal>
  )
}
