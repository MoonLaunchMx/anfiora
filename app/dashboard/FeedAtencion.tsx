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
  vacio:  'bg-[#f8f8f8]',
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
}

export default function FeedAtencion({ urgencias, titulo, mostrarEvento, max = 3 }: Props) {
  const visibles = urgencias.slice(0, max)

  return (
    <div className="rounded-[13px] border border-[#E8E8E8] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#E8E8E8] px-[15px] py-3">
        <div className="flex items-center gap-2.5">
          <span className={'h-[7px] w-[7px] rounded-full ' + (urgencias.length > 0 ? 'bg-[#CC3333]' : 'bg-[#48C9B0]')} />
          <h3 className="font-display text-[13.5px] font-bold tracking-[-0.01em]">{titulo}</h3>
          {urgencias.length > 0 && (
            <span className="rounded-full border border-[#FFC0C0] bg-[#FFF0F0] px-2 py-0.5 text-[10px] font-semibold text-[#CC3333]">
              {urgencias.length}
            </span>
          )}
        </div>
        <span className="hidden text-[11px] text-[#888] sm:block">
          {urgencias.length > max ? `Mostrando ${max} de ${urgencias.length}` : 'Ordenado por urgencia'}
        </span>
      </div>

      {visibles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-[15px] py-9 text-center">
          <CircleCheck size={22} className="text-[#48C9B0]" />
          <p className="text-xs text-[#888]">Todo al día. No hay nada que requiera tu atención.</p>
        </div>
      ) : visibles.map(u => {
        const Icono = ICONO[u.tipo]
        return (
          <div key={u.id} className="flex flex-col gap-2.5 border-t border-[#F0F0F0] px-[15px] py-2.5 first-of-type:border-t-0 sm:flex-row sm:items-start sm:gap-[11px]">
            <span className={'grid h-7 w-7 shrink-0 place-items-center rounded-[9px] ' + FONDO[u.tono]}>
              <Icono size={14} className={TRAZO[u.tono]} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold leading-[1.35] text-[#1D1E20]">{u.titulo}</p>
              <p className="text-[11px] text-[#888]">
                {mostrarEvento && <span className="font-medium text-[#666]">{u.eventName} · </span>}
                {u.detalle}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {u.secundaria && (
                <button
                  onClick={() => { window.location.href = u.secundaria!.href }}
                  className="flex-1 rounded-[9px] border border-[#E0E0E0] bg-[#F8F8F8] px-3 py-1.5 text-[11.5px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0] sm:flex-none"
                >
                  {u.secundaria.label}
                </button>
              )}
              <button
                onClick={() => { window.location.href = u.accion.href }}
                className="flex-1 rounded-[9px] bg-[#1D1E20] px-3 py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-[#2c2d30] sm:flex-none"
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
