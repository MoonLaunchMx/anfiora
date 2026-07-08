'use client'

import { useEffect, useRef, useState } from 'react'
import { GripVertical, ChevronDown, Trash2, Plus } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { InviteDoc, Section, SectionType } from '@/lib/invite/schema'
import { SECTION_TYPES } from '@/lib/invite/schema'
import { addSection, removeSection, moveSection, updateSectionContent } from '@/lib/invite/doc'
import SectionForm from './SectionForm'

const TYPE_LABELS: Record<SectionType, string> = {
  portada: 'Portada',
  saludo: 'Saludo',
  detalles: 'Los detalles',
  dress_code: 'Dress code',
  itinerario: 'Itinerario',
  rsvp: 'Confirmación',
  enganche: 'Playlist y regalos',
  texto: 'Texto libre',
  cierre: 'Cierre',
}

const SINGLETON_TYPES = new Set<SectionType>(['dress_code', 'itinerario'])

function SortableSectionRow({
  section, expanded, onToggleExpand, onRemove, onPatch,
}: {
  section: Section
  expanded: boolean
  onToggleExpand: () => void
  onRemove: () => void
  onPatch: (patch: Record<string, unknown>) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="overflow-hidden rounded-xl border border-[#e8e8e8] bg-white">
      <div className="flex items-center gap-1 px-2 py-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center text-[#bbb] transition hover:text-[#888] active:cursor-grabbing"
          title="Arrastrar para reordenar"
        >
          <GripVertical size={16} />
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1 text-left"
        >
          <span className="truncate text-sm font-medium text-[#1D1E20]">{TYPE_LABELS[section.type]}</span>
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex h-7 w-7 shrink-0 items-center justify-center text-[#aaa] transition hover:text-[#555]"
        >
          <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#bbb] transition hover:bg-[#fff0f0] hover:text-[#cc3333]"
          title="Quitar sección"
        >
          <Trash2 size={15} />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-[#f0f0f0] bg-[#fafafa] px-3.5 py-3.5">
          <SectionForm section={section} onPatch={onPatch} />
        </div>
      )}
    </div>
  )
}

export default function BlockEditor({
  doc, onChange, makeId,
}: {
  doc: InviteDoc
  onChange: (next: InviteDoc) => void
  makeId: () => string
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const newIndex = doc.sections.findIndex(s => s.id === over.id)
    if (newIndex === -1) return
    onChange(moveSection(doc, active.id as string, newIndex))
  }

  const usedTypes = new Set(doc.sections.map(s => s.type))
  const availableTypes = SECTION_TYPES.filter(t => !(SINGLETON_TYPES.has(t) && usedTypes.has(t)))

  return (
    <div className="flex flex-col gap-4">
      {doc.sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e0e0e0] px-4 py-8 text-center text-sm text-[#999]">
          Sin secciones aún. Agrega la primera abajo.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={doc.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {doc.sections.map(section => (
                <SortableSectionRow
                  key={section.id}
                  section={section}
                  expanded={expandedId === section.id}
                  onToggleExpand={() => setExpandedId(prev => (prev === section.id ? null : section.id))}
                  onRemove={() => onChange(removeSection(doc, section.id))}
                  onPatch={patch => onChange(updateSectionContent(doc, section.id, patch))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div ref={menuRef} className="relative self-start">
        <button
          type="button"
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#ccc] px-3.5 py-2 text-xs font-medium text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
        >
          <Plus size={14} /> Agregar sección
        </button>
        {menuOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white py-1 shadow-lg">
            {availableTypes.length === 0 ? (
              <p className="px-3.5 py-2 text-xs text-[#bbb]">No hay más secciones para agregar.</p>
            ) : (
              availableTypes.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { onChange(addSection(doc, type, makeId)); setMenuOpen(false) }}
                  className="block w-full px-3.5 py-2 text-left text-xs text-[#1D1E20] transition hover:bg-[#f0fdfb]"
                >
                  {TYPE_LABELS[type]}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
