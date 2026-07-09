'use client'

import { useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import type { GeneratedMoment } from '@/lib/itinerary-ai'

interface GenerateItineraryModalProps {
  eventType: string | null
  eventCategory: string | null
  venue: string | null
  onClose: () => void
  onGenerated: (moments: GeneratedMoment[]) => void
}

export function GenerateItineraryModal({ eventType, eventCategory, venue, onClose, onGenerated }: GenerateItineraryModalProps) {
  const [ceremonyTime, setCeremonyTime] = useState('')
  const [dinnerTime, setDinnerTime]     = useState('')
  const [endTime, setEndTime]           = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  const handleGenerate = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/itinerary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType, eventCategory, venue,
          ceremonyTime: ceremonyTime || null,
          dinnerTime: dinnerTime || null,
          endTime: endTime || null,
        }),
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
            <h2 className="text-base font-semibold text-[#1D1E20]">Auto-generar itinerario</h2>
          </div>
          <button onClick={onClose} className="text-[#aaa] hover:text-[#555]"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3.5">
          <p className="text-xs text-[#888]">
            Claude propone un run-of-show para tu {eventType || 'evento'} a partir de las horas ancla. Podras editar cada momento antes de guardar.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-[#555] mb-1 block">Ceremonia</label>
              <input type="time" value={ceremonyTime} onChange={e => setCeremonyTime(e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-[#d4a853] bg-[#f8f8f8]" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#555] mb-1 block">Cena</label>
              <input type="time" value={dinnerTime} onChange={e => setDinnerTime(e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-[#d4a853] bg-[#f8f8f8]" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#555] mb-1 block">Cierre</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-[#d4a853] bg-[#f8f8f8]" />
            </div>
          </div>
          <p className="text-[11px] text-[#bbb]">Las tres son opcionales. Si las dejas vacias, Claude usa horarios tipicos.</p>
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
            {loading ? 'Generando...' : 'Generar con Claude'}
          </button>
        </div>
      </div>
    </div>
  )
}
