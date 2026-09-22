'use client'

import { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Search, Users } from 'lucide-react'
import type { Persona } from '@/lib/mesas/asientos'
import { PersonaChip } from './PersonaItem'

// Panel de personas sin mesa. Se agrupa por el Grupo de la base (guests.side)
// y, dentro, cada titular con sus acompanantes debajo. Soltar aqui a alguien
// sentado lo quita de su mesa.
export default function SinMesaPanel({ sinMesa, busqueda, setBusqueda, puedeEditar, arrastrando, onSentarGrupo, onTap }: {
  sinMesa: Persona[]
  busqueda: string
  setBusqueda: (v: string) => void
  puedeEditar: boolean
  arrastrando: Persona | null
  onSentarGrupo: (personas: Persona[]) => void
  onTap: (p: Persona) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'panel', disabled: !puedeEditar })
  const q = busqueda.trim().toLowerCase()
  const visibles = q ? sinMesa.filter(p => p.nombre.toLowerCase().includes(q) || (p.titular || '').toLowerCase().includes(q)) : sinMesa

  const grupos = useMemo(() => {
    const porGrupo = new Map<string, Map<string, Persona[]>>()
    for (const p of visibles) {
      const g = p.grupo || ''
      if (!porGrupo.has(g)) porGrupo.set(g, new Map())
      const familias = porGrupo.get(g)!
      if (!familias.has(p.guestId)) familias.set(p.guestId, [])
      familias.get(p.guestId)!.push(p)
    }
    // Los sin grupo al final.
    return Array.from(porGrupo.entries()).sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])))
  }, [visibles])

  const soltarParaQuitar = !!arrastrando && !sinMesa.some(p => p.clave === arrastrando.clave)

  return (
    <div ref={setNodeRef} className={'flex h-full w-[230px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-[#e8e8e8] bg-[#f8f8f8] p-3 transition ' + (isOver && soltarParaQuitar ? 'bg-[#fff0f0]' : '')}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[#999]">
        <Users size={13} className="shrink-0" />
        <span className="flex-1">Sin mesa · {sinMesa.length}</span>
      </div>
      {soltarParaQuitar && (
        <div className="rounded-lg border border-dashed border-[#cc3333] bg-[#fff5f5] px-2 py-2 text-center text-[11px] font-semibold text-[#cc3333]">Suelta aquí para quitar de la mesa</div>
      )}
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#bbb]" />
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar a alguien…" className="w-full rounded-lg border border-[#e0e0e0] bg-white py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#48C9B0]" />
      </div>
      {sinMesa.length === 0 ? (
        <p className="py-6 text-center text-xs font-medium text-[#48C9B0]">Todos tienen mesa</p>
      ) : visibles.length === 0 ? (
        <p className="py-6 text-center text-xs text-[#bbb]">Sin resultados</p>
      ) : grupos.map(([grupo, familias]) => (
        <div key={grupo || '__sin'} className="flex flex-col gap-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#999]">{grupo || 'Sin grupo'}</div>
          {Array.from(familias.entries()).map(([guestId, gente]) => (
            <div key={guestId} className="flex flex-col gap-1">
              {gente.length > 1 && puedeEditar && (
                <button type="button" onClick={() => onSentarGrupo(gente)} className="self-end text-[10.5px] font-semibold text-[#1f8a75] hover:underline">Sentar a los {gente.length}</button>
              )}
              {gente.map(p => <PersonaChip key={p.clave} persona={p} arrastrable={puedeEditar} onTap={() => onTap(p)} />)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
