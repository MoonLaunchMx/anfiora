'use client'

import { useDraggable } from '@dnd-kit/core'
import type { Persona } from '@/lib/mesas/asientos'
import { sillasDe } from '@/lib/mesas/sillas'
import { estatusDe } from './estatus'
import { idArrastre } from './PersonaItem'

// Encima del SVG de cada mesa del plano, un cuadrito invisible por silla
// ocupada: es la persona, se puede jalar a otra mesa y al pasar el mouse
// dice quien es. Solo mouse: con el dedo se arrastra la mesa, no la persona.
function Silla({ persona, x, y, etiqueta, puedeEditar, onClick }: { persona: Persona; x: number; y: number; etiqueta: string | null; puedeEditar: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: idArrastre(persona), data: { persona }, disabled: !puedeEditar })
  const titulo = [persona.nombre, persona.titular ? 'de ' + persona.titular : null, estatusDe(persona.rsvp).label, etiqueta ? 'su familia: ' + etiqueta : null, puedeEditar ? 'arrastra para mover' : null].filter(Boolean).join(' · ')
  return (
    <div ref={setNodeRef} {...attributes} title={titulo} data-canvas-item="true"
      onMouseDown={e => { listeners?.onMouseDown?.(e); e.stopPropagation() }}
      onClick={e => { e.stopPropagation(); onClick() }}
      style={{ position: 'absolute', left: x - 9, top: y - 9, width: 18, height: 18, borderRadius: '50%', cursor: puedeEditar ? 'grab' : 'pointer', opacity: isDragging ? 0.3 : 1, zIndex: 5 }}
    />
  )
}

export default function SillasArrastrables({ shape, capacity, ocupados, etiqueta, puedeEditar, onPersona }: {
  shape: string; capacity: number; ocupados: Persona[]; etiqueta: (p: Persona) => string | null; puedeEditar: boolean; onPersona: (p: Persona) => void
}) {
  const d = sillasDe(shape, capacity)
  return (
    <>
      {ocupados.map((p, i) => d.sillas[i] ? <Silla key={p.clave} persona={p} x={d.sillas[i].x} y={d.sillas[i].y} etiqueta={etiqueta(p)} puedeEditar={puedeEditar} onClick={() => onPersona(p)} /> : null)}
    </>
  )
}
