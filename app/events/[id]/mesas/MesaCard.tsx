'use client'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Persona } from '@/lib/mesas/asientos'
import { ChipTitular, ChipSeparado, IconoEstatus } from './chips'
import { idArrastre } from './FamiliaCard'

type Mesa = { id: string; number: number; name: string | null; capacity: number; shape: string }

// Un renglon dentro de la mesa: solo el icono y el nombre. Todo el renglon se
// arrastra (el titular jala a los suyos que estan aqui) y un clic abre el
// menu. En modo check-in el arrastre se apaga y aparece el cuadro grande.
function Renglon({ persona, grupo, esTitular, etiqueta, fueraDeFamilia, puedeEditar, modoCheckin, onTap, onCheckin }: {
  persona: Persona; grupo: Persona[]; esTitular: boolean; etiqueta: string | null; fueraDeFamilia: boolean; puedeEditar: boolean; modoCheckin: boolean
  onTap: () => void; onCheckin: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: idArrastre(persona), data: { personas: grupo }, disabled: !puedeEditar || modoCheckin })
  if (modoCheckin) {
    return (
      <button type="button" onClick={onCheckin} disabled={!puedeEditar}
        className={'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[15px] transition hover:bg-[#f8f8f8] ' + (esTitular ? 'text-[#1D1E20]' : 'pl-6 text-[#555]')}>
        <IconoEstatus rsvp={persona.rsvp} size={18} />
        <span className={'min-w-0 flex-1 truncate ' + (esTitular ? 'font-semibold' : '')}>{persona.nombre}</span>
        <span className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ' + (persona.checkedIn ? 'border-[#48C9B0] bg-[#48C9B0] text-white' : 'border-[#d0d0d0] bg-white')}>{persona.checkedIn && <Check size={15} strokeWidth={3} />}</span>
      </button>
    )
  }
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={onTap} role="button"
      className={'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[15px] transition hover:bg-[#f8f8f8] ' + (esTitular ? 'text-[#1D1E20]' : 'pl-6 text-[#555]') + (isDragging ? ' opacity-30' : '') + (puedeEditar ? ' cursor-grab active:cursor-grabbing' : ' cursor-pointer')}>
      <IconoEstatus rsvp={persona.rsvp} size={18} />
      <span className={'min-w-0 truncate ' + (esTitular ? 'font-semibold' : '')}>{persona.nombre}</span>
      {fueraDeFamilia && <ChipTitular persona={persona} />}
      <ChipSeparado etiqueta={etiqueta} />
    </div>
  )
}

export default function MesaCard({ table, ocupados, etiqueta, puedeEditar, puedeBorrar, modoCheckin, arrastrando, seleccion, onSentarSeleccion, onEditar, onBorrar, onAsignar, onPersona, onCheckin }: {
  table: Mesa; ocupados: Persona[]; etiqueta: (p: Persona) => string | null
  puedeEditar: boolean; puedeBorrar: boolean; modoCheckin: boolean
  arrastrando: Persona[] | null; seleccion: Persona[]
  onSentarSeleccion: () => void; onEditar: () => void; onBorrar: () => void; onAsignar: () => void
  onPersona: (p: Persona) => void; onCheckin: (p: Persona) => void
}) {
  const occ = ocupados.length
  const libres = table.capacity - occ
  const llena = libres <= 0
  const sobrecupo = occ > table.capacity
  const llegaron = ocupados.filter(p => p.checkedIn).length
  const entran = arrastrando ? arrastrando.filter(p => !ocupados.some(o => o.clave === p.clave)).length : 0
  const cabeArrastre = !!arrastrando && entran > 0 && entran <= libres
  const { setNodeRef, isOver } = useDroppable({ id: 't:' + table.id, disabled: !puedeEditar || !cabeArrastre })
  const activo = isOver && cabeArrastre

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
      <div className="flex items-center gap-2 border-b border-[#f0f0f0] px-3 py-2.5">
        <span className="rounded bg-[#f0f0f0] px-1.5 py-0.5 text-xs font-bold text-[#555]">#{table.number}</span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#1D1E20]">{table.name || `Mesa ${table.number}`}</span>
        {modoCheckin
          ? <span className="shrink-0 text-sm font-medium tabular-nums" style={{ color: occ > 0 && llegaron === occ ? '#0F6E56' : '#888' }}>{llegaron} de {occ}</span>
          : <span className="shrink-0 text-sm font-medium tabular-nums" style={{ color: sobrecupo ? '#cc3333' : llena ? '#0F6E56' : '#888' }}>{occ}/{table.capacity}</span>}
        {puedeEditar && !modoCheckin && <button type="button" onClick={onEditar} aria-label="Editar mesa" className="shrink-0 text-[#bbb] hover:text-[#48C9B0]"><Pencil size={15} /></button>}
        {puedeBorrar && !modoCheckin && <button type="button" onClick={onBorrar} aria-label="Eliminar mesa" className="shrink-0 text-[#bbb] hover:text-[#cc3333]"><Trash2 size={15} /></button>}
      </div>
      <div className="h-1 bg-[#eee]"><div className="h-full" style={{ width: `${Math.min(((modoCheckin ? llegaron : occ) / (modoCheckin ? Math.max(1, occ) : table.capacity)) * 100, 100)}%`, background: sobrecupo && !modoCheckin ? '#cc3333' : '#48C9B0' }} /></div>
      <div className="flex flex-1 flex-col gap-2 px-2 py-2">
        {familias.length === 0 && !activo && <p className="py-3 text-center text-sm italic text-[#bbb]">{puedeEditar && !modoCheckin ? 'Arrastra una familia aquí' : 'Nadie sentado'}</p>}
        {familias.map((f, i) => (
          <div key={f.titular?.clave ?? 'fam-' + i} className="border-l-2 border-[#e8e8e8] pl-1.5">
            {f.titular && <Renglon persona={f.titular} grupo={[f.titular, ...f.miembros]} esTitular etiqueta={etiqueta(f.titular)} fueraDeFamilia={false} puedeEditar={puedeEditar} modoCheckin={modoCheckin} onTap={() => onPersona(f.titular!)} onCheckin={() => onCheckin(f.titular!)} />}
            {f.miembros.map(m => <Renglon key={m.clave} persona={m} grupo={[m]} esTitular={false} etiqueta={etiqueta(m)} fueraDeFamilia={!f.titular} puedeEditar={puedeEditar} modoCheckin={modoCheckin} onTap={() => onPersona(m)} onCheckin={() => onCheckin(m)} />)}
          </div>
        ))}
        {activo && <div className="rounded-lg border border-dashed border-[#48C9B0] bg-[#f0fdfb] px-2 py-2 text-center text-xs font-semibold text-[#1f8a75]">Soltar aquí · {entran === 1 ? 'cabe 1' : `caben ${entran}`}</div>}
        {arrastrando && !cabeArrastre && entran > 0 && <div className="rounded-lg border border-dashed border-[#e0e0e0] px-2 py-1.5 text-center text-[11px] text-[#999]">No caben {entran}, hay {Math.max(0, libres)}</div>}
        {sobrecupo && <p className="text-xs font-medium text-[#cc3333]">Sobrecupo: {occ - table.capacity} de más</p>}
      </div>
      {puedeEditar && !arrastrando && !modoCheckin && (
        nSel > 0
          ? <button type="button" onClick={onSentarSeleccion} disabled={!cabeSel} className="m-2 rounded-lg bg-[#48C9B0] py-2 text-sm font-semibold text-white hover:bg-[#3ab89f] disabled:cursor-not-allowed disabled:opacity-35">{cabeSel ? `Sentar aquí a ${nSel}` : `No caben ${nSel}, hay ${Math.max(0, libres)}`}</button>
          : !llena && <button type="button" onClick={onAsignar} className="m-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-[#e0e0e0] py-2 text-xs text-[#aaa] hover:border-[#48C9B0] hover:text-[#48C9B0] sm:hidden"><Plus size={12} />Asignar</button>
      )}
    </div>
  )
}
