'use client'

import { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Search, Users } from 'lucide-react'
import type { Persona } from '@/lib/mesas/asientos'
import FamiliaCard from './FamiliaCard'

// Panel de personas sin mesa, agrupado por el Grupo de la base (guests.side)
// y, dentro, una tarjeta por familia. Soltar aqui a alguien sentado lo quita.
export default function SinMesaPanel({ sinMesa, busqueda, setBusqueda, puedeEditar, arrastrando, marcados, onMarcar, onTap }: {
  sinMesa: Persona[]
  busqueda: string
  setBusqueda: (v: string) => void
  puedeEditar: boolean
  arrastrando: Persona[] | null
  marcados: Set<string>
  onMarcar: (claves: string[], on: boolean) => void
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
    return Array.from(porGrupo.entries()).sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])))
  }, [visibles])

  const familias = grupos.reduce((n, [, f]) => n + f.size, 0)
  const soltarParaQuitar = !!arrastrando && arrastrando.some(p => !sinMesa.some(s => s.clave === p.clave))
  const nMarcados = Array.from(marcados).filter(c => sinMesa.some(p => p.clave === c)).length

  return (
    <div ref={setNodeRef} className={'flex h-full w-[250px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-[#e8e8e8] p-3 transition ' + (isOver && soltarParaQuitar ? 'bg-[#fff0f0]' : 'bg-[#f8f8f8]')}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[#999]">
        <Users size={13} className="shrink-0" />
        <span className="flex-1">Sin mesa · {familias === 1 ? '1 familia' : familias + ' familias'} · {sinMesa.length}</span>
      </div>
      {soltarParaQuitar && (
        <div className="rounded-lg border border-dashed border-[#cc3333] bg-[#fff5f5] px-2 py-2 text-center text-[11px] font-semibold text-[#cc3333]">Suelta aquí para quitar de la mesa</div>
      )}
      {nMarcados > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-[#48C9B0] bg-[#f0fdfb] px-2.5 py-1.5 text-[11px] font-semibold text-[#1f8a75]">
          <span>{nMarcados} {nMarcados === 1 ? 'marcado' : 'marcados'} · elige una mesa</span>
          <button type="button" onClick={() => onMarcar(Array.from(marcados), false)} className="text-[#999] hover:text-[#1D1E20]">Quitar</button>
        </div>
      )}
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#bbb]" />
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar a alguien…" className="w-full rounded-lg border border-[#e0e0e0] bg-white py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#48C9B0]" />
      </div>
      {sinMesa.length === 0 ? (
        <p className="py-6 text-center text-xs font-medium text-[#48C9B0]">Todos tienen mesa</p>
      ) : visibles.length === 0 ? (
        <p className="py-6 text-center text-xs text-[#bbb]">Sin resultados</p>
      ) : grupos.map(([grupo, fams]) => (
        <div key={grupo || '__sin'} className="flex flex-col gap-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#999]">{grupo || 'Sin grupo'} · {fams.size}</div>
          {Array.from(fams.entries()).map(([guestId, gente]) => (
            <FamiliaCard key={guestId} titular={gente.find(p => !p.memberId) ?? null} miembros={gente.filter(p => p.memberId)} puedeEditar={puedeEditar} marcados={marcados} onMarcar={onMarcar} onTap={onTap} />
          ))}
        </div>
      ))}
    </div>
  )
}
