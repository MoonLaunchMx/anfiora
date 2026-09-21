'use client'

import { useRef, useState } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'

// Vivia dentro de la pagina de invitados, donde nacio para las etiquetas y las
// alergias. Se saco aqui tal cual para que Proveedores use el MISMO control en
// vez de inventar otro: una etiqueta se ve y se captura igual en toda la app.
export const TAG_COLORS = [
  { bg: '#f0fdfb', border: '#9FE1CB', text: '#0F6E56' },
  { bg: '#f0f0ff', border: '#afa9ec', text: '#3C3489' },
  { bg: '#fff5f0', border: '#F0997B', text: '#993C1D' },
  { bg: '#f0f8ff', border: '#85B7EB', text: '#0C447C' },
  { bg: '#fffbf0', border: '#FAC775', text: '#854F0B' },
  { bg: '#fff0f7', border: '#ED93B1', text: '#72243E' },
  { bg: '#f3fde8', border: '#C0DD97', text: '#3B6D11' },
  { bg: '#fff5f0', border: '#f09595', text: '#A32D2D' },
]

export function getTagColor(tagIndex: number) {
  const i = ((tagIndex % TAG_COLORS.length) + TAG_COLORS.length) % TAG_COLORS.length
  return TAG_COLORS[i]
}

export default function TagInput({
  availableTags, selectedTags, onChangeSelected, onCreateTag, onDeleteTag, label = 'Tag',
}: {
  availableTags: string[]
  selectedTags: string[]
  onChangeSelected: (tags: string[]) => void
  onCreateTag?: (tag: string) => void
  // Sin esta prop no se ofrece borrar del catalogo. Invitados si la manda —
  // ahi el pool vive en el evento y se puede limpiar; en el Rolodex una
  // etiqueta esta repartida en las fichas y borrarla desde un alta seria
  // tocar proveedores que no estas viendo.
  onDeleteTag?: (tag: string) => void
  label?: string
}) {
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const q = query.trim()
  const ql = q.toLowerCase()
  const suggestions = availableTags.filter(t => !selectedTags.includes(t) && (!q || t.toLowerCase().includes(ql)))
  const openEditor = () => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0) }
  const closeEditor = () => { setEditing(false); setQuery('') }
  const remove = (tag: string) => onChangeSelected(selectedTags.filter(t => t !== tag))
  const assign = (tag: string) => { if (!selectedTags.includes(tag)) onChangeSelected([...selectedTags, tag]); setQuery('') }
  const confirmAdd = () => {
    if (!q) return
    const exact = availableTags.find(t => t.toLowerCase() === ql)
    if (exact) assign(exact)
    else { onCreateTag?.(q); onChangeSelected([...selectedTags, q]); setQuery('') }
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedTags.map(tag => {
          const col = getTagColor(availableTags.indexOf(tag))
          return (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
              style={{ background: col.bg, borderColor: col.border, color: col.text }}>
              {tag}
              <button type="button" onClick={() => remove(tag)} className="opacity-50 transition hover:opacity-100">✕</button>
            </span>
          )
        })}
        {!editing ? (
          <button type="button" onClick={openEditor}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#c8c8c8] px-2.5 py-1 text-xs font-medium text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
            <Plus className="h-3 w-3" /> {label}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#48C9B0] bg-white py-0.5 pl-2.5 pr-1.5">
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmAdd() } if (e.key === 'Escape') closeEditor() }}
              placeholder={label} className="w-24 bg-transparent text-xs text-[#1D1E20] outline-none placeholder:text-[#bbb]" />
            <button type="button" onClick={confirmAdd} disabled={!q} title="Agregar" className="text-[#48C9B0] transition disabled:opacity-30"><Check className="h-4 w-4" strokeWidth={3} /></button>
            <button type="button" onClick={closeEditor} title="Cancelar" className="text-[#bbb] transition hover:text-[#888]"><X className="h-4 w-4" /></button>
          </span>
        )}
      </div>

      {editing && suggestions.length > 0 && (
        <div className="mt-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#bbb]">Existentes</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map(tag => {
              const col = getTagColor(availableTags.indexOf(tag))
              return (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-xs"
                  style={{ borderColor: col.border, color: col.text }}>
                  <button type="button" onClick={() => assign(tag)} className="font-medium">{tag}</button>
                  {onDeleteTag && (
                    <button type="button" onClick={() => setConfirmDelete(tag)} title="Eliminar del evento" className="text-[#ccc] transition hover:text-[#cc3333]"><Trash2 className="h-3 w-3" /></button>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {confirmDelete && onDeleteTag && (
        <Modal open onClose={() => setConfirmDelete(null)} size="sm">
          <Modal.Body className="py-6 text-center">
            <h3 className="text-base font-bold text-[#1D1E20]">¿Eliminar &quot;{confirmDelete}&quot;?</h3>
            <p className="mt-1.5 text-xs text-[#666]">Se quitará de todos los invitados del evento. Esta acción no se puede deshacer.</p>
          </Modal.Body>
          <Modal.Footer>
            <button type="button" onClick={() => setConfirmDelete(null)} className="flex-1 rounded-lg border border-[#e0e0e0] py-2.5 text-sm text-[#888] transition hover:bg-[#f8f8f8]">Cancelar</button>
            <button type="button" onClick={() => { onDeleteTag(confirmDelete); setConfirmDelete(null) }} className="flex-1 rounded-lg bg-[#cc3333] py-2.5 text-sm font-semibold text-white transition hover:bg-[#b82e2e]">Eliminar</button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  )
}
