'use client'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import { GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Persona } from '@/lib/mesas/asientos'
import { ChipTitular, ChipSeparado, IconoEstatus } from './chips'
import { idArrastre } from './FamiliaCard'
import { Palomita } from './PersonaItem'

type Mesa = { id: string; number: number; name: string | null; capacity: number; shape: string }

// Un renglon dentro de la mesa. Jalar al titular jala a los suyos que estan
// en esta misma mesa; jalar a un acompanante lo mueve solo.
function Renglon({ persona, grupo, esTitular, etiqueta, fueraDeFamilia, puedeEditar, onTap, onQuitar, onCheckin }: {
  persona: Persona; grupo: Persona[]; esTitular: boolean; etiqueta: string | null; fueraDeFamilia: boolean; puedeEditar: boolean
  onTap: () => void; onQuitar: () => void; onCheckin: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: idArrastre(persona), data: { personas: grupo }, disabled: !puedeEditar })
  const quieto = { onMouseDown: (e: React.MouseEvent) => e.stopPropagation() }
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      className={'flex items-center gap-1.5 py-1 text-xs ' + (esTitular ? '' : 'pl-4 text-[#555]') + (isDragging ? ' opacity-30' : '') + (puedeEditar ? ' cursor-grab active:cursor-grabbing' : '')}>
      <IconoEstatus rsvp={persona.rsvp} size={14} />
      <button type="button" onClick={onTap} {...quieto} className={'min-w-0 truncate text-left hover:underline ' + (esTitular ? 'font-semibold text-[#1D1E20]' : '')}>{persona.nombre}</button>
      {fueraDeFamilia && <ChipTitular persona={persona} />}
      <ChipSeparado etiqueta={etiqueta} />
      <span className="flex-1" />
      {puedeEditar
        ? <button type="button" onClick={onCheckin} {...quieto} aria-label="Check-in" className={'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition ' + (persona.checkedIn ? 'border-[#48C9B0] bg-[#48C9B0]' : 'border-[#d0d0d0] bg-white hover:border-[#48C9B0]')}>{persona.checkedIn && <Palomita />}</button>
        : <span className={'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ' + (persona.checkedIn ? 'border-[#48C9B0] bg-[#48C9B0]' : 'border-[#d0d0d0] bg-white')}>{persona.checkedIn && <Palomita />}</span>}
      {puedeEditar && <button type="button" onClick={onQuitar} {...quieto} aria-label="Quitar de la mesa" className="shrink-0 text-[#ccc] hover:text-[#cc3333]"><X size={11} /></button>}
      {puedeEditar && <GripVertical size={11} className="shrink-0 text-[#d0d0d0]" />}
    </div>
  )
}

export default function MesaCard({ table, ocupados, etiqueta, puedeEditar, puedeBorrar, arrastrando, seleccion, onSentarSeleccion, onEditar, onBorrar, onAsignar, onPersona, onQuitar, onCheckin }: {
  table: Mesa; ocupados: Persona[]; etiqueta: (p: Persona) => string | null
  puedeEditar: boolean; puedeBorrar: boolean
  arrastrando: Persona[] | null; seleccion: Persona[]
  onSentarSeleccion: () => void; onEditar: () => void; onBorrar: () => void; onAsignar: () => void
  onPersona: (p: Persona) => void; onQuitar: (p: Persona) => void; onCheckin: (p: Persona) => void
}) {
  const occ = ocupados.length
  const libres = table.capacity - occ
  const llena = libres <= 0
  const sobrecupo = occ > table.capacity
  // Lo que se arrastra cuenta solo a los que no estan ya en esta mesa.
  const entran = arrastrando ? arrastrando.filter(p => !ocupados.some(o => o.clave === p.clave)).length : 0
  const cabeArrastre = !!arrastrando && entran > 0 && entran <= libres
  const { setNodeRef, isOver } = useDroppable({ id: 't:' + table.id, disabled: !puedeEditar || !cabeArrastre })
  const activo = isOver && cabeArrastre

  // Familias dentro de la mesa: titular y luego sus acompanantes; los
  // acompanantes cuyo titular no esta aqui van con su etiqueta "de X".
  const familias: { titular: Persona | null; miembros: Persona[] }[] = []
  const vistos = new Set<string>()
  for (const p of ocupados) {
    if (vistos.has(p.guestId)) continue
    vistos.add(p.guestId)
    const delGrupo = ocupados.filter(o => o.guestId === p.guestId)
    familias.push({ titular: delGrupo.find(o => !o.memberId) ?? null, miembros: delGrupo.filter(o => o.memberId) })
  }

  const nSel = seleccion.length
  const cabeSel = nSel > 0 && nSel <= libres

  return (
    <div ref={setNodeRef} className={'flex flex-col rounded-xl border bg-white transition ' + (activo ? 'border-[#48C9B0] shadow-[0_0_0_3px_#f0fdfb]' : arrastrando && !cabeArrastre ? 'border-[#e8e8e8] opacity-60' : 'border-[#e8e8e8]')}>
      <div className="flex items-center gap-2 border-b border-[#f0f0f0] px-3 py-2">
        <span className="rounded bg-[#f0f0f0] px-1.5 py-0.5 text-[11px] font-bold text-[#555]">#{table.number}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#1D1E20]">{table.name || `Mesa ${table.number}`}</span>
        <span className="shrink-0 text-[11px] font-medium tabular-nums" style={{ color: sobrecupo ? '#cc3333' : llena ? '#0F6E56' : '#888' }}>{occ}/{table.capacity}</span>
        {puedeEditar && <button type="button" onClick={onEditar} aria-label="Editar mesa" className="shrink-0 text-[#bbb] hover:text-[#48C9B0]"><Pencil size={13} /></button>}
        {puedeBorrar && <button type="button" onClick={onBorrar} aria-label="Eliminar mesa" className="shrink-0 text-[#bbb] hover:text-[#cc3333]"><Trash2 size={13} /></button>}
      </div>
      <div className="h-1 bg-[#eee]"><div className="h-full" style={{ width: `${Math.min((occ / table.capacity) * 100, 100)}%`, background: sobrecupo ? '#cc3333' : llena ? '#48C9B0' : '#a0e0c0' }} /></div>
      <div className="flex flex-1 flex-col gap-1.5 px-3 py-2">
        {familias.length === 0 && !activo && <p className="py-3 text-center text-[11px] italic text-[#bbb]">{puedeEditar ? 'Arrastra una familia aquí' : 'Nadie sentado'}</p>}
        {familias.map((f, i) => (
          <div key={f.titular?.clave ?? 'fam-' + i} className="border-l-2 border-[#e8e8e8] pl-2">
            {f.titular && <Renglon persona={f.titular} grupo={[f.titular, ...f.miembros]} esTitular etiqueta={etiqueta(f.titular)} fueraDeFamilia={false} puedeEditar={puedeEditar} onTap={() => onPersona(f.titular!)} onQuitar={() => onQuitar(f.titular!)} onCheckin={() => onCheckin(f.titular!)} />}
            {f.miembros.map(m => <Renglon key={m.clave} persona={m} grupo={[m]} esTitular={false} etiqueta={etiqueta(m)} fueraDeFamilia={!f.titular} puedeEditar={puedeEditar} onTap={() => onPersona(m)} onQuitar={() => onQuitar(m)} onCheckin={() => onCheckin(m)} />)}
          </div>
        ))}
        {activo && <div className="rounded-lg border border-dashed border-[#48C9B0] bg-[#f0fdfb] px-2 py-2 text-center text-[11px] font-semibold text-[#1f8a75]">Soltar aquí · {entran === 1 ? 'cabe 1' : `caben ${entran}`}</div>}
        {arrastrando && !cabeArrastre && entran > 0 && <div className="rounded-lg border border-dashed border-[#e0e0e0] px-2 py-1.5 text-center text-[10.5px] text-[#999]">No caben {entran}, hay {Math.max(0, libres)}</div>}
        {sobrecupo && <p className="text-[11px] font-medium text-[#cc3333]">Sobrecupo: {occ - table.capacity} de más</p>}
      </div>
      {puedeEditar && !arrastrando && (
        nSel > 0
          ? <button type="button" onClick={onSentarSeleccion} disabled={!cabeSel} className="m-2 rounded-lg bg-[#48C9B0] py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#3ab89f] disabled:cursor-not-allowed disabled:opacity-35">{cabeSel ? `Sentar aquí a ${nSel}` : `No caben ${nSel}, hay ${Math.max(0, libres)}`}</button>
          : !llena && <button type="button" onClick={onAsignar} className="m-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-[#e0e0e0] py-1.5 text-[11px] text-[#aaa] hover:border-[#48C9B0] hover:text-[#48C9B0] sm:hidden"><Plus size={11} />Asignar</button>
      )}
    </div>
  )
}
