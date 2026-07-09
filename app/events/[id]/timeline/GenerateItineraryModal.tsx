'use client'

import { useMemo, useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import type { GeneratedMoment, ItineraryAnchor } from '@/lib/itinerary-ai'

interface GenerateItineraryModalProps {
  eventType: string | null
  eventCategory: string | null
  venue: string | null
  onClose: () => void
  onGenerated: (moments: GeneratedMoment[]) => void
}

// Tipos que tienen una ceremonia formal como ancla principal.
const CEREMONY_TYPES = new Set(['boda', 'xv', 'bautizo', 'graduacion'])

// Las horas ancla se adaptan al tipo de evento: una boda pide Ceremonia,
// una fiesta pide Inicio, un evento corporativo pide Comida.
function anchorFieldsFor(eventType: string | null, eventCategory: string | null): { key: string; label: string }[] {
  if (eventType && CEREMONY_TYPES.has(eventType)) {
    return [
      { key: 'ceremonia', label: 'Ceremonia' },
      { key: 'cena', label: 'Cena' },
      { key: 'cierre', label: 'Cierre' },
    ]
  }
  if (eventCategory === 'corporativo' || eventCategory === 'impacto') {
    return [
      { key: 'inicio', label: 'Inicio' },
      { key: 'comida', label: 'Comida' },
      { key: 'cierre', label: 'Cierre' },
    ]
  }
  // Social sin ceremonia (fiesta, cumpleaños, despedida, otro).
  return [
    { key: 'inicio', label: 'Inicio' },
    { key: 'cena', label: 'Cena' },
    { key: 'cierre', label: 'Cierre' },
  ]
}

export function GenerateItineraryModal({ eventType, eventCategory, venue, onClose, onGenerated }: GenerateItineraryModalProps) {
  const fields = useMemo(() => anchorFieldsFor(eventType, eventCategory), [eventType, eventCategory])
  const [times, setTimes]   = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleGenerate = async () => {
    setLoading(true); setError('')
    const anchors: ItineraryAnchor[] = fields
      .filter(f => times[f.key])
      .map(f => ({ label: f.label, time: times[f.key] }))
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#f0f0f0]">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#d4a853]" />
            <h2 className="text-base font-semibold text-[#1D1E20]">Autogenerar itinerario</h2>
          </div>
          <button onClick={onClose} className="text-[#aaa] hover:text-[#555]"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3.5">
          <p className="text-xs text-[#888]">
            Te proponemos un run-of-show para tu {eventType || 'evento'} a partir de las horas ancla. Podras editar cada momento antes de guardar.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {fields.map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-[#555] mb-1 block">{f.label}</label>
                <input
                  type="time"
                  value={times[f.key] || ''}
                  onChange={e => setTimes(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full border border-[#e0e0e0] rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-[#d4a853] bg-[#f8f8f8]"
                />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#bbb]">Todas son opcionales. Si las dejas vacias, usamos horarios tipicos para el tipo de evento.</p>
          {error && (
            <div className="rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2.5 text-xs text-[#cc3333]">{error}</div>
          )}
        </div>

        <div className="border-t border-[#f0f0f0] px-5 py-4 flex gap-2.5">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2.5 text-sm border border-[#e0e0e0] rounded-xl text-[#888] hover:bg-[#f8f8f8] disabled:opacity-40">
            Cancelar
          </button>
          <button onClick={handleGenerate} disabled={loading}
            className="flex-[2] py-2.5 text-sm bg-[#48C9B0] text-white rounded-xl font-semibold hover:bg-[#3ab89f] disabled:opacity-60">
            {loading ? 'Generando...' : 'Autogenerar'}
          </button>
        </div>
      </div>
    </div>
  )
}
