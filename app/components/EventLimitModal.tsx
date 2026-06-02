'use client'

import Link from 'next/link'
import { CalendarClock } from 'lucide-react'

interface EventLimitModalProps {
  isOpen: boolean
  onClose: () => void
  isPlanner: boolean
  limit: number
}

export default function EventLimitModal({ isOpen, onClose, isPlanner, limit }: EventLimitModalProps) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-[#e8e8e8] bg-white p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f0fdfb]">
          <CalendarClock className="h-6 w-6 text-[#1f8f74]" />
        </div>
        <h2 className="text-lg font-bold text-[#1D1E20]">
          {isPlanner ? 'Llegaste al límite de tu plan' : 'Mejora tu plan para crear más eventos'}
        </h2>
        <p className="mt-2 text-sm text-[#666]">
          {isPlanner ? (
            <>Tu plan incluye <strong className="text-[#1D1E20]">{limit}</strong> eventos activos. Sube de plan
            para gestionar más al mismo tiempo.</>
          ) : (
            <>Tu plan incluye <strong className="text-[#1D1E20]">un evento activo</strong> a la vez. Cambia a un
            plan Planner para gestionar varios eventos simultáneamente con tu equipo.</>
          )}
        </p>
        <Link
          href="/precios?vista=organizador"
          className="mt-5 block w-full rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
        >
          Ver planes Planner
        </Link>
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
