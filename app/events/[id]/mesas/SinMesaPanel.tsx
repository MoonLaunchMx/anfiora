'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Users } from 'lucide-react'
import type { Persona } from '@/lib/mesas/asientos'
import FamiliaCard from './FamiliaCard'

export const ANCHO_MIN = 200
export const ANCHO_MAX = 520

// Panel de personas sin mesa, agrupado por el Grupo de la base (guests.side)
// y, dentro, una tarjeta por familia. Soltar aqui a alguien sentado lo quita.
// El buscador es el de la barra: filtra el panel y las mesas a la vez.
// El borde derecho se jala para hacerlo mas ancho o mas angosto.
export default function SinMesaPanel({ sinMesa, busqueda, puedeEditar, arrastrando, marcados, onMarcar, onTap, ancho, setAncho }: {
  sinMesa: Persona[]
  busqueda: string
  puedeEditar: boolean
  arrastrando: Persona[] | null
  marcados: Set<string>
  onMarcar: (claves: string[], on: boolean) => void
  onTap: (p: Persona) => void
  ancho: number
  setAncho: (w: number) => void
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

  // Jalar el borde: el ancho se calcula desde donde empezo el arrastre.
  const arrastre = useRef<{ x0: number; w0: number } | null>(null)
  useEffect(() => {
    const mover = (e: MouseEvent) => { if (!arrastre.current) return; setAncho(Math.max(ANCHO_MIN, Math.min(ANCHO_MAX, arrastre.current.w0 + (e.clientX - arrastre.current.x0)))) }
    const soltar = () => { if (arrastre.current) { arrastre.current = null; document.body.style.cursor = ''; document.body.style.userSelect = '' } }
    window.addEventListener('mousemove', mover); window.addEventListener('mouseup', soltar)
    return () => { window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar) }
  }, [setAncho])

  return (
    <div className="relative flex h-full shrink-0" style={{ width: ancho }}>
      <div ref={setNodeRef} className={'flex h-full w-full flex-col gap-3 overflow-y-auto border-r border-[#e8e8e8] p-3 transition-colors ' + (isOver && soltarParaQuitar ? 'bg-[#fff0f0]' : 'bg-[#f8f8f8]')}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#999]">
          <Users size={14} className="shrink-0" />
          <span className="flex-1">Sin mesa · {familias === 1 ? '1 familia' : familias + ' familias'} · {sinMesa.length}</span>
        </div>
        {soltarParaQuitar && (
          <div className="rounded-lg border border-dashed border-[#cc3333] bg-[#fff5f5] px-2 py-2 text-center text-xs font-semibold text-[#cc3333]">Suelta aquí para quitar de la mesa</div>
        )}
        {nMarcados > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-[#48C9B0] bg-[#f0fdfb] px-2.5 py-1.5 text-xs font-semibold text-[#1f8a75]">
            <span>{nMarcados} {nMarcados === 1 ? 'marcado' : 'marcados'} · elige una mesa</span>
            <button type="button" onClick={() => onMarcar(Array.from(marcados), false)} className="text-[#999] hover:text-[#1D1E20]">Quitar</button>
          </div>
        )}
        {sinMesa.length === 0 ? (
          <p className="py-6 text-center text-sm font-medium text-[#48C9B0]">Todos tienen mesa</p>
        ) : visibles.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#bbb]">Nadie sin mesa con ese nombre</p>
        ) : grupos.map(([grupo, fams]) => (
          <div key={grupo || '__sin'} className="flex flex-col gap-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#999]">{grupo || 'Sin grupo'} · {fams.size}</div>
            {Array.from(fams.entries()).map(([guestId, gente]) => (
              <FamiliaCard key={guestId} titular={gente.find(p => !p.memberId) ?? null} miembros={gente.filter(p => p.memberId)} puedeEditar={puedeEditar} marcados={marcados} onMarcar={onMarcar} onTap={onTap} />
            ))}
          </div>
        ))}
      </div>
      <div role="separator" aria-label="Cambiar el ancho del panel" title="Jala para hacerlo más ancho o más angosto"
        onMouseDown={e => { e.preventDefault(); arrastre.current = { x0: e.clientX, w0: ancho }; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none' }}
        className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize hover:bg-[#48C9B0]/40 active:bg-[#48C9B0]/60" />
    </div>
  )
}
