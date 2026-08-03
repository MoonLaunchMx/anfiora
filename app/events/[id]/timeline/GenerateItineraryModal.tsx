'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { GeneratedMoment, ItineraryAnchor } from '@/lib/itinerary-ai'
import { Modal } from '@/app/components/ui/Modal'

interface GenerateItineraryModalProps {
  eventType: string | null
  eventCategory: string | null
  eventTime: string | null
  venue: string | null
  onClose: () => void
  onGenerated: (moments: GeneratedMoment[]) => void
}

// Tipos que tienen una ceremonia formal como ancla principal.
const CEREMONY_TYPES = new Set(['boda', 'xv', 'bautizo', 'graduacion'])

// Sugerencias de etiqueta para las horas clave (el usuario puede escribir la que quiera).
const LABEL_SUGGESTIONS = ['Desayuno', 'Brunch', 'Comida', 'Coctel', 'Ceremonia', 'Recepcion', 'Cena', 'After', 'Inicio', 'Cierre']

// Anclas que arrancan prellenadas segun el tipo de evento. Son solo un punto de
// partida: el usuario agrega o quita las horas clave que necesite.
function defaultAnchorLabels(eventType: string | null, eventCategory: string | null): string[] {
  if (eventType && CEREMONY_TYPES.has(eventType)) return ['Ceremonia', 'Cena', 'Cierre']
  if (eventCategory === 'corporativo' || eventCategory === 'impacto') return ['Inicio', 'Comida', 'Cierre']
  return ['Inicio', 'Cena', 'Cierre']
}

interface AnchorRow { id: string; label: string; time: string }

export function GenerateItineraryModal({ eventType, eventCategory, eventTime, venue, onClose, onGenerated }: GenerateItineraryModalProps) {
  // La primera ancla se precarga con la hora de inicio configurada del evento
  // (event_time), para que la IA respete esa hora en vez de inventarla.
  const [rows, setRows] = useState<AnchorRow[]>(() =>
    defaultAnchorLabels(eventType, eventCategory).map((label, i) => ({
      id: crypto.randomUUID(),
      label,
      time: i === 0 && eventTime ? eventTime.slice(0, 5) : '',
    })),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const updateRow = (id: string, patch: Partial<AnchorRow>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id))
  const addRow = () => setRows(prev => [...prev, { id: crypto.randomUUID(), label: '', time: '' }])

  const handleGenerate = async () => {
    setLoading(true); setError('')
    const anchors: ItineraryAnchor[] = rows
      .filter(r => r.label.trim() && r.time)
      .map(r => ({ label: r.label.trim(), time: r.time }))
    try {
      const res = await fetch('/api/itinerary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, eventCategory, venue, anchors }),
      })
      if (!res.ok) throw new Error('fallo')
      const data = await res.json() as { moments?: GeneratedMoment[] }
      if (!data.moments || data.moments.length === 0) {
        setError('No se pudo generar un itinerario. Intenta de nuevo o agrega los momentos a mano.')
        setLoading(false)
        return
      }
      onGenerated(data.moments)
    } catch {
      setError('No se pudo generar el itinerario. Revisa tu conexion e intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header title="Autogenerar itinerario" />
      <Modal.Body>
        <datalist id="anchor-labels">
          {LABEL_SUGGESTIONS.map(l => <option key={l} value={l} />)}
        </datalist>

        <p className="pb-3 text-xs text-[#888]">
          Marca las horas clave de tu {eventType || 'evento'} (desayuno, comida, cena, after, lo que aplique). Con eso te proponemos un run-of-show que podras editar antes de guardar.
        </p>

        <div className="flex flex-col gap-2 max-h-[268px] overflow-y-auto">
          {rows.map(row => (
            <div key={row.id} className="flex items-center gap-2">
              <input
                type="text"
                list="anchor-labels"
                placeholder="Momento (ej. Brunch)"
                value={row.label}
                onChange={e => updateRow(row.id, { label: e.target.value })}
                className="flex-1 min-w-0 border border-[#e0e0e0] rounded-xl px-3 py-2 text-base focus:outline-none focus:border-[#d4a853] bg-[#f8f8f8]"
              />
              <input
                type="time"
                value={row.time}
                onChange={e => updateRow(row.id, { time: e.target.value })}
                className="w-[108px] shrink-0 border border-[#e0e0e0] rounded-xl px-2 py-2 text-base focus:outline-none focus:border-[#d4a853] bg-[#f8f8f8]"
              />
              <button
                onClick={() => removeRow(row.id)}
                disabled={rows.length <= 1}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-[#bbb] transition hover:bg-[#fff0f0] hover:text-[#cc3333] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#bbb]"
                aria-label="Quitar hora clave"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="pt-3 flex flex-col gap-2">
          <button
            onClick={addRow}
            className="flex items-center justify-center gap-1.5 w-full py-2 text-sm font-medium text-[#c49a3a] border border-dashed border-[#ecdcb8] rounded-xl hover:bg-[#fffbf0] transition-colors"
          >
            <Plus size={14} />Agregar hora clave
          </button>
          {error && (
            <div className="rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2.5 text-xs text-[#cc3333]">{error}</div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button onClick={onClose} disabled={loading}
          className="flex-1 py-2.5 text-sm border border-[#e0e0e0] rounded-xl text-[#888] hover:bg-[#f8f8f8] disabled:opacity-40">
          Cancelar
        </button>
        <button onClick={handleGenerate} disabled={loading}
          className="flex-[2] py-2.5 text-sm bg-[#48C9B0] text-white rounded-xl font-semibold hover:bg-[#3ab89f] disabled:opacity-60">
          {loading ? 'Generando...' : 'Autogenerar'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}
