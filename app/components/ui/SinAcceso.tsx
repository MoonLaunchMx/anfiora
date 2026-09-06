'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import { MODULOS_CONFIG, type Modulo } from '@/lib/permisos/catalogo'
import { moduloDeRutaNav } from '@/lib/permisos/rutas'

// volverA es la primera herramienta que si le toca, o null si no le toca
// ninguna. Antes el boton apuntaba fijo a la raiz, que ES Invitados: a quien
// no tiene Invitados lo devolvia a esta misma pantalla.
export function SinAcceso({ modulo, volverA }: { modulo: Modulo; volverA: string | null }) {
  const { id } = useParams()
  const label = MODULOS_CONFIG.find(m => m.key === modulo)?.label ?? 'esta herramienta'

  const moduloDestino = volverA !== null ? moduloDeRutaNav(volverA) : null
  const labelDestino  = MODULOS_CONFIG.find(m => m.key === moduloDestino)?.label

  const destino = labelDestino ? `/events/${id}${volverA}` : '/dashboard'
  const textoBoton = labelDestino ? `Volver a ${labelDestino}` : 'Volver al inicio'

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
        href={destino}
        className="mt-1 rounded-lg bg-[#48C9B0] px-4 py-2 text-[13px] font-semibold text-[#08312a]"
      >
        {textoBoton}
      </Link>
    </div>
  )
}
