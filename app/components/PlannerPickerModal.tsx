'use client'

import { X, Check } from 'lucide-react'
import { ORGANIZADOR_PLANS, formatMXN, type OrganizadorTier } from '@/lib/pricing'

interface PlannerPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onChoose: (planId: string) => void
  onContact: () => void
}

interface Theme {
  card: string
  name: string
  tagline: string
  price: string
  per: string
  bullet: string
  check: string
  cta: string
}

const THEME: Record<OrganizadorTier, Theme> = {
  solo: {
    card: 'bg-white border-[#e8e8e8]', name: 'text-[#0a0a0a]', tagline: 'text-[#999]', price: 'text-[#0a0a0a]',
    per: 'text-[#999]', bullet: 'text-[#444]', check: 'text-[#48C9B0]', cta: 'bg-[#48C9B0] text-white hover:bg-[#3ab89f]',
  },
  studio: {
    card: 'bg-[#48C9B0] border-[#48C9B0]', name: 'text-white', tagline: 'text-white/80', price: 'text-white',
    per: 'text-white/80', bullet: 'text-white', check: 'text-white', cta: 'bg-white text-[#1f8f74] hover:bg-white/90',
  },
  agency: {
    card: 'bg-[#1D1E20] border-[#1D1E20]', name: 'text-white', tagline: 'text-white/60', price: 'text-white',
    per: 'text-white/60', bullet: 'text-white/90', check: 'text-[#48C9B0]', cta: 'bg-[#48C9B0] text-white hover:bg-[#3ab89f]',
  },
}

export default function PlannerPickerModal({ isOpen, onClose, onChoose, onContact }: PlannerPickerModalProps) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-5xl rounded-2xl border border-[#e8e8e8] bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[#eee] px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#0a0a0a]">Hazte Planner</h2>
            <p className="mt-1 text-sm text-[#666]">Gestiona varios eventos a la vez, con tu equipo e invitados ilimitados.</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-[#aaa] transition hover:text-[#666]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {ORGANIZADOR_PLANS.map(p => {
            const t = THEME[p.id]
            return (
              <div key={p.id} className={`flex flex-col rounded-2xl border p-5 ${t.card}`}>
                <div className={`text-base font-bold ${t.name}`}>{p.name}</div>
                <div className={`mb-3 mt-0.5 text-xs ${t.tagline}`}>{p.tagline}</div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-[26px] font-extrabold ${t.price}`}>{formatMXN(p.listMonthly)}</span>
                  <span className={`text-[11.5px] ${t.per}`}>/mes</span>
                </div>
                <button
                  onClick={() => onChoose(p.id)}
                  className={`mb-4 mt-3 rounded-[10px] py-2.5 text-[13px] font-semibold transition ${t.cta}`}
                >
                  Iniciar prueba de 14 días
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
            <div className="mb-3 mt-0.5 text-xs text-[#888]">Operaciones grandes</div>
            <div className="text-2xl font-extrabold text-[#0a0a0a]">A medida</div>
            <button
              onClick={onContact}
              className="mb-4 mt-3 rounded-[10px] border border-[#1D1E20] py-2.5 text-[13px] font-semibold text-[#1D1E20] transition hover:bg-[#1D1E20] hover:text-white"
            >
              Contáctanos
            </button>
            <ul className="flex flex-col gap-2">
              {['Eventos y usuarios ilimitados', 'White-label + API + SLA'].map((b, i) => (
                <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-[#444]">
                  <Check className="mt-[1px] h-[15px] w-[15px] shrink-0 text-[#48C9B0]" strokeWidth={3} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-[#eee] px-6 py-3 text-center">
          <p className="text-[11.5px] text-[#999]">Pago anual −20% y Programa Fundador −40% disponibles en el checkout.</p>
        </div>
      </div>
    </div>
  )
}
