'use client'

import { useEffect, useState } from 'react'
import { GripVertical, ChevronDown, Trash2 } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
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
import { groupSectionTypes } from '@/lib/invite/section-catalog'
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
  galeria: 'Carrusel de fotos',
  video: 'Video',
  audio: 'Audio',
}

const SINGLETON_TYPES = new Set<SectionType>(['dress_code', 'itinerario', 'playlist', 'mesa', 'rsvp'])
// 'enganche' se separo en playlist + mesa; se conserva para no romper docs viejos pero no se ofrece agregarlo.
const HIDDEN_TYPES = new Set<SectionType>(['enganche'])

function SortableSectionRow({
  section, mobile, expanded, onOpen, onRemove, onPatch,
}: {
  section: Section
  mobile: boolean
  expanded: boolean
  onOpen: () => void
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
        onClick={onOpen}
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
        {!mobile && (
          <ChevronDown size={16} className={`shrink-0 text-[#aaa] transition-transform ${expanded ? 'rotate-180' : ''}`} />
        )}
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
      {!mobile && expanded && (
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const apply = () => setMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Al pasar a escritorio, la edicion en modal se convierte en acordeon inline (continuidad).
  useEffect(() => {
    if (!mobile && editingId) {
      setExpandedId(editingId)
      setEditingId(null)
    }
  }, [mobile, editingId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const editingSection = editingId ? doc.sections.find(s => s.id === editingId) ?? null : null
  const modalOpen = addOpen || editingSection !== null

  useEffect(() => {
    if (editingId && !doc.sections.some(s => s.id === editingId)) setEditingId(null)
  }, [doc.sections, editingId])

  useEffect(() => {
    if (!modalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (editingId) setEditingId(null)
      else onAddOpenChange(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [modalOpen, editingId, onAddOpenChange])

  const handleOpenSection = (id: string) => {
    if (mobile) setEditingId(id)
    else setExpandedId(prev => (prev === id ? null : id))
  }

  const handleAdd = (type: SectionType) => {
    const next = addSection(doc, type, makeId)
    onChange(next)
    onAddOpenChange(false)
    const newId = next.sections[next.sections.length - 1]?.id ?? null
    if (!newId) return
    if (mobile) setEditingId(newId)
    else setExpandedId(newId)
  }

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
                  mobile={mobile}
                  expanded={expandedId === section.id}
                  onOpen={() => handleOpenSection(section.id)}
                  onRemove={() => onChange(removeSection(doc, section.id))}
                  onPatch={patch => onChange(updateSectionContent(doc, section.id, patch))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Modal open={addOpen} onClose={() => onAddOpenChange(false)} size="xl">
        <Modal.Header title="Agregar sección" />
        <Modal.Body className="p-4 sm:p-5">
          {availableTypes.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#bbb]">No hay más secciones para agregar.</p>
          ) : (
            <div className="flex flex-col gap-4 sm:gap-5">
              {groupSectionTypes(availableTypes).map(group => (
                <div key={group.key}>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#999]">{group.label}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                    {group.types.map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleAdd(type)}
                        className="rounded-xl border border-[#e8e8e8] px-3 py-3 text-left text-xs font-medium text-[#1D1E20] transition hover:border-[#48C9B0] hover:bg-[#f0fdfb] sm:py-4 sm:text-sm"
                      >
                        {TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
      </Modal>

      {editingSection && (
        <Modal open onClose={() => setEditingId(null)} size="lg">
          <Modal.Header title={TYPE_LABELS[editingSection.type]} />
          <Modal.Body className="bg-[#fafafa] px-4">
            <SectionForm
              section={editingSection}
              onPatch={patch => onChange(updateSectionContent(doc, editingSection.id, patch))}
            />
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="w-full rounded-xl bg-[#48C9B0] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3db39d]"
            >
              Listo
            </button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  )
}
