'use client'

import { useState } from 'react'
import type { TaskRow } from '@/lib/dashboard/types'
import CajaShell, { CHIP_BAD, CHIP_MUTE, CHIP_WARN, T_META, type PropsCaja } from './CajaShell'

function diasDeTarea(t: TaskRow, hoy: Date): { texto: string; clase: string } {
  if (!t.task_date) return { texto: '', clase: '' }
  const [y, mo, d] = t.task_date.split('T')[0].split('-').map(Number)
  const dias = Math.round(
    (new Date(y, mo - 1, d).getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000,
  )
  if (dias < 0)   return { texto: dias === -1 ? 'Vencida ayer' : `Vencida hace ${Math.abs(dias)} días`, clase: CHIP_BAD }
  if (dias === 0) return { texto: 'Hoy', clase: CHIP_WARN }
  if (dias === 1) return { texto: 'Mañana', clase: CHIP_MUTE }
  return { texto: `En ${dias} días`, clase: CHIP_MUTE }
}

export default function CajaPendientes({ m, modoPersonalizar, onQuitar, onTareaHecha }: PropsCaja) {
  const [fallo, setFallo] = useState<string | null>(null)

  // La lista sale de las mismas cifras que pinta el banner. Tener aqui una
  // copia propia era justo lo que dejaba el contador de arriba sin bajar.
  const tareas = m.tareasProximas
  const hoy = new Date()

  const marcarHecha = async (id: string) => {
    setFallo(null)
    if (!(await onTareaHecha(id))) setFallo(id)
  }

  return (
    <CajaShell
      id="pendientes"
      titulo="Tareas de la semana"
      meta="Márcalas aquí, sin entrar al timeline"
      accion={{ label: 'Ver timeline', href: `/events/${m.event.id}/timeline` }}
      modoPersonalizar={modoPersonalizar}
      onQuitar={onQuitar}
    >
      <div className="px-5 py-1">
        {tareas.length === 0 ? (
          <p className="py-8 text-center text-[13.5px] text-[#888]">No hay tareas pendientes.</p>
        ) : tareas.slice(0, 5).map(t => {
          const chip = diasDeTarea(t, hoy)
          return (
            <div key={t.id} className="flex items-start gap-3 border-t border-[#F0F0F0] py-3 first:border-t-0">
              <button
                onClick={() => marcarHecha(t.id)}
                aria-label={`Marcar "${t.title}" como hecha`}
                className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-2 border-[#DDD] bg-white transition hover:border-[#48C9B0] hover:bg-[#F0FDFB]"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium leading-[1.35] text-[#1D1E20]">{t.title}</p>
                <p className={T_META}>
                  {t.category}
                  {t.assigned_to_name && ` · ${t.assigned_to_name}`}
                  {t.priority === 'bloqueante' && ' · bloqueante'}
                </p>
              </div>
              <span className={'shrink-0 ' + (fallo === t.id ? CHIP_BAD : chip.clase)}>
                {fallo === t.id ? 'No se pudo marcar' : chip.texto}
              </span>
            </div>
          )
        })}
      </div>
    </CajaShell>
  )
}
