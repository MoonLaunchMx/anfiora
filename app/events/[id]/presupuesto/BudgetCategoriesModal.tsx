'use client'

import { useState } from 'react'
import { Trash2, Plus, GripVertical, Check } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { categoryLabel } from './lib/categories'
import { Modal } from '@/app/components/ui/Modal'

interface Props {
  categories: string[]
  itemCountByCategory: Record<string, number>
  onAdd: (name: string) => void
  onRename: (oldName: string, newName: string) => void
  onDelete: (name: string) => void
  onReorder: (next: string[]) => void
  onClose: () => void
}

function Row({ name, count, onRename, onDelete }: { name: string; count: number; onRename: (o: string, n: string) => void; onDelete: (n: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: name })
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg border border-[#e8e8e8] bg-white px-2 py-2">
      <button {...attributes} {...listeners} className="cursor-grab text-[#ccc] hover:text-[#888]"><GripVertical size={15} /></button>
      {editing ? (
        <input autoFocus value={value} onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { onRename(name, value); setEditing(false) } if (e.key === 'Escape') { setValue(name); setEditing(false) } }}
          className="flex-1 rounded border border-[#e0e0e0] px-2 py-1 text-base outline-none focus:border-[#48C9B0]" />
      ) : (
        <button onClick={() => { setValue(name); setEditing(true) }} className="flex-1 text-left text-sm text-[#1D1E20] hover:text-[#48C9B0]">{categoryLabel(name)}</button>
      )}
      {count > 0 && <span className="text-[11px] text-[#aaa]">{count}</span>}
      {editing
        ? <button onClick={() => { onRename(name, value); setEditing(false) }} className="text-[#48C9B0]"><Check size={15} /></button>
        : <button onClick={() => onDelete(name)} className="text-[#ccc] hover:text-[#cc3333]"><Trash2 size={14} /></button>}
    </div>
  )
}

export function BudgetCategoriesModal({ categories, itemCountByCategory, onAdd, onRename, onDelete, onReorder, onClose }: Props) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = (e: any) => {
    const { active, over } = e
    if (over && active.id !== over.id) {
      const oldIdx = categories.indexOf(active.id)
      const newIdx = categories.indexOf(over.id)
      onReorder(arrayMove(categories, oldIdx, newIdx))
    }
  }

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header title="Categorías" />
      <Modal.Body>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categories} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-1.5">
              {categories.map(c => (
                <Row key={c} name={c} count={itemCountByCategory[c] || 0} onRename={onRename} onDelete={onDelete} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {adding ? (
          <div className="mt-2 flex items-center gap-2">
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { onAdd(newName); setNewName(''); setAdding(false) } if (e.key === 'Escape') { setAdding(false); setNewName('') } }}
              placeholder="Nombre de la categoría" className="flex-1 rounded-lg border border-[#e0e0e0] px-3 py-2 text-base outline-none focus:border-[#48C9B0]" />
            <button onClick={() => { onAdd(newName); setNewName(''); setAdding(false) }} className="rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white">Agregar</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="mt-3 flex items-center gap-1.5 text-sm text-[#888] hover:text-[#48C9B0]">
            <Plus size={14} /> Agregar categoría
          </button>
        )}
      </Modal.Body>
    </Modal>
  )
}
