'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Star, Smile, Meh, Frown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { SupplierMood, ResponseSpeed } from '@/lib/types'

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
  const [rating, setRating]       = useState<number | null>(initialRating)
  const [reviewText, setReviewText] = useState<string>(initialReview ?? '')
  const [mood, setMood]           = useState<SupplierMood | null>(initialMood)
  const [speed, setSpeed]         = useState<ResponseSpeed | null>(initialSpeed)
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates = {
        rating,
        review_text: reviewText.trim() || null,
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
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 md:items-center md:p-4"
        onClick={onSkip}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="flex max-h-[95vh] w-full flex-col rounded-t-2xl bg-white shadow-xl md:max-h-[90vh] md:max-w-md md:rounded-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* HEADER */}
          <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-[#e8e8e8] px-5 py-4 md:px-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-[#1D1E20]">¿Cómo fue el proceso?</h2>
              <p className="mt-0.5 truncate text-xs text-[#888]">
                Tu experiencia cotizando con <span className="font-medium">{supplierName}</span>
              </p>
            </div>
            <button
              onClick={onSkip}
              className="-mr-2 rounded-lg p-2 text-[#aaa] transition-colors hover:bg-[#f5f5f5] hover:text-[#1D1E20]"
            >
              <X size={20} />
            </button>
          </div>

          {/* CONTENT */}
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-6">

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
                      className={
                        rating !== null && n <= rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-[#d4d4d4]'
                      }
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
                <MoodBtn
                  active={mood === 'no'}
                  onClick={() => setMood(mood === 'no' ? null : 'no')}
                  icon={<Frown size={22} />}
                  label="No"
                  activeClass="bg-red-50 border-red-400 text-red-600"
                />
                <MoodBtn
                  active={mood === 'normal'}
                  onClick={() => setMood(mood === 'normal' ? null : 'normal')}
                  icon={<Meh size={22} />}
                  label="Normal"
                  activeClass="bg-amber-50 border-amber-400 text-amber-600"
                />
                <MoodBtn
                  active={mood === 'love'}
                  onClick={() => setMood(mood === 'love' ? null : 'love')}
                  icon={<Smile size={22} />}
                  label="Love"
                  activeClass="bg-emerald-50 border-emerald-400 text-emerald-600"
                />
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
                className="w-full resize-none rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm outline-none transition focus:border-[#48C9B0]"
              />
            </div>
          </div>

          {/* FOOTER */}
          <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-[#e8e8e8] bg-white px-5 py-3 md:px-6">
            <button
              onClick={onSkip}
              disabled={saving}
              className="px-4 py-2 text-sm text-[#666] hover:text-[#1D1E20] disabled:opacity-50"
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
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function MoodBtn({
  active, onClick, icon, label, activeClass,
}: {
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