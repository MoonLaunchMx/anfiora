'use client'

import { useState } from 'react'
import { Star, Smile, Meh, Frown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { SupplierMood, ResponseSpeed } from '@/lib/types'
import { Modal } from '@/app/components/ui/Modal'

interface Props {
  eventSupplierId: string
  supplierName: string
  initialRating: number | null
  initialReview: string | null
  initialMood: SupplierMood | null
  initialSpeed: ResponseSpeed | null
  onSaved: (updates: { rating: number | null; review_text: string | null; mood: SupplierMood | null; response_speed: ResponseSpeed | null }) => void
  onSkip: () => void
}

const SPEED_OPTIONS: { value: ResponseSpeed; label: string }[] = [
  { value: 'lentisimo', label: 'Lentísimo' },
  { value: 'normal',    label: 'Normal'    },
  { value: 'bueno',     label: 'Bueno'     },
  { value: 'rapidos',   label: 'Rápidos'   },
]

export default function SupplierReviewModal({
  eventSupplierId, supplierName,
  initialRating, initialReview, initialMood, initialSpeed,
  onSaved, onSkip,
}: Props) {
  const [rating, setRating]         = useState<number | null>(initialRating)
  const [reviewText, setReviewText] = useState<string>(initialReview ?? '')
  const [mood, setMood]             = useState<SupplierMood | null>(initialMood)
  const [speed, setSpeed]           = useState<ResponseSpeed | null>(initialSpeed)
  const [saving, setSaving]         = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates = {
        rating,
        review_text:    reviewText.trim() || null,
        mood,
        response_speed: speed,
      }
      const { error } = await supabase
        .from('event_suppliers')
        .update(updates)
        .eq('id', eventSupplierId)
      if (error) throw error
      onSaved(updates)
    } catch (err) {
      console.error('Error guardando review:', err)
      alert('No se pudo guardar el review.')
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onSkip} size="md">
      <Modal.Header title="¿Cómo fue el proceso?" subtitle={`Tu experiencia cotizando con ${supplierName}`} />
      <Modal.Body>
        <div className="space-y-5">

          {/* Calificación */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#888]">
              Calificación
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setRating(rating === n ? null : n)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    size={32}
                    className={rating !== null && n <= rating ? 'fill-amber-400 text-amber-400' : 'text-[#d4d4d4]'}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Mood */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#888]">
              ¿Qué tal el trato?
            </label>
            <div className="flex gap-2">
              <MoodBtn active={mood === 'no'}     onClick={() => setMood(mood === 'no'     ? null : 'no')}     icon={<Frown size={22} />} label="No"     activeClass="bg-red-50 border-red-400 text-red-600" />
              <MoodBtn active={mood === 'normal'} onClick={() => setMood(mood === 'normal' ? null : 'normal')} icon={<Meh size={22} />}   label="Normal" activeClass="bg-amber-50 border-amber-400 text-amber-600" />
              <MoodBtn active={mood === 'love'}   onClick={() => setMood(mood === 'love'   ? null : 'love')}   icon={<Smile size={22} />} label="Love"   activeClass="bg-emerald-50 border-emerald-400 text-emerald-600" />
            </div>
          </div>

          {/* Velocidad */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#888]">
              ¿Qué tan rápido contestaba?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SPEED_OPTIONS.map(opt => {
                const active = speed === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSpeed(active ? null : opt.value)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                      active
                        ? 'border-[#1D1E20] bg-[#1D1E20] font-medium text-white'
                        : 'border-[#e8e8e8] bg-white text-[#666] hover:bg-[#fafafa]'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Comentario */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#888]">
              Comentario
            </label>
            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              rows={4}
              placeholder="¿Cómo fue tu experiencia? Lo bueno, lo malo..."
              className="w-full resize-none rounded-lg border border-[#e8e8e8] px-3 py-2 text-base outline-none transition focus:border-[#48C9B0]"
            />
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          onClick={onSkip}
          disabled={saving}
          className="ml-auto px-4 py-2 text-sm text-[#666] hover:text-[#1D1E20] disabled:opacity-50"
        >
          Después
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-[#48C9B0] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3aa896] disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar review'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

function MoodBtn({ active, onClick, icon, label, activeClass }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  activeClass: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1 rounded-lg border py-3 transition-all ${
        active ? `${activeClass} border-2` : 'border-[#e8e8e8] text-[#aaa] hover:bg-[#fafafa]'
      }`}
    >
      {icon}
      <span className="text-[11px]">{label}</span>
    </button>
  )
}
