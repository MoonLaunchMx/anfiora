'use client'

import { X } from 'lucide-react'
import { ANFITRION_PLANS, formatMXN } from '@/lib/pricing'

interface PlanPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onChoose: (planId: string) => void
}

export default function PlanPickerModal({ isOpen, onClose, onChoose }: PlanPickerModalProps) {
  if (!isOpen) return null
  const plans = ANFITRION_PLANS.filter(p => p.price > 0)
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#1D1E20]">Elige un plan</h2>
            <p className="mt-0.5 text-sm text-[#666]">Aumenta tu límite de invitados. Pago único por tu evento.</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-[#aaa] transition hover:text-[#666]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-2.5">
          {plans.map(p => (
            <button
              key={p.id}
              onClick={() => onChoose(p.id)}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#e8e8e8] px-4 py-3 text-left transition hover:border-[#48C9B0] hover:bg-[#f0fdfb]"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#1D1E20]">{p.name}</div>
                <div className="text-xs text-[#888]">Hasta {p.guestLimit} invitados</div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-base font-extrabold text-[#1D1E20]">{formatMXN(p.price)}</span>
                <span className="rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white">Elegir</span>
              </div>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-lg border border-[#e0e0e0] py-2.5 text-sm text-[#666] transition hover:bg-[#f8f8f8]">
          Ahora no
        </button>
      </div>
    </div>
  )
}
