'use client'

import { X, Check } from 'lucide-react'
import { ANFITRION_PLANS, ANFITRION_ILIMITADO, formatMXN } from '@/lib/pricing'

interface PlanPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onChoose: (planId: string) => void
}

interface Row {
  id: string
  name: string
  limit: string
  price: number
  bullets: string[]
  highlight: boolean
}

const ROWS: Row[] = [
  ...ANFITRION_PLANS.filter(p => p.price > 0).map(p => ({
    id: p.id,
    name: p.name,
    limit: `Hasta ${p.guestLimit} invitados`,
    price: p.price,
    bullets: p.bullets.slice(0, 3),
    highlight: p.id === 'pro',
  })),
  {
    id: 'ilimitado',
    name: 'Sin Límites',
    limit: 'Invitados ilimitados',
    price: ANFITRION_ILIMITADO.price,
    bullets: ['Exportar a Excel y PDF', 'Equipo de tu evento', 'Soporte prioritario'],
    highlight: false,
  },
]

export default function PlanPickerModal({ isOpen, onClose, onChoose }: PlanPickerModalProps) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-[#e8e8e8] bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[#eee] px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#0a0a0a]">Elige tu plan</h2>
            <p className="mt-1 text-sm text-[#666]">Aumenta el límite de invitados de tu evento. Pago único, sin mensualidades.</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-[#aaa] transition hover:text-[#666]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-6">
          {ROWS.map(r => (
            <div
              key={r.id}
              className={`flex flex-col gap-3 rounded-xl border p-4 transition sm:flex-row sm:items-center sm:justify-between ${
                r.highlight ? 'border-[#48C9B0] bg-[#f0fdfb]' : 'border-[#e8e8e8] hover:border-[#48C9B0]'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-[#0a0a0a]">{r.name}</span>
                  {r.highlight && (
                    <span className="rounded-full bg-[#48C9B0] px-2 py-[2px] text-[10px] font-bold tracking-wide text-white">POPULAR</span>
                  )}
                </div>
                <div className="text-sm font-semibold text-[#1f8f74]">{r.limit}</div>
                <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {r.bullets.map((b, i) => (
                    <li key={i} className="flex items-center gap-1 text-xs text-[#666]">
                      <Check className="h-3 w-3 shrink-0 text-[#48C9B0]" strokeWidth={3} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1.5">
                <div className="text-lg font-extrabold text-[#0a0a0a]">{formatMXN(r.price)}</div>
                <button
                  onClick={() => onChoose(r.id)}
                  className="rounded-lg bg-[#48C9B0] px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#3ab89f]"
                >
                  Elegir
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[#eee] px-6 py-3 text-center">
          <button onClick={onClose} className="text-sm text-[#888] transition hover:text-[#0a0a0a]">Ahora no</button>
        </div>
      </div>
    </div>
  )
}
