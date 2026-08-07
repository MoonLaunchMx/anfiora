'use client'

import {
  Armchair, CircleAlert, CircleCheck, Clock, CreditCard,
  FileText, TrendingUp, TriangleAlert,
} from 'lucide-react'
import type { TipoUrgencia, Urgencia } from '@/lib/dashboard/urgencias'
import type { Tono } from '@/lib/dashboard/types'

const ICONO: Record<TipoUrgencia, React.ElementType> = {
  tarea_bloqueante:     TriangleAlert,
  tarea_vencida:        TriangleAlert,
  presupuesto_excedido: TrendingUp,
  proveedor_saldo:      CreditCard,
  invitados_atencion:   CircleAlert,
  tarea_hoy:            Clock,
  sin_lugar:            Armchair,
  invitacion_borrador:  FileText,
}

const FONDO: Record<Tono, string> = {
  alerta: 'bg-[#fff0f0]',
  aviso:  'bg-[#fff8e8]',
  ok:     'bg-[#f0fff6]',
  vacio:  'bg-[#f5f5f5]',
}

const TRAZO: Record<Tono, string> = {
  alerta: 'text-[#CC3333]',
  aviso:  'text-[#B8860B]',
  ok:     'text-[#2A7A50]',
  vacio:  'text-[#888]',
}

type Props = {
  urgencias: Urgencia[]
  titulo: string
  mostrarEvento: boolean
  max?: number
  onResuelta?: (u: Urgencia) => void
  // Dentro de una caja del tablero el marco y el titulo los pone CajaShell.
  // Por defecto se dibuja completo, como en la vista de cartera.
  enmarcado?: boolean
}

export default function FeedAtencion({ urgencias, titulo, mostrarEvento, max = 3, enmarcado = true }: Props) {
  const visibles = urgencias.slice(0, max)

  return (
    <div className={enmarcado ? 'rounded-2xl border border-[#E8E8E8] bg-white' : ''}>
      {enmarcado && (
        <div className="flex items-center justify-between gap-3 border-b border-[#E8E8E8] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className={'h-2.5 w-2.5 rounded-full ' + (urgencias.length > 0 ? 'bg-[#CC3333]' : 'bg-[#48C9B0]')} />
            <h3 className="font-display text-[18px] font-bold tracking-[-0.015em] sm:text-[20px]">{titulo}</h3>
            {urgencias.length > 0 && (
              <span className="rounded-full border border-[#FFC0C0] bg-[#FFF0F0] px-2.5 py-0.5 text-[12px] font-bold text-[#CC3333]">
                {urgencias.length}
              </span>
            )}
          </div>
          <span className="hidden text-[12.5px] text-[#888] sm:block">
            {urgencias.length > max ? `Mostrando ${max} de ${urgencias.length}` : 'Ordenado por urgencia'}
          </span>
        </div>
      )}

      {visibles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <CircleCheck size={28} className="text-[#48C9B0]" />
          <p className="text-[14px] text-[#777]">Todo al día. No hay nada que requiera tu atención.</p>
        </div>
      ) : visibles.map(u => {
        const Icono = ICONO[u.tipo]
        return (
          <div key={u.id} className="flex flex-col gap-3 border-t border-[#F0F0F0] px-5 py-3.5 first-of-type:border-t-0 sm:flex-row sm:items-center">
            <span className={'grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ' + FONDO[u.tono]}>
              <Icono size={17} className={TRAZO[u.tono]} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-[1.35] text-[#1D1E20]">{u.titulo}</p>
              <p className="mt-0.5 text-[13px] text-[#888]">
                {mostrarEvento && <span className="font-semibold text-[#555]">{u.eventName} · </span>}
                {u.detalle}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {u.secundaria && (
                <button
                  onClick={() => { window.location.href = u.secundaria!.href }}
                  className="flex-1 rounded-[10px] border border-[#E0E0E0] bg-[#F8F8F8] px-3.5 py-2 text-[13px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0] sm:flex-none"
                >
                  {u.secundaria.label}
                </button>
              )}
              <button
                onClick={() => { window.location.href = u.accion.href }}
                className="flex-1 rounded-[10px] bg-[#1D1E20] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#2c2d30] sm:flex-none"
              >
                {u.accion.label}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
