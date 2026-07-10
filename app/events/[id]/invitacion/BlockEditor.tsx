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
  playlist: 'Playlist',
  mesa: 'Mesa de regalos',
  texto: 'Texto libre',
  cierre: 'Cierre',
}

const SINGLETON_TYPES = new Set<SectionType>(['dress_code', 'itinerario', 'playlist', 'mesa'])
// 'enganche' se separo en playlist + mesa; se conserva para no romper docs viejos pero no se ofrece agregarlo.
const HIDDEN_TYPES = new Set<SectionType>(['enganche'])

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
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? '0 10px 26px rgba(0,0,0,0.14)' : undefined,
    zIndex: isDragging ? 20 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="overflow-hidden rounded-xl border border-[#e8e8e8] bg-white">
      <div
        onClick={onToggleExpand}
        className="flex cursor-pointer select-none items-center gap-1 px-3 py-2.5"
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
          aria-label="Arrastra para reordenar"
          title="Arrastra para reordenar"
          className="-ml-1.5 flex h-8 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-[#ccc] transition hover:bg-[#f5f5f5] hover:text-[#999] active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#1D1E20]">{TYPE_LABELS[section.type]}</span>
        <ChevronDown size={16} className={`shrink-0 text-[#aaa] transition-transform ${expanded ? 'rotate-180' : ''}`} />
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove() }}
          onPointerDown={e => e.stopPropagation()}
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

  const handleDragStart = () => { document.body.style.cursor = 'grabbing' }

  const handleDragEnd = (event: DragEndEvent) => {
    document.body.style.cursor = ''
    const { active, over } = event
    if (!over || active.id === over.id) return
    const newIndex = doc.sections.findIndex(s => s.id === over.id)
    if (newIndex === -1) return
    onChange(moveSection(doc, active.id as string, newIndex))
  }

  const usedTypes = new Set(doc.sections.map(s => s.type))
  const availableTypes = SECTION_TYPES.filter(t => !HIDDEN_TYPES.has(t) && !(SINGLETON_TYPES.has(t) && usedTypes.has(t)))

  return (
    <div className="flex flex-col gap-4">
      {doc.sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e0e0e0] px-4 py-8 text-center text-sm text-[#999]">
          Sin secciones aún. Agrega la primera abajo.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => { document.body.style.cursor = '' }}>
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
