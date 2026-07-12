'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { GripVertical, ChevronDown, Trash2, X } from 'lucide-react'
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
  media: 'Imagen o GIF',
  video: 'Video',
  audio: 'Audio',
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
  doc, onChange, makeId, addOpen, onAddOpenChange,
}: {
  doc: InviteDoc
  onChange: (next: InviteDoc) => void
  makeId: () => string
  addOpen: boolean
  onAddOpenChange: (v: boolean) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  useEffect(() => {
    if (!addOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onAddOpenChange(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [addOpen, onAddOpenChange])

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

      <AnimatePresence>
        {addOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onAddOpenChange(false)} />
            <motion.div
              className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl sm:max-w-2xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-3 sm:px-5 sm:py-4">
                <h3 className="text-sm font-semibold text-[#1D1E20] sm:text-base">Agregar sección</h3>
                <button
                  type="button"
                  onClick={() => onAddOpenChange(false)}
                  aria-label="Cerrar"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#bbb] transition hover:bg-[#f5f5f5] hover:text-[#666]"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-5">
                {availableTypes.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#bbb]">No hay más secciones para agregar.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                    {availableTypes.map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => { onChange(addSection(doc, type, makeId)); onAddOpenChange(false) }}
                        className="rounded-xl border border-[#e8e8e8] px-3 py-3 text-left text-xs font-medium text-[#1D1E20] transition hover:border-[#48C9B0] hover:bg-[#f0fdfb] sm:py-4 sm:text-sm"
                      >
                        {TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
