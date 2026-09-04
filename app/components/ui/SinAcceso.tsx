'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import { MODULOS_CONFIG, type Modulo } from '@/lib/permisos/catalogo'

export function SinAcceso({ modulo }: { modulo: Modulo }) {
  const { id } = useParams()
  const label = MODULOS_CONFIG.find(m => m.key === modulo)?.label ?? 'esta herramienta'

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl border border-dashed border-[#e0e0e0] text-[#bbb]">
        <Lock size={18} />
      </span>
      <h2 className="text-[15px] font-semibold text-[#1D1E20]">
        No tienes acceso a {label} en esta boda
      </h2>
      <p className="max-w-xs text-[13px] text-[#888]">
        Si crees que deberías, pídeselo a quien administra la cuenta.
      </p>
      <Link
        href={`/events/${id}`}
        className="mt-1 rounded-lg bg-[#48C9B0] px-4 py-2 text-[13px] font-semibold text-[#08312a]"
      >
        Volver a Invitados
      </Link>
    </div>
  )
}
