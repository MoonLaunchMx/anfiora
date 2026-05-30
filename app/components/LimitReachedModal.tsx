'use client'

import { Lock } from 'lucide-react'

interface LimitReachedModalProps {
  isOpen: boolean
  onClose: () => void
  onUpgrade: () => void
  limit: number
  current: number
}

export default function LimitReachedModal({ isOpen, onClose, onUpgrade, limit, current }: LimitReachedModalProps) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-[#e8e8e8] bg-white p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fffbf0]">
          <Lock className="h-6 w-6 text-[#c49a3a]" />
        </div>
        <h2 className="text-lg font-bold text-[#1D1E20]">Llegaste al límite de tu plan</h2>
        <p className="mt-2 text-sm text-[#666]">
          Tu plan Free incluye hasta <strong className="text-[#1D1E20]">{limit} invitados</strong> (acompañantes
          incluidos). Vas en {current}. Mejora tu plan para seguir agregando.
        </p>
        <button
          onClick={onUpgrade}
          className="mt-5 w-full rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
        >
          Ver planes
        </button>
        <button
          onClick={onClose}
          className="mt-2.5 w-full rounded-lg border border-[#e0e0e0] py-2.5 text-sm text-[#666] transition hover:bg-[#f8f8f8]"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
