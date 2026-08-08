'use client'

import { useEffect, useState } from 'react'
import { Activity, LayoutGrid, Settings, UserPlus, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AUDIT_ACTION_LABEL, type AuditAction } from '@/lib/audit'
import { haceCuanto } from '@/lib/dashboard/salud'
import CajaShell, { T_META, type PropsCaja } from './CajaShell'

type ActividadRow = {
  id: string
  action: string
  entity_label: string | null
  user_name: string | null
  created_at: string
}

const ICONO_ACTIVIDAD: Record<string, React.ElementType> = {
  guest: Users, party_member: Users, table: LayoutGrid,
  settings: Settings, collaborator: UserPlus,
}

export default function CajaActividad({ m, modoPersonalizar, onQuitar }: PropsCaja) {
  const [actividad, setActividad] = useState<ActividadRow[]>([])

  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      const { data } = await supabase
        .from('event_audit_log')
        .select('id, action, entity_label, user_name, created_at')
        .eq('event_id', m.event.id)
        .order('created_at', { ascending: false })
        .limit(6)
      if (!cancelado) setActividad((data ?? []) as ActividadRow[])
    }
    cargar()
    return () => { cancelado = true }
  }, [m.event.id])

  // La actividad se mide en minutos y horas: basta con la hora del render, no
  // hace falta un tic que redibuje la caja cada segundo.
  const now = new Date()

  return (
    <CajaShell
      id="actividad"
      titulo="Actividad reciente"
      modoPersonalizar={modoPersonalizar}
      onQuitar={onQuitar}
    >
      <div className="px-5 py-1">
        {actividad.length === 0 ? (
          <p className="py-8 text-center text-[13.5px] text-[#888]">Todavía no hay actividad en este evento.</p>
        ) : actividad.map(a => {
          const Icono = ICONO_ACTIVIDAD[a.action.split('.')[0]] ?? Activity
          return (
            <div key={a.id} className="flex items-start gap-3 border-t border-[#F0F0F0] py-3 first:border-t-0">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-[#EEE] bg-[#F8F8F8]">
                <Icono size={15} className="text-[#888]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[#1D1E20]">
                  {AUDIT_ACTION_LABEL[a.action as AuditAction] ?? a.action}
                  {a.entity_label && <span className="font-normal text-[#777]"> · {a.entity_label}</span>}
                </p>
                <p className={'truncate ' + T_META}>{a.user_name || 'Alguien'} · {haceCuanto(a.created_at, now)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </CajaShell>
  )
}
