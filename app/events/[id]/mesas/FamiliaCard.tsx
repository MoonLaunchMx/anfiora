'use client'

import { useDraggable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import type { Persona } from '@/lib/mesas/asientos'
import { IconoEstatus } from './chips'

// Una familia en el panel "Sin mesa": el titular arriba y sus acompanantes
// colgando. Jalar al titular jala a toda la tarjeta; cada acompanante tiene
// su propio agarre. La palomita marca para "Sentar aqui" sin arrastrar.
export const idArrastre = (p: Persona) => 'p:' + p.clave

function Renglon({ persona, personas, esTitular, puedeEditar, marcado, onMarcar, onTap }: {
  persona: Persona; personas: Persona[]; esTitular: boolean; puedeEditar: boolean
  marcado: boolean; onMarcar: () => void; onTap: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: idArrastre(persona), data: { personas }, disabled: !puedeEditar })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      className={'relative flex items-center gap-2 py-1.5 pr-2 text-xs ' + (esTitular ? 'pl-2' : 'pl-6 text-[#555] before:absolute before:left-3 before:top-0 before:h-1/2 before:w-2 before:rounded-bl before:border-b before:border-l before:border-[#d8d8d8]') + (isDragging ? ' opacity-30' : '') + (puedeEditar ? ' cursor-grab active:cursor-grabbing' : '')}>
      {puedeEditar && <input type="checkbox" checked={marcado} onChange={onMarcar} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} className="shrink-0" style={{ accentColor: '#48C9B0' }} />}
      <IconoEstatus rsvp={persona.rsvp} size={14} />
      <button type="button" onClick={onTap} onMouseDown={e => e.stopPropagation()} className={'min-w-0 flex-1 truncate text-left hover:underline ' + (esTitular ? 'font-semibold text-[#1D1E20]' : '')}>{persona.nombre}</button>
      {esTitular && personas.length > 1 && <span className="shrink-0 text-[10px] font-semibold text-[#999]">{personas.length}</span>}
      {puedeEditar && <GripVertical size={12} className="shrink-0 text-[#c8c8c8]" />}
    </div>
  )
}

export default function FamiliaCard({ titular, miembros, puedeEditar, marcados, onMarcar, onTap }: {
  titular: Persona | null; miembros: Persona[]; puedeEditar: boolean
  marcados: Set<string>; onMarcar: (claves: string[], on: boolean) => void; onTap: (p: Persona) => void
}) {
  const todos = titular ? [titular, ...miembros] : miembros
  const todosMarcados = todos.every(p => marcados.has(p.clave))
  return (
    <div className="rounded-lg border border-[#e0e0e0] bg-white">
      {titular
        ? <Renglon persona={titular} personas={todos} esTitular puedeEditar={puedeEditar} marcado={todosMarcados} onMarcar={() => onMarcar(todos.map(p => p.clave), !todosMarcados)} onTap={() => onTap(titular)} />
        : <div className="px-2 pt-1.5 text-[10px] font-medium text-[#999]">de {miembros[0]?.titular}</div>}
      {miembros.map(m => <Renglon key={m.clave} persona={m} personas={[m]} esTitular={false} puedeEditar={puedeEditar} marcado={marcados.has(m.clave)} onMarcar={() => onMarcar([m.clave], !marcados.has(m.clave))} onTap={() => onTap(m)} />)}
    </div>
  )
}
