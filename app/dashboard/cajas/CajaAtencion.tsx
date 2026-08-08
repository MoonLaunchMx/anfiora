'use client'

import { buildUrgencias } from '@/lib/dashboard/urgencias'
import { atajos } from '../atajos'
import FeedAtencion from '../FeedAtencion'
import CajaShell, { type PropsCaja } from './CajaShell'

const MAX = 3

export default function CajaAtencion({ m, puedeVerDinero, modoPersonalizar, onQuitar }: PropsCaja) {
  // Sin tareas: viven en su propia caja, donde ademas se palomean.
  const urgencias = buildUrgencias([m], { puedeVerDinero, sinTareas: true })
  const hayPendientes = urgencias.length > 0

  return (
    <CajaShell
      id="atencion"
      titulo="Acciones rápidas"
      meta={
        hayPendientes
          ? (urgencias.length > MAX ? `${urgencias.length} por resolver · ordenadas por urgencia` : 'Ordenadas por urgencia')
          : 'Todo al día — lo que sueles hacer'
      }
      modoPersonalizar={modoPersonalizar}
      onQuitar={onQuitar}
    >
      {hayPendientes ? (
        <FeedAtencion urgencias={urgencias} titulo="" mostrarEvento={false} max={MAX} enmarcado={false} />
      ) : (
        <div className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-3">
          {atajos(m.event.id, puedeVerDinero).map(a => (
            <button
              key={a.label}
              onClick={() => { window.location.href = a.href }}
              className="flex items-center gap-3 rounded-xl border border-[#E8E8E8] bg-white px-3.5 py-3 text-left transition hover:border-[#48C9B0] hover:bg-[#F0FDFB] sm:flex-col sm:items-start sm:gap-2"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#F0FDFB]">
                <a.Icono size={16} className="text-[#1A9E88]" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-[#1D1E20]">{a.label}</span>
                <span className="block truncate text-[12px] text-[#999]">{a.detalle}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </CajaShell>
  )
}
