'use client'

import { X, Check } from 'lucide-react'
import { ANFITRION_PLANS, ANFITRION_ILIMITADO, formatMXN } from '@/lib/pricing'

interface PlanPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onChoose: (planId: string) => void
}

interface Theme {
  card: string
  name: string
  sub: string
  price: string
  bullet: string
  check: string
  cta: string
}

const THEME: Record<'esencial' | 'pro' | 'gran', Theme> = {
  esencial: {
    card: 'bg-[#fffbf0] border-[#f0e6cc]', name: 'text-[#0a0a0a]', sub: 'text-[#a08a5a]', price: 'text-[#0a0a0a]',
    bullet: 'text-[#5a4d33]', check: 'text-[#c49a3a]', cta: 'bg-[#48C9B0] text-white hover:bg-[#3ab89f]',
  },
  pro: {
    card: 'bg-[#48C9B0] border-[#48C9B0]', name: 'text-white', sub: 'text-white/80', price: 'text-white',
    bullet: 'text-white', check: 'text-white', cta: 'bg-white text-[#1f8f74] hover:bg-white/90',
  },
  gran: {
    card: 'bg-[#1D1E20] border-[#1D1E20]', name: 'text-white', sub: 'text-white/60', price: 'text-white',
    bullet: 'text-white/90', check: 'text-[#48C9B0]', cta: 'bg-[#48C9B0] text-white hover:bg-[#3ab89f]',
  },
}

const PAID = ANFITRION_PLANS.filter(p => p.price > 0)

export default function PlanPickerModal({ isOpen, onClose, onChoose }: PlanPickerModalProps) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-5xl rounded-2xl border border-[#e8e8e8] bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[#eee] px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#0a0a0a]">Elige tu plan</h2>
            <p className="mt-1 text-sm text-[#666]">Aumenta el límite de invitados de tu evento. Pago único, sin mensualidades.</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-[#aaa] transition hover:text-[#666]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {PAID.map(p => {
            const t = THEME[p.id as 'esencial' | 'pro' | 'gran']
            return (
              <div key={p.id} className={`flex flex-col rounded-2xl border p-5 ${t.card}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-base font-bold ${t.name}`}>{p.name}</span>
                  {p.id === 'pro' && (
                    <span className="rounded-full bg-white px-2 py-[2px] text-[10px] font-bold tracking-wide text-[#1f8f74]">POPULAR</span>
                  )}
                </div>
                <div className={`mb-2 mt-0.5 text-xs font-semibold ${t.sub}`}>Hasta {p.guestLimit} invitados</div>
                <div className={`text-[26px] font-extrabold ${t.price}`}>{formatMXN(p.price)}</div>
                <div className={`text-[11.5px] ${t.sub}`}>pago único</div>
                <button
                  onClick={() => onChoose(p.id)}
                  className={`mb-4 mt-3 rounded-[10px] py-2.5 text-[13px] font-semibold transition ${t.cta}`}
                >
                  Elegir
                </button>
                <ul className="flex flex-col gap-2">
                  {p.bullets.map((b, i) => (
                    <li key={i} className={`flex gap-2 text-[12.5px] leading-snug ${t.bullet}`}>
                      <Check className={`mt-[1px] h-[15px] w-[15px] shrink-0 ${t.check}`} strokeWidth={3} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}

          <div className="flex flex-col rounded-2xl border border-[#e4e4e4] bg-[#f2f2f2] p-5">
            <div className="text-base font-bold text-[#0a0a0a]">Sin Límites</div>
            <div className="mb-2 mt-0.5 text-xs font-semibold text-[#888]">Invitados ilimitados</div>
            <div className="text-[26px] font-extrabold text-[#0a0a0a]">{formatMXN(ANFITRION_ILIMITADO.price)}</div>
            <div className="text-[11.5px] text-[#888]">pago único</div>
            <button
              onClick={() => onChoose('ilimitado')}
              className="mb-4 mt-3 rounded-[10px] bg-[#1D1E20] py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#2a2b2e]"
            >
              Elegir
            </button>
            <ul className="flex flex-col gap-2">
              {['Exportar a Excel y PDF', 'Equipo de tu evento', 'Soporte prioritario'].map((b, i) => (
                <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-[#444]">
                  <Check className="mt-[1px] h-[15px] w-[15px] shrink-0 text-[#48C9B0]" strokeWidth={3} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
