'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { Trash2, Send, Clock, MessageSquare, AlertCircle, CheckCircle, XCircle, Download, Upload, Columns3, Search, UserPlus, Plus, Check, X, Filter, Loader2, FileSpreadsheet, FileText, AlertTriangle, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buildGuestDeletionOps, executeGuestDeletion, guestConversationIds } from '@/lib/guests/delete'
import { PartyMember, Guest, Event, EventSettings, EventStatus, RsvpStatus } from '@/lib/types'
import StatsCollapse, { StatsToggleButton, useStatsToggle } from '@/app/components/ui/StatsCollapse'
import { ImportStepsModal } from '@/app/components/ui/ImportStepsModal'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  mensaje_enviado:  { label: 'Mensaje enviado',  color: '#1a56a0', bg: '#f0f5ff', border: '#b3c8ee', icon: <Send       size={13} /> },
  pending:          { label: 'Pendiente',         color: '#b8860b', bg: '#fffbf0', border: '#f0d080', icon: <Clock      size={13} /> },
  respondio:        { label: 'Respondió',         color: '#c06000', bg: '#fff8f0', border: '#f0c090', icon: <MessageSquare size={13} /> },
  accion_necesaria: { label: 'Acción necesaria',  color: '#cc3333', bg: '#fff0f0', border: '#ffc0c0', icon: <AlertCircle size={13} /> },
  confirmed:        { label: 'Confirmado',        color: '#2a7a50', bg: '#f0fff6', border: '#a0e0c0', icon: <CheckCircle size={13} /> },
  declined:         { label: 'Declinado',         color: '#cc3333', bg: '#fff0f0', border: '#ffc0c0', icon: <XCircle    size={13} /> },
}

const STATUS_ORDER: RsvpStatus[] = ['pending', 'mensaje_enviado', 'respondio', 'accion_necesaria', 'confirmed', 'declined']

const ATTENTION_LABEL: Record<string, string> = {
  alergia: 'Alergia o restricción',
  peticion: 'Petición de acompañantes',
  queja: 'Queja',
  duda: 'Duda',
  otro: 'Requiere atención',
}

type ColumnKey = 'tags' | 'mesa' | 'lado' | 'notas' | 'telefono' | 'estatus'

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'tags',     label: 'Tags' },
  { key: 'mesa',     label: 'Mesa' },
  { key: 'lado',     label: 'Grupo' },
  { key: 'notas',    label: 'Notas' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'estatus',  label: 'Estatus' },
]

const STORAGE_KEY = 'anfiora_guest_columns'

function loadSavedColumns(): Set<ColumnKey> {
  if (typeof window === 'undefined') return new Set(ALL_COLUMNS.map(c => c.key))
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return new Set(JSON.parse(raw) as ColumnKey[])
  } catch {}
  return new Set(ALL_COLUMNS.map(c => c.key))
}

function SearchBox({ onDebounced }: { onDebounced: (v: string) => void }) {
  const [value, setValue] = useState('')
  useEffect(() => {
    const t = setTimeout(() => onDebounced(value), 180)
    return () => clearTimeout(t)
  }, [value])
  return (
    <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none lg:w-80">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa] pointer-events-none" />
      <input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder="Buscar..."
        className="w-full rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] pl-8 pr-3 py-2 text-sm text-[#1D1E20] outline-none" />
    </div>
  )
}

function StatusDot({ value, onChange }: { value: RsvpStatus; onChange: (s: RsvpStatus) => void }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const s = STATUS_LABEL[value]

  const sheet = open && mounted ? createPortal(
    <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setOpen(false)}>
      <div className="w-full rounded-t-2xl border-t border-[#e8e8e8] bg-white pb-8 pt-3 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e0e0e0]" />
        <p className="mb-2 px-5 text-xs font-semibold uppercase tracking-wider text-[#aaa]">Cambiar estatus</p>
        {STATUS_ORDER.map(key => {
          const opt = STATUS_LABEL[key]
          return (
            <button key={key} onClick={() => { onChange(key); setOpen(false) }}
              className={'flex w-full items-center gap-3 px-5 py-3.5 transition active:bg-[#f8f8f8] ' + (value === key ? 'opacity-100' : 'opacity-70')}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border" style={{ background: opt.bg, borderColor: opt.border, color: opt.color }}>{opt.icon}</span>
              <span className="text-sm font-medium" style={{ color: opt.color }}>{opt.label}</span>
              {value === key && <span className="ml-auto text-xs text-[#48C9B0]">✓</span>}
            </button>
          )
        })}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <button onClick={e => { e.stopPropagation(); setOpen(true) }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition active:scale-95"
        style={{ background: s.bg, borderColor: s.border, color: s.color }} title={s.label}>
        {s.icon}
      </button>
      {sheet}
    </>
  )
}

const GROUP_COLORS = ['#48C9B0', '#7F77DD', '#F0997B', '#378ADD', '#EF9F27', '#D4537E', '#639922', '#D85A30']


const TAG_COLORS = [
  { bg: '#f0fdfb', border: '#9FE1CB', text: '#0F6E56' },
  { bg: '#f0f0ff', border: '#afa9ec', text: '#3C3489' },
  { bg: '#fff5f0', border: '#F0997B', text: '#993C1D' },
  { bg: '#f0f8ff', border: '#85B7EB', text: '#0C447C' },
  { bg: '#fffbf0', border: '#FAC775', text: '#854F0B' },
  { bg: '#fff0f7', border: '#ED93B1', text: '#72243E' },
  { bg: '#f3fde8', border: '#C0DD97', text: '#3B6D11' },
  { bg: '#fff5f0', border: '#f09595', text: '#A32D2D' },
]

function getTagColor(tagIndex: number) {
  const i = ((tagIndex % TAG_COLORS.length) + TAG_COLORS.length) % TAG_COLORS.length
  return TAG_COLORS[i]
}

function loadImageData(src: string): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no ctx')); return }
      ctx.drawImage(img, 0, 0)
      resolve({ dataUrl: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight })
    }
    img.onerror = reject
    img.src = src
  })
}

function GroupInput({ availableGroups, selectedGroup, onChange, onCreateGroup, onDeleteGroup }: {
  availableGroups: string[]
  selectedGroup: string
  onChange: (group: string) => void
  onCreateGroup: (group: string) => void
  onDeleteGroup: (group: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const q = query.trim()
  const ql = q.toLowerCase()
  const suggestions = availableGroups.filter(g => g !== selectedGroup && (!q || g.toLowerCase().includes(ql)))
  const openEditor = () => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0) }
  const closeEditor = () => { setEditing(false); setQuery('') }
  const choose = (g: string) => { onChange(g); closeEditor() }
  const confirmAdd = () => {
    if (!q) return
    const exact = availableGroups.find(g => g.toLowerCase() === ql)
    if (exact) choose(exact)
    else { onCreateGroup(q); onChange(q); closeEditor() }
  }
  const col = selectedGroup ? getTagColor(availableGroups.indexOf(selectedGroup)) : null
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedGroup && col && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium" style={{ background: col.bg, borderColor: col.border, color: col.text }}>
            {selectedGroup}
            <button type="button" onClick={() => onChange('')} className="opacity-50 transition hover:opacity-100">✕</button>
          </span>
        )}
        {!selectedGroup && !editing && (
          <button type="button" onClick={openEditor}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#c8c8c8] px-2.5 py-1 text-xs font-medium text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
            <Plus className="h-3 w-3" /> Grupo
          </button>
        )}
        {editing && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#48C9B0] bg-white py-0.5 pl-2.5 pr-1.5">
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmAdd() } if (e.key === 'Escape') closeEditor() }}
              placeholder="Nuevo grupo" className="w-24 bg-transparent text-xs text-[#1D1E20] outline-none placeholder:text-[#bbb]" />
            <button type="button" onClick={confirmAdd} disabled={!q} title="Agregar" className="text-[#48C9B0] transition disabled:opacity-30"><Check className="h-4 w-4" strokeWidth={3} /></button>
            <button type="button" onClick={closeEditor} title="Cancelar" className="text-[#bbb] transition hover:text-[#888]"><X className="h-4 w-4" /></button>
          </span>
        )}
      </div>
      {editing && suggestions.length > 0 && (
        <div className="mt-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#bbb]">Existentes</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map(g => {
              const c = getTagColor(availableGroups.indexOf(g))
              return (
                <span key={g} className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-xs" style={{ borderColor: c.border, color: c.text }}>
                  <button type="button" onClick={() => choose(g)} className="font-medium">{g}</button>
                  <button type="button" onClick={() => setConfirmDelete(g)} title="Eliminar del evento" className="text-[#ccc] transition hover:text-[#cc3333]"><Trash2 className="h-3 w-3" /></button>
                </span>
              )
            })}
          </div>
        </div>
      )}
      {confirmDelete && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-[#e8e8e8] bg-white p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[#1D1E20]">¿Eliminar el grupo &quot;{confirmDelete}&quot;?</h3>
            <p className="mt-1.5 text-xs text-[#666]">Se quitará de todos los invitados del evento. Esta acción no se puede deshacer.</p>
            <div className="mt-5 flex gap-2.5">
              <button type="button" onClick={() => setConfirmDelete(null)} className="flex-1 rounded-lg border border-[#e0e0e0] py-2.5 text-sm text-[#888] transition hover:bg-[#f8f8f8]">Cancelar</button>
              <button type="button" onClick={() => { onDeleteGroup(confirmDelete); setConfirmDelete(null) }} className="flex-1 rounded-lg bg-[#cc3333] py-2.5 text-sm font-semibold text-white transition hover:bg-[#b82e2e]">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: '#f8f8f8', border: '1px solid #e0e0e0',
  borderRadius: '8px', color: '#1D1E20',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box',
}

const WA_ICON = (
  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
)

const TRASH_ICON = (
  <>
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </>
)

type EditMember = { id?: string; name: string; phone: string; rsvp_status: RsvpStatus; allergies: string[]; tags: string[]; notes: string }
type GuestTableInfo = { tableNumber: number; tableName: string | null }

function normalizePhone(phone: string): string { return phone.replace(/\D/g, '') }

function TagInput({ availableTags, selectedTags, onChangeSelected, onCreateTag, onDeleteTag, label = 'Tag' }: {
  availableTags: string[]
  selectedTags: string[]
  onChangeSelected: (tags: string[]) => void
  onCreateTag: (tag: string) => void
  onDeleteTag: (tag: string) => void
  label?: string
}) {
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const q = query.trim()
  const ql = q.toLowerCase()
  const exactExists = availableTags.some(t => t.toLowerCase() === ql)
  const suggestions = availableTags.filter(t => !selectedTags.includes(t) && (!q || t.toLowerCase().includes(ql)))
  const openEditor = () => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0) }
  const closeEditor = () => { setEditing(false); setQuery('') }
  const remove = (tag: string) => onChangeSelected(selectedTags.filter(t => t !== tag))
  const assign = (tag: string) => { if (!selectedTags.includes(tag)) onChangeSelected([...selectedTags, tag]); setQuery('') }
  const confirmAdd = () => {
    if (!q) return
    const exact = availableTags.find(t => t.toLowerCase() === ql)
    if (exact) assign(exact)
    else { onCreateTag(q); onChangeSelected([...selectedTags, q]); setQuery('') }
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
                  <button type="button" onClick={() => setConfirmDelete(tag)} title="Eliminar del evento" className="text-[#ccc] transition hover:text-[#cc3333]"><Trash2 className="h-3 w-3" /></button>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-[#e8e8e8] bg-white p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[#1D1E20]">¿Eliminar &quot;{confirmDelete}&quot;?</h3>
            <p className="mt-1.5 text-xs text-[#666]">Se quitará de todos los invitados del evento. Esta acción no se puede deshacer.</p>
            <div className="mt-5 flex gap-2.5">
              <button type="button" onClick={() => setConfirmDelete(null)} className="flex-1 rounded-lg border border-[#e0e0e0] py-2.5 text-sm text-[#888] transition hover:bg-[#f8f8f8]">Cancelar</button>
              <button type="button" onClick={() => { onDeleteTag(confirmDelete); setConfirmDelete(null) }} className="flex-1 rounded-lg bg-[#cc3333] py-2.5 text-sm font-semibold text-white transition hover:bg-[#b82e2e]">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ALLERGY_OPTIONS = ['Gluten', 'Lácteos', 'Mariscos', 'Nueces', 'Huevo', 'Soya', 'Cerdo']

function MembersEditor({ value, onChange, allergyPool, onCreateAllergy, onDeleteAllergy }: {
  value: EditMember[]
  onChange: (v: EditMember[]) => void
  allergyPool: string[]
  onCreateAllergy: (t: string) => void
  onDeleteAllergy: (t: string) => void
}) {
  const MAX = 15
  const [open, setOpen] = useState(value.length > 0)
  const add = () => { if (value.length < MAX) { onChange([...value, { name: '', phone: '', rsvp_status: 'pending', allergies: [], tags: [], notes: '' }]); setOpen(true) } }
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const update = (i: number, field: 'name' | 'phone' | 'rsvp_status' | 'notes', val: string) => onChange(value.map((m, idx) => idx === i ? { ...m, [field]: val } : m))
  const updateAllergies = (i: number, val: string[]) => onChange(value.map((m, idx) => idx === i ? { ...m, allergies: val } : m))
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex flex-1 items-center gap-1.5 text-left">
          <ChevronDown size={14} className={'text-[#aaa] transition-transform ' + (open ? '' : '-rotate-90')} />
          <span className="text-xs font-medium text-[#555]">Acompañantes</span>
          {value.length > 0 && <span className="rounded-full bg-[#f0fdfb] px-1.5 py-0.5 text-[10px] font-semibold text-[#48C9B0]">{value.length}</span>}
        </button>
        {value.length < MAX && <button type="button" onClick={add} className="shrink-0 text-xs font-semibold text-[#48C9B0] hover:underline">+ Agregar</button>}
      </div>
      {open && (<>
      {value.length === 0 && <p className="mt-2 text-xs text-[#bbb]">Sin acompañantes — haz clic en "Agregar" para incluir uno.</p>}
      <div className="mt-2 flex flex-col gap-2">
        {value.map((m, i) => (
          <div key={i} className="rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] p-3">
            <div className="mb-2"><span className="text-[11px] font-semibold text-[#aaa]">+{i + 1}</span></div>
            <div className="flex flex-col gap-2">
              <input type="text" value={m.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Nombre (opcional)" style={{ ...inp, fontSize: '13px', padding: '8px 12px' }} />
              <input type="tel" value={m.phone} onChange={e => update(i, 'phone', e.target.value)} placeholder="WhatsApp (opcional)" style={{ ...inp, fontSize: '13px', padding: '8px 12px' }} />
              <select value={m.rsvp_status} onChange={e => update(i, 'rsvp_status', e.target.value as RsvpStatus)} style={{ ...inp, fontSize: '13px', padding: '8px 12px', cursor: 'pointer' }}>
                <option value="mensaje_enviado">Mensaje enviado</option>
                <option value="pending">Pendiente</option>
                <option value="respondio">Respondió</option>
                <option value="accion_necesaria">Acción necesaria</option>
                <option value="confirmed">Confirmado</option>
                <option value="declined">Declinado</option>
              </select>
              <div>
                <TagInput availableTags={allergyPool} selectedTags={m.allergies || []} onChangeSelected={(v) => updateAllergies(i, v)} onCreateTag={onCreateAllergy} onDeleteTag={onDeleteAllergy} label="Alergia" />
              </div>
              <input
                type="text"
                value={m.notes || ''}
                onChange={e => update(i, 'notes', e.target.value)}
                placeholder="Notas"
                style={{ ...inp, fontSize: '13px', padding: '8px 12px' }}
              />
              <button type="button" onClick={() => remove(i)} className="mt-1 w-full rounded-lg border border-[#ffe0e0] bg-[#fff5f5] py-1.5 text-xs font-semibold text-[#cc3333] transition hover:bg-[#ffe8e8]">Eliminar acompañante</button>
            </div>
          </div>
        ))}
      </div>
      </>)}
    </div>
  )
}

type CsvDuplicateResult = {
  hasDuplicates: boolean
  rows: Array<{ event_id: string; name: string; phone: string | null; email: string | null; party_size: number; rsvp_status: string; tags: string[]; notes: string | null; side: string | null; allergies: string[] | null; _companions: string[] }>
  duplicates: Array<{ row: number; name: string; phone: string; conflictWith: string }>
  newTags: string[]
  newGroups: string[]
  newAllergies: string[]
}

function SwipeableGuestCard({ guest, groupColor, isSelected, guestTags, availableTags, onSelect, onEdit, onDelete, onWaLongPressStart, onWaLongPressEnd, onWaTouchMove, onStatusChange }: {
  guest: Guest; groupColor: string | null; isSelected: boolean; guestTags: string[]; availableTags: string[]
  onSelect: () => void; onEdit: () => void; onDelete: () => void
  onWaLongPressStart: (g: Guest) => void; onWaLongPressEnd: (g: Guest) => void; onWaTouchMove: () => void; onStatusChange: (s: RsvpStatus) => void
}) {
  const x = useMotionValue(0)
  const bgOpacity = useTransform(x, [-80, -20, 0], [1, 0.5, 0])
  return (
    <div className={'relative overflow-hidden ' + (groupColor ? 'rounded-t-xl' : 'rounded-xl')}>
      <motion.div className="absolute inset-0 flex items-center justify-end bg-red-500 pr-5" style={{ opacity: bgOpacity }}>
        <Trash2 size={20} className="text-white" />
      </motion.div>
      <motion.div style={{ x }} drag="x" dragConstraints={{ left: -80, right: 0 }} dragElastic={{ left: 0.1, right: 0 }}
        onDragEnd={(_: unknown, info: PanInfo) => {
          if (info.offset.x < -60) onDelete()
          else animate(x, 0, { type: 'spring', stiffness: 500, damping: 35 })
        }}
        className={'relative z-10 rounded-xl border bg-white px-3 py-3 ' + (isSelected ? 'border-[#48C9B0] bg-[#f0fdfb]' : 'border-[#e8e8e8]') + (groupColor ? ' rounded-b-none border-b-0' : '')}>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={isSelected} onChange={onSelect} className="h-4 w-4 shrink-0 accent-[#48C9B0]" />
          {groupColor && <div className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: groupColor }} />}
          <div className="shrink-0">
            {guest.phone ? (
              <button onTouchStart={e => { e.stopPropagation(); onWaLongPressStart(guest) }} onTouchEnd={e => { e.stopPropagation(); onWaLongPressEnd(guest) }} onTouchMove={e => { e.stopPropagation(); onWaTouchMove() }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#c0f0dc] bg-[#f0fff8]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366">{WA_ICON}</svg>
              </button>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#f0f0f0] bg-[#fafafa]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#ddd">{WA_ICON}</svg>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1" onClick={onEdit}>
            <p className="truncate text-sm font-semibold text-[#1D1E20]">
              {guest.name}
              {guest.party_members.length > 0 && <span className="ml-1 text-xs font-normal" style={{ color: groupColor || '#aaa' }}>+{guest.party_members.length}</span>}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              {guest.needs_attention && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ background: 'var(--error-bg)', color: 'var(--error-text)', border: '1px solid var(--error-border)' }}
                  title={ATTENTION_LABEL[guest.attention_reason || 'otro']}
                >
                  <AlertTriangle size={12} />
                  {ATTENTION_LABEL[guest.attention_reason || 'otro']}
                </span>
              )}
              {guestTags.map(tag => {
                const tagIdx = availableTags.indexOf(tag)
                const col = getTagColor(tagIdx >= 0 ? tagIdx : 0)
                return <span key={tag} className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium" style={{ background: col.bg, borderColor: col.border, color: col.text }}>{tag}</span>
              })}
            </div>
          </div>
          <StatusDot value={guest.rsvp_status} onChange={onStatusChange} />
        </div>
      </motion.div>
    </div>
  )
}

// ── BulkMenuContent definido FUERA de EventPage para evitar recreación en cada render ──
type BulkMenuContentProps = {
  onClose: () => void
  onBulkUpdateStatus: (status: RsvpStatus) => void
  onBulkDelete: () => void
  onOpenCompanionModal: () => void
  hasGuests: boolean
}

function BulkMenuContent({ onClose, onBulkUpdateStatus, onBulkDelete, onOpenCompanionModal, hasGuests }: BulkMenuContentProps) {
  return (
    <>
      <p className="mb-1 px-3 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Marcar como</p>
      {STATUS_ORDER.map(key => {
        const s = STATUS_LABEL[key]
        return (
          <button key={key} onClick={() => onBulkUpdateStatus(key)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition hover:bg-[#f8f8f8] sm:py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border" style={{ background: s.bg, borderColor: s.border, color: s.color }}>{s.icon}</span>
            <span className="font-medium" style={{ color: s.color }}>{s.label}</span>
          </button>
        )
      })}
      {hasGuests && (<>
        <div className="my-1 mx-3 h-px bg-[#f0f0f0]" />
        <button onClick={() => { onClose(); onOpenCompanionModal() }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition hover:bg-[#f8f8f8] sm:py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#e8e8e8] bg-[#f8f8f8] text-[#555]"><UserPlus size={11} /></span>
          <span className="font-medium text-[#555]">Agregar acompañante</span>
        </button>
      </>)}
      <div className="my-1 mx-3 h-px bg-[#f0f0f0]" />
      <button onClick={onBulkDelete} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition hover:bg-[#fff0f0] sm:py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#ffc0c0] bg-[#fff0f0] text-[#cc3333]"><Trash2 size={11} /></span>
        <span className="font-medium text-[#cc3333]">Eliminar seleccionados</span>
      </button>
    </>
  )
}

type FilterField = 'tag' | 'allergy' | 'side' | 'rsvp_status' | 'table'
type FilterCondition = { field: FilterField; value: string }
const FILTER_LABEL: Record<FilterField, string> = { tag: 'Tag', allergy: 'Alergia', side: 'Grupo', rsvp_status: 'Estatus', table: 'Mesa' }

// Los modales de invitado son componentes con estado propio: teclear en sus
// campos no debe re-renderizar la pagina completa (la lista de invitados).
type GuestFormValues = { name: string; phone: string; email: string; notes: string; tags: string[]; side: string; allergies: string[]; members: EditMember[] }

type GuestModalShared = {
  availableTags: string[]
  groupPool: string[]
  allergyPool: string[]
  onCreateTag: (t: string) => void
  onDeleteTag: (t: string) => void
  onCreateGroup: (g: string) => void
  onDeleteGroup: (g: string) => void
  onCreateAllergy: (a: string) => void
  onDeleteAllergy: (a: string) => void
  onSubmit: (v: GuestFormValues) => Promise<string | null>
  onClose: () => void
}

function AddGuestModal({ availableTags, groupPool, allergyPool, onCreateTag, onDeleteTag, onCreateGroup, onDeleteGroup, onCreateAllergy, onDeleteAllergy, onSubmit, onClose }: GuestModalShared) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [members, setMembers] = useState<EditMember[]>([])
  const [side, setSide] = useState('')
  const [allergies, setAllergies] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Al borrar del pool, tambien quitar la seleccion local del formulario
  const handleDeleteTag = (t: string) => { setTags(prev => prev.filter(x => x !== t)); onDeleteTag(t) }
  const handleDeleteGroup = (g: string) => { setSide(prev => (prev === g ? '' : prev)); onDeleteGroup(g) }
  const handleDeleteAllergy = (a: string) => { setAllergies(prev => prev.filter(x => x !== a)); onDeleteAllergy(a) }

  const submit = async () => {
    setSaving(true); setFormError('')
    const err = await onSubmit({ name, phone, email, notes, tags, side, allergies, members })
    if (err) { setFormError(err); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white shadow-xl" style={{ maxHeight: '90vh' }}>
        <div className="flex shrink-0 items-center justify-between border-b border-[#f0f0f0] px-6 py-4 sm:px-8">
          <h2 className="text-lg font-bold text-[#1D1E20] sm:text-xl">Agregar invitado</h2>
          <button onClick={onClose} className="text-xl text-[#aaa]">✕</button>
        </div>
        <div className="grid grid-cols-1 gap-4 overflow-y-auto px-6 py-6 sm:grid-cols-2 sm:px-8">
          <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Nombre *</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ana García" style={inp} /></div>
          <div><label className="mb-1.5 block text-xs font-medium text-[#555]">WhatsApp <span className="font-normal text-[#ccc]">(opcional)</span></label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+52 81 1234 5678" style={inp} /></div>
          <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Email <span className="font-normal text-[#ccc]">(opcional)</span></label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ana@ejemplo.com" style={inp} /></div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#555]">Grupo <span className="font-normal text-[#ccc]">(opcional)</span></label>
            <GroupInput availableGroups={groupPool} selectedGroup={side} onChange={setSide} onCreateGroup={onCreateGroup} onDeleteGroup={handleDeleteGroup} />
          </div>
          <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Tags <span className="font-normal text-[#ccc]">(opcional)</span></label><TagInput availableTags={availableTags} selectedTags={tags} onChangeSelected={setTags} onCreateTag={onCreateTag} onDeleteTag={handleDeleteTag} /></div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#555]">Alergias <span className="font-normal text-[#ccc]">(opcional)</span></label>
            <TagInput availableTags={allergyPool} selectedTags={allergies} onChangeSelected={setAllergies} onCreateTag={onCreateAllergy} onDeleteTag={handleDeleteAllergy} label="Alergia" />
          </div>
          <div className="sm:col-span-2"><label className="mb-1.5 block text-xs font-medium text-[#555]">Notas <span className="font-normal text-[#ccc]">(opcional)</span></label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Mesa preferida, restricciones..." rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
          <div className="sm:col-span-2 border-t border-[#f0f0f0] pt-4"><MembersEditor value={members} onChange={setMembers} allergyPool={allergyPool} onCreateAllergy={onCreateAllergy} onDeleteAllergy={handleDeleteAllergy} /></div>
        </div>
        <div className="shrink-0 border-t border-[#f0f0f0] px-6 py-4 sm:px-8">
          {formError && <div className="mb-3 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] p-2.5 text-xs text-[#cc3333]">{formError}</div>}
          <div className="flex gap-2.5">
            <button onClick={onClose} className="flex-1 rounded-lg border border-[#e0e0e0] py-3 text-sm text-[#888]">Cancelar</button>
            <button onClick={submit} disabled={saving} className="flex-[2] rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Guardando...' : 'Agregar invitado'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditGuestModal({ guest, availableTags, groupPool, allergyPool, onCreateTag, onDeleteTag, onCreateGroup, onDeleteGroup, onCreateAllergy, onDeleteAllergy, onSubmit, onClose, onDelete, onResolveAttention }: GuestModalShared & {
  guest: Guest
  onDelete: () => void
  onResolveAttention: () => void
}) {
  const [name, setName] = useState(guest.name)
  const [phone, setPhone] = useState(guest.phone || '')
  const [email, setEmail] = useState(guest.email || '')
  const [notes, setNotes] = useState(guest.notes || '')
  const [tags, setTags] = useState<string[]>(guest.tags || [])
  const [side, setSide] = useState(guest.side || '')
  const [allergies, setAllergies] = useState<string[]>(guest.allergies || [])
  const [members, setMembers] = useState<EditMember[]>(guest.party_members.map(m => ({ id: m.id, name: m.name, phone: m.phone || '', rsvp_status: m.rsvp_status, allergies: m.allergies || [], tags: m.tags || [], notes: m.notes || '' })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Al borrar del pool, tambien quitar la seleccion local del formulario
  const handleDeleteTag = (t: string) => { setTags(prev => prev.filter(x => x !== t)); onDeleteTag(t) }
  const handleDeleteGroup = (g: string) => { setSide(prev => (prev === g ? '' : prev)); onDeleteGroup(g) }
  const handleDeleteAllergy = (a: string) => { setAllergies(prev => prev.filter(x => x !== a)); onDeleteAllergy(a) }

  const submit = async () => {
    setSaving(true); setError('')
    const err = await onSubmit({ name, phone, email, notes, tags, side, allergies, members })
    if (err) { setError(err); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white shadow-xl" style={{ maxHeight: '90vh' }}>
        <div className="flex shrink-0 items-center justify-between border-b border-[#f0f0f0] px-6 py-4 sm:px-8">
          <h2 className="text-lg font-bold text-[#1D1E20] sm:text-xl">Editar invitado</h2>
          <button onClick={onClose} className="text-xl text-[#aaa]">✕</button>
        </div>
        <div className="overflow-y-auto px-6 py-6 sm:px-8">
        {guest.needs_attention && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border p-3" style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)' }}>
            <AlertTriangle size={14} style={{ color: 'var(--error-text)', flexShrink: 0 }} />
            <span className="flex-1 text-xs" style={{ color: 'var(--error-text)' }}>
              {ATTENTION_LABEL[guest.attention_reason || 'otro']}
            </span>
            <button onClick={onResolveAttention} className="text-xs font-semibold" style={{ color: '#48C9B0' }}>
              Marcar atención como resuelta
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Nombre *</label><input type="text" value={name} onChange={e => setName(e.target.value)} style={inp} /></div>
          <div><label className="mb-1.5 block text-xs font-medium text-[#555]">WhatsApp</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+52 81 1234 5678" style={inp} /></div>
          <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ana@ejemplo.com" style={inp} /></div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#555]">Grupo <span className="font-normal text-[#ccc]">(opcional)</span></label>
            <GroupInput availableGroups={groupPool} selectedGroup={side} onChange={setSide} onCreateGroup={onCreateGroup} onDeleteGroup={handleDeleteGroup} />
          </div>
          <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Tags</label><TagInput availableTags={availableTags} selectedTags={tags} onChangeSelected={setTags} onCreateTag={onCreateTag} onDeleteTag={handleDeleteTag} /></div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#555]">Alergias <span className="font-normal text-[#ccc]">(opcional)</span></label>
            <TagInput availableTags={allergyPool} selectedTags={allergies} onChangeSelected={setAllergies} onCreateTag={onCreateAllergy} onDeleteTag={handleDeleteAllergy} label="Alergia" />
          </div>
          <div className="sm:col-span-2"><label className="mb-1.5 block text-xs font-medium text-[#555]">Notas</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Mesa preferida, restricciones..." rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
          <div className="sm:col-span-2 border-t border-[#f0f0f0] pt-4"><MembersEditor value={members} onChange={setMembers} allergyPool={allergyPool} onCreateAllergy={onCreateAllergy} onDeleteAllergy={handleDeleteAllergy} /></div>
        </div>
        <button onClick={onDelete}
          className="mt-4 w-full rounded-lg border border-[#ffe0e0] bg-[#fff5f5] py-3 text-sm font-semibold text-[#cc3333] transition hover:bg-[#ffe8e8] sm:hidden">
          Eliminar invitado
        </button>
        </div>
        <div className="shrink-0 border-t border-[#f0f0f0] px-6 py-4 sm:px-8">
          {error && <div className="mb-3 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] p-2.5 text-xs text-[#cc3333]">{error}</div>}
          <div className="flex gap-2.5">
            <button onClick={onClose} className="flex-1 rounded-lg border border-[#e0e0e0] py-3 text-sm text-[#888]">Cancelar</button>
            <button onClick={submit} disabled={saving} className="flex-[2] rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function EventPage() {
  const { id } = useParams()

  const { visible: statsVisible, toggle: toggleStats } = useStatsToggle(id as string, 'guests')

  const [event, setEvent] = useState<Event | null>(null)
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null)
  const [plannerName, setPlannerName] = useState('')
  const [waTarget, setWaTarget] = useState<'web' | 'app'>('web')
  const [guests, setGuests] = useState<Guest[]>([])
  const [groupPool, setGroupPool] = useState<string[]>([])
  const [allergyPool, setAllergyPool] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState<'all' | RsvpStatus>('all')
  const [filters, setFilters] = useState<FilterCondition[]>([])
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const filterMenuRef = useRef<HTMLDivElement>(null)
  const [guestTableMap, setGuestTableMap] = useState<Map<string, GuestTableInfo>>(new Map())

  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(() => loadSavedColumns())
  const [showColMenu, setShowColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  const [showModal, setShowModal] = useState(false)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [csvError, setCsvError] = useState('')
  const [csvSuccess, setCsvSuccess] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvPreview, setCsvPreview] = useState<CsvDuplicateResult | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)

  const [editGuest, setEditGuest] = useState<Guest | null>(null)
  const [deleteChatModal, setDeleteChatModal] = useState<{ guestId: string; conversationIds: string[] } | null>(null)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [showBulkMenu, setShowBulkMenu] = useState(false)
  const [showMobileBulkSheet, setShowMobileBulkSheet] = useState(false)
  const bulkMenuRef = useRef<HTMLDivElement>(null)
  const lastCheckedIdx = useRef<number | null>(null)

  const [showBulkCompanionModal, setShowBulkCompanionModal] = useState(false)
  const [bulkCompanionCount, setBulkCompanionCount] = useState(1)
  const [bulkCompanionSaving, setBulkCompanionSaving] = useState(false)

  const [showWaMenu, setShowWaMenu] = useState<string | null>(null)
  const waMenuRef = useRef<HTMLDivElement>(null)
  const [showWaSheet, setShowWaSheet] = useState<Guest | null>(null)
  const waLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const waWindowRef = useRef<Window | null>(null)

  const [sortField, setSortField] = useState<'name' | 'phone' | 'notes' | 'status' | null>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    // Complemento exacto del breakpoint sm de Tailwind: evita anchos fraccionales sin lista
    const mq = window.matchMedia('(min-width: 640px)')
    const update = () => setIsMobile(!mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await Promise.all([loadEvent(), loadGuests()])
      }
    }
    init()
    try { const v = localStorage.getItem('anfiora_wa_target'); if (v === 'app' || v === 'web') setWaTarget(v) } catch {}
  }, [])

  const setWaTargetPref = (t: 'web' | 'app') => { setWaTarget(t); try { localStorage.setItem('anfiora_wa_target', t) } catch {} }

  const addFilter = (field: FilterField, value: string) => setFilters(prev => prev.some(f => f.field === field && f.value === value) ? prev : [...prev, { field, value }])
  const removeFilter = (field: FilterField, value: string) => setFilters(prev => prev.filter(f => !(f.field === field && f.value === value)))
  const clearFilters = () => setFilters([])

  const filtered = useMemo(() => {
    let result = guests
    for (const f of filters) {
      result = result.filter(g => {
        switch (f.field) {
          case 'tag':         return (g.tags || []).includes(f.value)
          case 'allergy':     return (g.allergies || []).includes(f.value)
          case 'side':        return g.side === f.value
          case 'rsvp_status': return g.rsvp_status === f.value || g.party_members.some(m => m.rsvp_status === f.value)
          case 'table':       { const tb = guestTableMap.get(g.id); return !!tb && `Mesa ${tb.tableNumber}` === f.value }
          default:            return true
        }
      })
    }
    if (filter !== 'all') result = result.filter(g => g.rsvp_status === filter || g.party_members.some(m => m.rsvp_status === filter))
    if (debouncedSearch) result = result.filter(g => g.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    if (sortField) {
      result = [...result].sort((a, b) => {
        let aVal: any = '', bVal: any = ''
        switch (sortField) {
          case 'name':   aVal = a.name.toLowerCase();         bVal = b.name.toLowerCase();         break
          case 'phone':  aVal = a.phone?.toLowerCase() || ''; bVal = b.phone?.toLowerCase() || ''; break
          case 'notes':  aVal = a.notes?.toLowerCase() || ''; bVal = b.notes?.toLowerCase() || ''; break
          case 'status': aVal = a.rsvp_status;                bVal = b.rsvp_status;                break
        }
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }
    return result
  }, [guests, filters, filter, debouncedSearch, sortField, sortDirection, guestTableMap])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node)) setShowBulkMenu(false)
      if (waMenuRef.current && !waMenuRef.current.contains(e.target as Node)) setShowWaMenu(null)
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false)
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setShowFilterMenu(false)
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setShowExportMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggleCol = (key: ColumnKey) => {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (key === 'estatus' && next.has(key)) return prev
      next.has(key) ? next.delete(key) : next.add(key)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

  const handleWaLongPressStart = (guest: Guest) => { waLongPressTimer.current = setTimeout(() => { waLongPressTimer.current = null; setShowWaSheet(guest) }, 400) }
  const handleWaLongPressEnd = (guest: Guest) => { if (waLongPressTimer.current) { clearTimeout(waLongPressTimer.current); waLongPressTimer.current = null; openWhatsApp(guest.phone!) } }
  const handleWaTouchMove = () => { if (waLongPressTimer.current) { clearTimeout(waLongPressTimer.current); waLongPressTimer.current = null } }

  const loadEvent = async () => {
    const [{ data }, { data: settings }] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase.from('event_settings').select('*').eq('event_id', id).single(),
    ])
    if (data) {
      setEvent(data)
      if (data.user_id) {
        const { data: planner } = await supabase.from('users').select('full_name').eq('id', data.user_id).single()
        if (planner?.full_name) setPlannerName(planner.full_name)
      }
    }
    if (settings) setEventSettings(settings)
  }

  const loadGuests = async () => {
    const PAGE = 1000
    const fetchAll = async <T,>(
      build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
    ): Promise<T[]> => {
      const out: T[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await build(from, from + PAGE - 1)
        if (error) { console.error('loadGuests:', error); break }
        if (!data || data.length === 0) break
        out.push(...data)
        if (data.length < PAGE) break
      }
      return out
    }

    const [guestsData, membersData, seatsData, tablesData] = await Promise.all([
      fetchAll<Guest>((f, t) =>
        supabase.from('guests').select('*').eq('event_id', id).order('name').order('id').range(f, t)),
      fetchAll<PartyMember>((f, t) =>
        supabase.from('party_members').select('*').eq('event_id', id).order('created_at').order('id').range(f, t)),
      fetchAll<{ guest_id: string; table_id: string }>((f, t) =>
        supabase.from('table_seats').select('guest_id, table_id').eq('event_id', id).order('id').range(f, t)),
      supabase.from('tables').select('id, number, name').eq('event_id', id).then(r => r.data || []),
    ])

    const membersByGuest = new Map<string, PartyMember[]>()
    for (const m of membersData) {
      const arr = membersByGuest.get(m.guest_id)
      if (arr) arr.push(m)
      else membersByGuest.set(m.guest_id, [m])
    }

    const tableById = new Map((tablesData || []).map(t => [t.id, t]))
    const seatMap = new Map<string, GuestTableInfo>()
    for (const seat of seatsData) {
      if (!seat.guest_id) continue
      const table = tableById.get(seat.table_id)
      if (table) seatMap.set(seat.guest_id, { tableNumber: table.number, tableName: table.name })
    }

    setGuestTableMap(seatMap)
    setGuests(guestsData.map(g => ({ ...g, tags: g.tags || [], party_members: membersByGuest.get(g.id) || [] })))
    setGroupPool(Array.from(new Set(guestsData.map(g => g.side).filter((s): s is string => !!s))))
    setAllergyPool(Array.from(new Set([...ALLERGY_OPTIONS, ...guestsData.flatMap(g => g.allergies || []), ...membersData.flatMap(m => m.allergies || [])])))
    setLoading(false)
  }

  const updateStatus = async (guestId: string, status: RsvpStatus) => {
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, rsvp_status: status } : g))
    await supabase.from('guests').update({ rsvp_status: status }).eq('id', guestId)
  }

  const updatePartyMemberStatus = async (memberId: string, guestId: string, status: RsvpStatus) => {
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, party_members: g.party_members.map(m => m.id === memberId ? { ...m, rsvp_status: status } : m) } : g))
    await supabase.from('party_members').update({ rsvp_status: status }).eq('id', memberId)
  }

  const resolveAttention = async (guestId: string) => {
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, needs_attention: false, attention_reason: null } : g))
    setEditGuest(prev => prev ? { ...prev, needs_attention: false, attention_reason: null } : null)
    await supabase.from('guests').update({ needs_attention: false, attention_reason: null }).eq('id', guestId)
  }

  const performDeleteGuest = async (guestId: string, conversationIds: string[], mode: 'unlink' | 'purge') => {
    const ops = buildGuestDeletionOps(guestId, conversationIds, mode)
    const { ok, error } = await executeGuestDeletion(supabase, ops)
    if (!ok) {
      alert('No se pudo eliminar el invitado. Intenta de nuevo.' + (error ? ' (' + error + ')' : ''))
      return
    }
    await supabase.rpc('decrement_guests', { event_id_input: id })
    setGuests(prev => prev.filter(g => g.id !== guestId))
    setEvent(prev => prev ? { ...prev, total_guests: Math.max(0, prev.total_guests - 1) } : prev)
    setSelected(prev => { const n = new Set(prev); n.delete(guestId); return n })
  }

  const deleteGuest = async (guestId: string) => {
    const conversationIds = await guestConversationIds(supabase, guestId)
    let hasChat = false
    if (conversationIds.length > 0) {
      const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).in('conversation_id', conversationIds)
      hasChat = (count ?? 0) > 0
    }
    if (hasChat) {
      setDeleteChatModal({ guestId, conversationIds })
      return
    }
    if (!confirm('¿Eliminar este invitado?')) return
    await performDeleteGuest(guestId, conversationIds, 'unlink')
  }

  const deletePartyMember = async (memberId: string, guestId: string) => {
    if (!confirm('¿Eliminar este acompañante?')) return
    await supabase.from('party_members').delete().eq('id', memberId)
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, party_size: g.party_size - 1, party_members: g.party_members.filter(m => m.id !== memberId) } : g))
  }

  const openEdit = (guest: Guest) => setEditGuest(guest)

  const handleHeaderClick = (field: 'name' | 'phone' | 'notes' | 'status') => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('asc') }
  }

  const getSortIndicator = (field: 'name' | 'phone' | 'notes' | 'status') => {
    if (sortField !== field) return ''
    return sortDirection === 'asc' ? ' ▲' : ' ▼'
  }

  const submitEditGuest = async (guest: Guest, f: GuestFormValues): Promise<string | null> => {
    if (!f.name) return 'El nombre es obligatorio'
    if (f.phone) {
      const normalizedEdit = normalizePhone(f.phone)
      if (normalizedEdit.length > 0) {
        const duplicate = guests.find(g => g.id !== guest.id && g.phone && normalizePhone(g.phone) === normalizedEdit)
        if (duplicate) return `Este WhatsApp ya está registrado para "${duplicate.name}"`
      }
    }
    const { error } = await supabase.from('guests').update({ name: f.name, phone: f.phone || null, email: f.email || null, party_size: 1 + f.members.length, notes: f.notes || null, tags: f.tags, side: f.side || null, allergies: f.allergies.length > 0 ? f.allergies : null }).eq('id', guest.id)
    if (error) return 'Error: ' + error.message
    const existingIds = guest.party_members.map(m => m.id)
    const keepIds = f.members.filter(m => m.id).map(m => m.id as string)
    const toDelete = existingIds.filter(id => !keepIds.includes(id))
    if (toDelete.length > 0) await supabase.from('party_members').delete().in('id', toDelete)
    for (const m of f.members.filter(m => m.id)) await supabase.from('party_members').update({ name: m.name, phone: m.phone || null, rsvp_status: m.rsvp_status, allergies: m.allergies.length ? m.allergies : null, tags: m.tags.length ? m.tags : null, notes: m.notes || null }).eq('id', m.id!)
    const toInsert = f.members.filter(m => !m.id)
    if (toInsert.length > 0) await supabase.from('party_members').insert(toInsert.map(m => ({ guest_id: guest.id, event_id: id as string, name: m.name, phone: m.phone || null, rsvp_status: m.rsvp_status, allergies: m.allergies.length ? m.allergies : null, tags: m.tags.length ? m.tags : null, notes: m.notes || null })))
    await loadGuests(); setEditGuest(null)
    return null
  }

  const toggleSelect = (guestId: string, idx: number, shiftKey: boolean) => {
    const adding = !selected.has(guestId)
    const affected = (shiftKey && lastCheckedIdx.current !== null)
      ? filtered.slice(Math.min(lastCheckedIdx.current, idx), Math.max(lastCheckedIdx.current, idx) + 1)
      : filtered.filter(g => g.id === guestId)
    setSelected(prev => {
      const next = new Set(prev)
      affected.forEach(g => adding ? next.add(g.id) : next.delete(g.id))
      return next
    })
    setSelectedMembers(prev => {
      const next = new Set(prev)
      affected.forEach(g => g.party_members.forEach(m => adding ? next.add(m.id) : next.delete(m.id)))
      return next
    })
    lastCheckedIdx.current = idx
  }

  const toggleSelectMember = (memberId: string) => {
    setSelectedMembers(prev => { const next = new Set(prev); next.has(memberId) ? next.delete(memberId) : next.add(memberId); return next })
  }

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set()); setSelectedMembers(new Set())
    } else {
      setSelected(new Set(filtered.map(g => g.id)))
      setSelectedMembers(new Set(filtered.flatMap(g => g.party_members.map(m => m.id))))
    }
    lastCheckedIdx.current = null
  }

  const bulkUpdateStatus = async (status: RsvpStatus) => {
    const ids = Array.from(selected)
    const memberIds = Array.from(selectedMembers)
    if (ids.length > 0) await supabase.from('guests').update({ rsvp_status: status }).in('id', ids)
    for (let i = 0; i < memberIds.length; i += 200) await supabase.from('party_members').update({ rsvp_status: status }).in('id', memberIds.slice(i, i + 200))
    setGuests(prev => prev.map(g => {
      const ng = selected.has(g.id) ? { ...g, rsvp_status: status } : g
      return g.party_members.some(m => selectedMembers.has(m.id))
        ? { ...ng, party_members: ng.party_members.map(m => selectedMembers.has(m.id) ? { ...m, rsvp_status: status } : m) }
        : ng
    }))
    setSelected(new Set()); setSelectedMembers(new Set()); setShowBulkMenu(false); setShowMobileBulkSheet(false)
  }

  const bulkDelete = async () => {
    const guestIds = Array.from(selected)
    const deletedGuestSet = new Set(guestIds)
    const looseMemberIds = Array.from(selectedMembers).filter(mid => { const g = guests.find(gg => gg.party_members.some(m => m.id === mid)); return g && !deletedGuestSet.has(g.id) })
    if (guestIds.length + looseMemberIds.length === 0) return
    let conChat = 0
    for (const gid of guestIds) { if ((await guestConversationIds(supabase, gid)).length > 0) conChat++ }
    const chatNota = conChat > 0 ? ' (' + conChat + ' con conversación; sus chats se conservarán sin invitado)' : ''
    if (!confirm('¿Eliminar ' + guestIds.length + ' invitado(s)' + (guestIds.length ? ' con sus acompañantes' : '') + (looseMemberIds.length ? ' y ' + looseMemberIds.length + ' acompañante(s) más' : '') + chatNota + '?')) return
    let anyFailed = false
    for (const gid of guestIds) {
      const convIds = await guestConversationIds(supabase, gid)
      const ops = buildGuestDeletionOps(gid, convIds, 'unlink')
      const { ok } = await executeGuestDeletion(supabase, ops)
      if (!ok) { anyFailed = true; deletedGuestSet.delete(gid) }
    }
    const okGuestCount = guestIds.filter(g => deletedGuestSet.has(g)).length
    if (okGuestCount > 0) await supabase.rpc('increment_guests_by', { event_id_input: id, amount: -okGuestCount })
    const looseArr = Array.from(new Set(looseMemberIds))
    for (let i = 0; i < looseArr.length; i += 200) await supabase.from('party_members').delete().in('id', looseArr.slice(i, i + 200))
    if (anyFailed) alert('Algunos invitados no se pudieron eliminar y se conservaron en la lista.')
    const looseSet = new Set(looseArr)
    setGuests(prev => prev.filter(g => !deletedGuestSet.has(g.id)).map(g => {
      const removing = g.party_members.filter(m => looseSet.has(m.id))
      return removing.length === 0 ? g : { ...g, party_size: Math.max(1, g.party_size - removing.length), party_members: g.party_members.filter(m => !looseSet.has(m.id)) }
    }))
    setEvent(prev => prev ? { ...prev, total_guests: Math.max(0, prev.total_guests - okGuestCount) } : prev)
    setSelected(new Set()); setSelectedMembers(new Set()); setShowBulkMenu(false); setShowMobileBulkSheet(false)
  }

  const bulkAddCompanions = async () => {
    if (bulkCompanionCount < 1) return
    setBulkCompanionSaving(true)
    const ids = Array.from(selected)
    const rows: { guest_id: string; event_id: string; name: string; phone: null; rsvp_status: string }[] = []
    const sizeUpdates: { id: string; party_size: number }[] = []
    for (const guestId of ids) {
      const guest = guests.find(g => g.id === guestId); if (!guest) continue
      const canAdd = Math.max(0, 15 - guest.party_members.length)
      const toAdd = Math.min(bulkCompanionCount, canAdd)
      if (toAdd <= 0) continue
      for (let i = 0; i < toAdd; i++) rows.push({ guest_id: guestId, event_id: id as string, name: '', phone: null, rsvp_status: 'pending' })
      sizeUpdates.push({ id: guestId, party_size: guest.party_size + toAdd })
    }
    if (rows.length === 0) { setBulkCompanionSaving(false); setShowBulkCompanionModal(false); return }
    const CHUNK = 500
    for (let i = 0; i < rows.length; i += CHUNK) await supabase.from('party_members').insert(rows.slice(i, i + CHUNK))
    const UCHUNK = 50
    for (let i = 0; i < sizeUpdates.length; i += UCHUNK) {
      await Promise.all(sizeUpdates.slice(i, i + UCHUNK).map(u => supabase.from('guests').update({ party_size: u.party_size }).eq('id', u.id)))
    }
    await loadGuests()
    setBulkCompanionSaving(false); setShowBulkCompanionModal(false)
    setBulkCompanionCount(1); setSelected(new Set()); setSelectedMembers(new Set()); setShowBulkMenu(false); setShowMobileBulkSheet(false)
  }

  const buildWaText = (guest: Guest, templateIndex = 0) => {
    const playlistUrl = eventSettings?.playlist_token ? window.location.origin + '/playlist/' + eventSettings.playlist_token : ''
    const hostName = event?.host_name || ''
    const repl: Record<string, string> = {
      '{nombre}':    guest.name,
      '{planner}':   plannerName,
      '{evento}':    event?.name || '',
      '{fecha}':     event?.event_date ? new Date(event.event_date).toLocaleDateString('es-MX') : '',
      '{hora}':      event?.event_time || '',
      '{venue}':     event?.venue || '',
      '{direccion}': event?.address || '',
      '{playlist}':  playlistUrl,
      '{album}':     eventSettings?.album_url || '',
      '{novia}':     hostName,
      '{novio}':     event?.host_name_2 || '',
      '{festejada}': hostName,
      '{festejado}': hostName,
      '{graduado}':  hostName,
      '{bautizado}': hostName,
      '{anfitrion}': hostName,
      '{empresa}':   event?.organization || '',
    }
    const templates = eventSettings?.message_templates as string[] | null
    let text = templates?.[templateIndex] || 'Hola {nombre}, te escribimos de parte de {evento}.'
    for (const [token, value] of Object.entries(repl)) text = text.split(token).join(value)
    return encodeURIComponent(text)
  }

  // Abre WhatsApp reusando una sola pestana en desktop (web.whatsapp.com/send, sin la pagina
  // intermedia de wa.me). En mobile abre la app con wa.me. encodedText ya viene de buildWaText.
  const openWhatsApp = (phone: string, encodedText?: string) => {
    const num = (phone || '').replace(/\D/g, '')
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    if (isMobile) {
      window.open('https://wa.me/' + num + (encodedText ? '?text=' + encodedText : ''), '_blank')
      return
    }
    if (waTarget === 'app') {
      // App de escritorio (instancia unica): el protocolo whatsapp:// la abre sin pestanas de navegador
      window.location.href = 'whatsapp://send?phone=' + num + (encodedText ? '&text=' + encodedText : '')
    } else {
      // WhatsApp Web: reusa la misma pestana via referencia directa (el nombre de ventana
      // no sirve porque WhatsApp Web lo borra al cargar). Si sigue abierta, la re-navega.
      const url = 'https://web.whatsapp.com/send?phone=' + num + (encodedText ? '&text=' + encodedText : '')
      try {
        if (waWindowRef.current && !waWindowRef.current.closed) {
          waWindowRef.current.location.href = url
          waWindowRef.current.focus()
          return
        }
      } catch {}
      waWindowRef.current = window.open(url, 'anfiora_whatsapp')
    }
  }

  const submitAddGuest = async (f: GuestFormValues): Promise<string | null> => {
    if (!f.name) return 'El nombre es obligatorio'
    if (f.phone) {
      const normalizedNew = normalizePhone(f.phone)
      if (normalizedNew.length > 0) {
        const duplicate = guests.find(g => g.phone && normalizePhone(g.phone) === normalizedNew)
        if (duplicate) return `Este WhatsApp ya está registrado para "${duplicate.name}"`
      }
    }
    const { data: guestData, error } = await supabase.from('guests').insert({ event_id: id, name: f.name, phone: f.phone || null, email: f.email || null, party_size: 1 + f.members.length, notes: f.notes || null, tags: f.tags, rsvp_status: 'pending', side: f.side || null, allergies: f.allergies.length > 0 ? f.allergies : null }).select().single()
    if (error || !guestData) return 'Error: ' + error?.message
    if (f.members.length > 0) await supabase.from('party_members').insert(f.members.map(m => ({ guest_id: guestData.id, event_id: id, name: m.name, phone: m.phone || null, rsvp_status: m.rsvp_status, allergies: m.allergies.length ? m.allergies : null, tags: m.tags.length ? m.tags : null, notes: m.notes || null })))
    await supabase.rpc('increment_guests', { event_id_input: id })
    setEvent(prev => prev ? { ...prev, total_guests: prev.total_guests + 1 } : prev)
    await loadGuests(); setShowModal(false)
    return null
  }

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setCsvError(''); setCsvSuccess(''); setCsvPreview(null)
    const parseCSV = (text: string) => {
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { setCsvError('El archivo está vacío'); return }
      const sep = lines[0].includes(';') ? ';' : ','
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, '').replace(/\r/g, ''))
      const nameIdx   = headers.findIndex(h => h.includes('nombre') || h.includes('name'))
      const phoneIdx  = headers.findIndex(h => h.includes('tel') || h.includes('phone') || h.includes('whatsapp') || h.includes('celular'))
      const emailIdx  = headers.findIndex(h => h.includes('email') || h.includes('correo'))
      const notesIdx  = headers.findIndex(h => h.includes('nota') || h.includes('note'))
      const tagsIdx   = headers.findIndex(h => h.includes('tag') || h.includes('etiqueta'))
      const statusIdx = headers.findIndex(h => h.includes('status') || h.includes('estado') || h.includes('rsvp'))
      const plusIdx   = headers.findIndex(h => h.includes('plus'))
      const compIdx   = headers.findIndex(h => h.includes('acomp') || h.includes('companion'))
      const grupoIdx  = headers.findIndex(h => h.includes('grupo') || h.includes('lado') || h === 'side')
      const alergIdx  = headers.findIndex(h => h.includes('alerg') || h.includes('allerg'))
      if (nameIdx === -1) { setCsvError('No se encontró columna "nombre"'); return }
      const eventTags = event?.guest_tags || []
      const rows = lines.slice(1).map(line => {
        const cols = line.split(sep).map(c => c.trim().replace(/"/g, '').replace(/\r/g, ''))
        const rawStatus = statusIdx >= 0 ? cols[statusIdx]?.toLowerCase() || '' : ''
        const rsvpStatus = rawStatus.includes('conf') ? 'confirmed' : rawStatus.includes('decl') || rawStatus.includes('no') ? 'declined' : 'pending'
        const rawTags = tagsIdx >= 0 ? cols[tagsIdx] || '' : ''
        const parsedTags = rawTags ? rawTags.split(/[,|]/).map((t: string) => t.trim()).filter(Boolean) : []
        const plusOnes = plusIdx >= 0 ? parseInt(cols[plusIdx] || '0', 10) || 0 : 0
        const compRaw = compIdx >= 0 ? cols[compIdx] || '' : ''
        const compNames = compRaw ? compRaw.split(/[,|]/).map((s: string) => s.trim()).filter(Boolean) : []
        const _companions = compNames.length > 0 ? compNames : Array(plusOnes).fill('')
        const sideVal = grupoIdx >= 0 ? (cols[grupoIdx] || '').trim() || null : null
        const alergRaw = alergIdx >= 0 ? cols[alergIdx] || '' : ''
        const alergArr = alergRaw ? alergRaw.split(/[|]/).map((s: string) => s.trim()).filter(Boolean) : []
        return { event_id: id as string, name: cols[nameIdx] || '', phone: phoneIdx >= 0 ? cols[phoneIdx] || null : null, email: emailIdx >= 0 ? cols[emailIdx] || null : null, party_size: 1 + _companions.length, rsvp_status: rsvpStatus, tags: parsedTags, notes: notesIdx >= 0 ? cols[notesIdx] || null : null, side: sideVal, allergies: alergArr.length > 0 ? alergArr : null, _companions }
      }).filter(r => r.name)
      if (!rows.length) { setCsvError('No se encontraron invitados válidos'); return }
      const duplicates: CsvDuplicateResult['duplicates'] = []
      const seenInFile = new Map<string, string>()
      rows.forEach((row, idx) => {
        if (!row.phone) return
        const norm = normalizePhone(row.phone); if (!norm) return
        const existingGuest = guests.find(g => g.phone && normalizePhone(g.phone) === norm)
        if (existingGuest) { duplicates.push({ row: idx + 2, name: row.name, phone: row.phone, conflictWith: existingGuest.name + ' (ya registrado)' }); return }
        if (seenInFile.has(norm)) { duplicates.push({ row: idx + 2, name: row.name, phone: row.phone, conflictWith: seenInFile.get(norm)! + ' (misma importación)' }); return }
        seenInFile.set(norm, row.name)
      })
      const newTags = Array.from(new Set(rows.flatMap(r => r.tags))).filter(t => !eventTags.includes(t))
      const newGroups = Array.from(new Set(rows.map(r => r.side).filter((s): s is string => !!s))).filter(s => !groupPool.includes(s))
      const newAllergies = Array.from(new Set(rows.flatMap(r => r.allergies || []))).filter(a => !allergyPool.includes(a))
      setCsvPreview({ hasDuplicates: duplicates.length > 0, rows, duplicates, newTags, newGroups, newAllergies })
      if (fileRef.current) fileRef.current.value = ''
    }
    const readerUtf8 = new FileReader()
    readerUtf8.onload = (evt) => {
      const text = evt.target?.result as string
      if (!text) { setCsvError('No se pudo leer el archivo'); return }
      if (text.includes('?') || text.includes('\uFFFD')) {
        const readerLatin = new FileReader()
        readerLatin.onload = (evt2) => { const text2 = evt2.target?.result as string; if (text2) parseCSV(text2) }
        readerLatin.readAsText(file, 'windows-1252')
      } else { parseCSV(text) }
    }
    readerUtf8.readAsText(file, 'UTF-8')
  }

  const confirmCsvImport = async (skipDuplicates: boolean) => {
    if (!csvPreview) return
    setCsvImporting(true); setCsvError('')
    let rowsToImport = csvPreview.rows
    if (skipDuplicates) {
      const duplicateKeys = new Set(csvPreview.duplicates.map(d => d.name + '|' + d.phone))
      rowsToImport = csvPreview.rows.filter(r => !duplicateKeys.has(r.name + '|' + r.phone))
    }
    if (!rowsToImport.length) { setCsvError('No quedan invitados para importar'); setCsvImporting(false); setCsvPreview(null); return }
    const guestPayload = rowsToImport.map(r => ({ event_id: r.event_id, name: r.name, phone: r.phone, email: r.email, party_size: r.party_size, rsvp_status: r.rsvp_status, tags: r.tags, notes: r.notes, side: r.side, allergies: r.allergies }))
    const { data: insertedGuests, error } = await supabase.from('guests').insert(guestPayload).select('id')
    if (error) { setCsvError('Error al importar: ' + error.message); setCsvImporting(false); return }
    const memberRows = (insertedGuests || []).flatMap((g, i) => rowsToImport[i]._companions.map(name => ({ guest_id: g.id, event_id: id as string, name: name || '', phone: null, rsvp_status: 'pending' })))
    for (let i = 0; i < memberRows.length; i += 500) await supabase.from('party_members').insert(memberRows.slice(i, i + 500))
    await supabase.rpc('increment_guests_by', { event_id_input: id, amount: rowsToImport.length })
    const curEventTags = event?.guest_tags || []
    const newTagsToAdd = Array.from(new Set(rowsToImport.flatMap(r => r.tags))).filter(t => !curEventTags.includes(t))
    if (newTagsToAdd.length) {
      const merged = [...curEventTags, ...newTagsToAdd]
      await supabase.from('events').update({ guest_tags: merged }).eq('id', id)
      setEvent(prev => prev ? { ...prev, total_guests: prev.total_guests + rowsToImport.length, guest_tags: merged } : prev)
    } else {
      setEvent(prev => prev ? { ...prev, total_guests: prev.total_guests + rowsToImport.length } : prev)
    }
    await loadGuests()
    setCsvSuccess('✓ ' + rowsToImport.length + ' invitados' + (memberRows.length ? ' y ' + memberRows.length + ' acompañantes' : '') + ' importados' + (newTagsToAdd.length ? ' · ' + newTagsToAdd.length + ' tags nuevos' : '') + (skipDuplicates && csvPreview.duplicates.length > 0 ? ' (' + csvPreview.duplicates.length + ' duplicados omitidos)' : ''))
    setCsvPreview(null); setCsvImporting(false)
  }

  const exportExcel = () => {
    const data = filtered.map(g => {
      const t = guestTableMap.get(g.id)
      return {
        Nombre: g.name,
        'Teléfono': g.phone || '',
        Email: g.email || '',
        Estatus: STATUS_LABEL[g.rsvp_status].label,
        Mesa: t ? `Mesa ${t.tableNumber}${t.tableName ? ' - ' + t.tableName : ''}` : '',
        Grupo: g.side || '',
        Tags: (g.tags || []).join(', '),
        Alergias: (g.allergies || []).join(', '),
        Notas: g.notes || '',
        'Acompañantes': g.party_members.map(m => m.name || 'Acompañante').join(', '),
      }
    })
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 28 }, { wch: 40 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Invitados')
    XLSX.writeFile(wb, 'invitados_' + (event?.name?.replace(/\s+/g, '_') || 'evento') + '.xlsx')
  }

  const exportPDF = async () => {
    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const printDate = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    const brandLogoUrl = '/images/logo.png' // white-label hook: si plan agency con logo propio, sustituir esta URL
    let logoBottom = 14
    try {
      const logo = await loadImageData(brandLogoUrl)
      const lw = 40, lh = (logo.h / logo.w) * lw
      doc.addImage(logo.dataUrl, 'PNG', pageW - 14 - lw, 14, lw, lh)
      logoBottom = 14 + lh
    } catch { /* sin logo */ }
    let y = 21
    doc.setFontSize(17); doc.setTextColor(29, 30, 32)
    doc.text(event?.name || 'Evento', 14, y); y += 6
    doc.setFontSize(10.5); doc.setTextColor(120)
    doc.text('Lista de invitados', 14, y); y += 7
    doc.setFontSize(9.5); doc.setTextColor(90)
    if (event?.event_date) {
      const f = new Date(event.event_date).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      doc.text(event.event_time ? `${f} · ${event.event_time}` : f, 14, y); y += 5
    }
    if (event?.venue) { doc.text(event.venue, 14, y); y += 5 }
    if (event?.address) { doc.text(event.address, 14, y); y += 5 }
    doc.setFontSize(9); doc.setTextColor(140)
    doc.text(`${filtered.length} invitados · ${filtered.reduce((a, g) => a + 1 + g.party_members.length, 0)} personas`, 14, y)
    const startY = Math.max(y, logoBottom) + 6

    const colDefs: { label: string; guest: (g: Guest) => string; member: (m: PartyMember) => string }[] = [
      { label: 'Nombre', guest: g => g.name, member: m => '     + ' + (m.name || 'Acompañante') },
    ]
    if (visibleCols.has('estatus')) colDefs.push({ label: 'Estatus', guest: g => STATUS_LABEL[g.rsvp_status].label, member: m => STATUS_LABEL[m.rsvp_status].label })
    if (visibleCols.has('lado'))     colDefs.push({ label: 'Grupo', guest: g => g.side || '', member: () => '' })
    if (visibleCols.has('mesa'))     colDefs.push({ label: 'Mesa', guest: g => { const t = guestTableMap.get(g.id); return t ? `Mesa ${t.tableNumber}` : '' }, member: () => '' })
    if (visibleCols.has('tags'))     colDefs.push({ label: 'Tags', guest: g => (g.tags || []).join(', '), member: () => '' })
    if (visibleCols.has('notas'))    colDefs.push({ label: 'Notas', guest: g => g.notes || '', member: () => '' })
    if (visibleCols.has('telefono')) colDefs.push({ label: 'Teléfono', guest: g => g.phone || '', member: m => m.phone || '' })

    const body: string[][] = []
    filtered.forEach(g => {
      body.push(colDefs.map(c => c.guest(g)))
      g.party_members.forEach(m => body.push(colDefs.map(c => c.member(m))))
    })
    autoTable(doc, {
      head: [colDefs.map(c => c.label)],
      body,
      startY,
      styles: { fontSize: 8.5, cellPadding: 1.8, overflow: 'linebreak' },
      headStyles: { fillColor: [29, 30, 32], textColor: 255 },
      columnStyles: { 0: { cellWidth: 50 } },
      didDrawPage: () => {
        doc.setFontSize(8); doc.setTextColor(160)
        doc.text(`Descargado desde Anfiora.com · ${printDate}`, pageW / 2, pageH - 8, { align: 'center' })
      },
    })
    doc.save(`ANFIORA - ${event?.name || 'Evento'} - Lista de invitados.pdf`)
  }

  const exportCSV = () => {
    const headers = 'nombre,telefono,email,status,mesa,notas,tags,acompañantes'
    const rows = guests.map(g => {
      const memberNames = g.party_members.map(m => m.name || 'Acompañante').join(' | ')
      const tableInfo = guestTableMap.get(g.id)
      const mesaLabel = tableInfo ? `Mesa ${tableInfo.tableNumber}${tableInfo.tableName ? ' - ' + tableInfo.tableName : ''}` : ''
      return '"' + g.name + '","' + (g.phone || '') + '","' + (g.email || '') + '","' + STATUS_LABEL[g.rsvp_status].label + '","' + mesaLabel + '","' + (g.notes || '').replace(/"/g, '""') + '","' + (g.tags || []).join(', ') + '","' + memberNames + '"'
    })
    const csv = [headers, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'invitados_' + (event?.name?.replace(/\s+/g, '_') || 'evento') + '.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const downloadTemplate = () => {
    const eventTags = event?.guest_tags || []
    const tagExample = eventTags.length >= 2 ? `${eventTags[0]} | ${eventTags[1]}` : eventTags.length === 1 ? eventTags[0] : 'Familia'
    const headers = 'nombre,telefono,email,notas,tags,rsvp_status,acompanantes,grupo,alergias'
    const examples = [
      `"Maria Jose Garcia","+52 81 1234 5678","mj@ejemplo.com","Mesa 3","${tagExample}","confirmed","Juan Garcia | Sofia Garcia","Novia","Gluten | Mariscos"`,
      `"Patricio Juarez","+52 55 9876 5432","","Sin restricciones alimentarias","","pending","","Novio",""`,
      `"Andres Garza","","andres@ejemplo.com","Llegara tarde","","pending","Acompanante de Andres","","Nueces"`,
    ]
    const instructions = ['', '# INSTRUCCIONES:', '# nombre -> obligatorio', '# telefono -> formato +52 XX XXXX XXXX (opcional)', '# email -> correo electronico (opcional)', '# notas -> texto libre (opcional)', `# tags -> separados por | (pipe): ${eventTags.length ? eventTags.join(' | ') : 'VIP | Familia'} (se crean los nuevos)`, '# rsvp_status -> confirmed | pending | declined  (vacio = pending)', '# acompanantes -> nombres separados por | (pipe): Juan Perez | Maria Lopez (opcional)', '# grupo -> un valor (ej. Novia, Novio, Trabajo) - se crean los nuevos (opcional)', '# alergias -> separadas por | (pipe): Gluten | Nueces - se crean las nuevas (opcional)']
    const csv = [headers, ...examples, ...instructions].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'Importar a ANFIORA - ' + (event?.name || 'Evento') + '.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const getTableLabel = (guestId: string): string => { const t = guestTableMap.get(guestId); if (!t) return ''; return `Mesa ${t.tableNumber}` }

  const totalPersonas = guests.reduce((acc, g) => acc + 1 + g.party_members.length, 0)

  const countByStatus = (s: RsvpStatus) => guests.reduce((acc, g) => {
    if (g.rsvp_status === 'declined') return acc + (s === 'declined' ? 1 + g.party_members.length : 0)
    let n = g.rsvp_status === s ? 1 : 0
    n += g.party_members.filter(m => m.rsvp_status === s).length
    return acc + n
  }, 0)

  const confirmed       = countByStatus('confirmed')
  const pending         = countByStatus('pending')
  const declined        = countByStatus('declined')
  const mensajeEnviado  = countByStatus('mensaje_enviado')
  const respondio       = countByStatus('respondio')
  const accionNecesaria = countByStatus('accion_necesaria')
  const conAtencion     = accionNecesaria + respondio

  const allSelected = filtered.length > 0 && selected.size === filtered.length
  const someSelected = selected.size > 0 || selectedMembers.size > 0

  const activeTemplates = (eventSettings?.message_templates as string[] | null)?.filter((t: string) => t.trim()) || []
  const templateNames = eventSettings?.template_names as string[] | null
  const availableTags = event?.guest_tags || []
  const tableFilterValues = useMemo(() => Array.from(new Set(guests.map(g => { const t = guestTableMap.get(g.id); return t ? `Mesa ${t.tableNumber}` : '' }).filter(Boolean))) as string[], [guests, guestTableMap])
  const createEventTag = async (tag: string) => {
    const t = tag.trim()
    if (!t || availableTags.some(x => x.toLowerCase() === t.toLowerCase())) return
    const next = [...availableTags, t]
    setEvent(prev => prev ? { ...prev, guest_tags: next } : prev)
    await supabase.from('events').update({ guest_tags: next }).eq('id', id)
  }
  const deleteEventTag = async (tag: string) => {
    const next = availableTags.filter(t => t !== tag)
    setEvent(prev => prev ? { ...prev, guest_tags: next } : prev)
    await supabase.from('events').update({ guest_tags: next }).eq('id', id)
    const affected = guests.filter(g => (g.tags || []).includes(tag))
    if (affected.length > 0) {
      await Promise.all(affected.map(g => supabase.from('guests').update({ tags: (g.tags || []).filter(t => t !== tag) }).eq('id', g.id)))
      setGuests(prev => prev.map(g => ({ ...g, tags: (g.tags || []).filter(t => t !== tag) })))
    }
  }
  const createGroup = (group: string) => setGroupPool(prev => prev.includes(group) ? prev : [...prev, group])
  const deleteGroup = async (group: string) => {
    setGroupPool(prev => prev.filter(g => g !== group))
    const affected = guests.filter(g => g.side === group)
    if (affected.length > 0) {
      await Promise.all(affected.map(g => supabase.from('guests').update({ side: null }).eq('id', g.id)))
      setGuests(prev => prev.map(g => g.side === group ? { ...g, side: undefined } : g))
    }
  }
  const createAllergy = (a: string) => setAllergyPool(prev => prev.includes(a) ? prev : [...prev, a])
  const deleteAllergy = async (a: string) => {
    setAllergyPool(prev => prev.filter(x => x !== a))
    const affected = guests.filter(g => (g.allergies || []).includes(a))
    if (affected.length > 0) {
      await Promise.all(affected.map(g => {
        const left = (g.allergies || []).filter(x => x !== a)
        return supabase.from('guests').update({ allergies: left.length > 0 ? left : null }).eq('id', g.id)
      }))
      setGuests(prev => prev.map(g => ({ ...g, allergies: (g.allergies || []).filter(x => x !== a) })))
    }
  }

  const maxCanAdd = selected.size === 0 ? 15 : Math.max(0, 15 - Math.max(...Array.from(selected).map(gid => guests.find(g => g.id === gid)?.party_members.length ?? 0)))

  const gridCols = ['40px', '2fr', ...(visibleCols.has('tags') ? ['1.2fr'] : []), ...(visibleCols.has('mesa') ? ['90px'] : []), ...(visibleCols.has('lado') ? ['100px'] : []), ...(visibleCols.has('notas') ? ['1fr'] : []), ...(visibleCols.has('telefono') ? ['1.5fr'] : []), ...(visibleCols.has('estatus') ? ['140px'] : []), '40px'].join(' ')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#ffffff', color: '#1D1E20', overflow: 'hidden' }}>

      <div className="shrink-0 border-b border-[#e8e8e8] px-4 pt-4 pb-0 sm:px-6 sm:pt-5 lg:px-10 lg:pt-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[#1D1E20]">Invitados</h1>
            <p className="mt-0.5 text-xs text-[#888] sm:text-sm">Gestiona a todos tus invitados.</p>
          </div>
          <div className="lg:hidden shrink-0 pt-1">
            <StatsToggleButton visible={statsVisible} onClick={toggleStats} />
          </div>
        </div>

        <StatsCollapse visible={statsVisible}>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-[#48C9B0]" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">Confirmados</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[#1D1E20]">{confirmed}<span className="ml-1.5 text-sm font-normal text-[#aaa]">/ {totalPersonas}</span></p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e8e8e8]">
                <div className="h-full rounded-full bg-[#48C9B0] transition-all" style={{ width: totalPersonas > 0 ? `${(confirmed / totalPersonas) * 100}%` : '0%' }} />
              </div>
            </div>
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className={pending > 0 ? 'text-[#b8860b]' : 'text-[#bbb]'} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">Pendientes</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums" style={{ color: pending > 0 ? '#b8860b' : '#1D1E20' }}>{pending + mensajeEnviado}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e8e8e8]">
                <div className="h-full rounded-full bg-[#f0d080] transition-all" style={{ width: totalPersonas > 0 ? `${((pending + mensajeEnviado) / totalPersonas) * 100}%` : '0%' }} />
              </div>
            </div>
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className={conAtencion > 0 ? 'text-[#cc3333]' : 'text-[#bbb]'} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">Atención</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums" style={{ color: conAtencion > 0 ? '#cc3333' : '#1D1E20' }}>{conAtencion}</p>
              {conAtencion > 0 ? <p className="mt-1 text-[10px] font-medium text-[#cc3333]">Respondieron o acción requerida</p> : <p className="mt-1 text-[10px] text-[#48C9B0]">Sin pendientes urgentes ✓</p>}
            </div>
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
              <div className="flex items-center gap-2">
                <XCircle size={16} className={declined > 0 ? 'text-[#cc3333]' : 'text-[#bbb]'} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">Declinados</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums" style={{ color: declined > 0 ? '#cc3333' : '#1D1E20' }}>{declined}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e8e8e8]">
                <div className="h-full rounded-full bg-[#ffc0c0] transition-all" style={{ width: totalPersonas > 0 ? `${(declined / totalPersonas) * 100}%` : '0%' }} />
              </div>
            </div>
          </div>
        </StatsCollapse>

        <div className="mb-3 flex items-center gap-2">
          <SearchBox onDebounced={setDebouncedSearch} />
          <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}
            className="min-w-0 flex-1 cursor-pointer rounded-lg border-none bg-[#1D1E20] px-3 py-2 text-xs font-semibold text-white outline-none sm:flex-none sm:w-48">
            <option value="all">Todos ({totalPersonas})</option>
            <option value="confirmed">Confirmados ({confirmed})</option>
            <option value="pending">Pendientes ({pending})</option>
            <option value="mensaje_enviado">Mensaje enviado ({mensajeEnviado})</option>
            <option value="respondio">Respondió ({respondio})</option>
            <option value="accion_necesaria">Acción necesaria ({accionNecesaria})</option>
            <option value="declined">Declinados ({declined})</option>
          </select>
          <div className="hidden sm:block sm:flex-1" />
          {someSelected && (
            <button onClick={() => setShowMobileBulkSheet(true)}
              className="whitespace-nowrap rounded-lg bg-[#1D1E20] px-3 py-2 text-xs font-semibold text-white sm:hidden">
              {selected.size + selectedMembers.size} sel. ▾
            </button>
          )}
          {someSelected && (
            <div className="relative hidden sm:block" ref={bulkMenuRef}>
              <button onClick={() => setShowBulkMenu(!showBulkMenu)}
                className="whitespace-nowrap rounded-lg bg-[#1D1E20] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#2d2e30]">
                {selected.size + selectedMembers.size} seleccionados ▾
              </button>
              {showBulkMenu && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[230px] rounded-xl border border-[#e8e8e8] bg-white py-1.5 shadow-xl">
                  <BulkMenuContent
                    onClose={() => setShowBulkMenu(false)}
                    onBulkUpdateStatus={bulkUpdateStatus}
                    onBulkDelete={bulkDelete}
                    onOpenCompanionModal={() => { setBulkCompanionCount(1); setShowBulkCompanionModal(true) }}
                    hasGuests={selected.size > 0}
                  />
                </div>
              )}
            </div>
          )}
          <div className="relative hidden sm:block" ref={filterMenuRef}>
            <button onClick={() => setShowFilterMenu(v => !v)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#e0e0e0] px-3 py-2 text-xs text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
              <Filter size={13} />Filtros{filters.length > 0 ? ` (${filters.length})` : ''}
            </button>
            {showFilterMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 max-h-[60vh] w-64 overflow-y-auto rounded-xl border border-[#e8e8e8] bg-white p-2 shadow-lg">
                {([
                  { title: 'Tags', field: 'tag' as FilterField, values: availableTags },
                  { title: 'Alergias', field: 'allergy' as FilterField, values: allergyPool },
                  { title: 'Grupos', field: 'side' as FilterField, values: groupPool },
                  { title: 'Mesas', field: 'table' as FilterField, values: tableFilterValues },
                ]).map(sec => sec.values.length > 0 && (
                  <div key={sec.field} className="mb-1.5">
                    <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">{sec.title}</p>
                    {sec.values.map(v => {
                      const active = filters.some(f => f.field === sec.field && f.value === v)
                      return (
                        <button key={v} onClick={() => active ? removeFilter(sec.field, v) : addFilter(sec.field, v)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[#1D1E20] transition hover:bg-[#f8f8f8]">
                          <span className="truncate">{v}</span>
                          {active && <Check size={13} className="shrink-0 text-[#48C9B0]" />}
                        </button>
                      )
                    })}
                  </div>
                ))}
                {availableTags.length === 0 && allergyPool.length === 0 && groupPool.length === 0 && tableFilterValues.length === 0 && (
                  <p className="px-2 py-2 text-xs text-[#aaa]">No hay valores para filtrar todavia</p>
                )}
              </div>
            )}
          </div>
          <div className="relative hidden sm:block" ref={colMenuRef}>
            <button onClick={() => setShowColMenu(v => !v)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#e0e0e0] px-3 py-2 text-xs text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
              <Columns3 size={13} />Columnas
            </button>
            {showColMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[170px] rounded-xl border border-[#e8e8e8] bg-white p-2 shadow-lg">
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Mostrar columnas</p>
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-[#f8f8f8]">
                    <input type="checkbox" checked={visibleCols.has(col.key)} onChange={() => toggleCol(col.key)} disabled={col.key === 'estatus'} className="accent-[#48C9B0]" />
                    <span className="text-xs text-[#1D1E20]">{col.label}</span>
                    {col.key === 'estatus' && <span className="ml-auto text-[10px] text-[#ccc]">siempre</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="relative hidden sm:block" ref={exportMenuRef}>
            <button onClick={() => setShowExportMenu(v => !v)} className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#e0e0e0] px-3 py-2 text-xs text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
              <Download size={13} />Exportar
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[170px] rounded-xl border border-[#e8e8e8] bg-white p-1.5 shadow-lg">
                <button onClick={() => { setShowExportMenu(false); exportExcel() }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#1D1E20] transition hover:bg-[#f8f8f8]">
                  <FileSpreadsheet size={15} className="text-[#1a9e5a]" />Excel (.xlsx)
                </button>
                <button onClick={() => { setShowExportMenu(false); exportPDF() }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#1D1E20] transition hover:bg-[#f8f8f8]">
                  <FileText size={15} className="text-[#cc3333]" />PDF
                </button>
                <button onClick={() => { setShowExportMenu(false); exportCSV() }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#1D1E20] transition hover:bg-[#f8f8f8]">
                  <Download size={15} className="text-[#888]" />CSV
                </button>
              </div>
            )}
          </div>
          <button onClick={() => { setCsvError(''); setCsvSuccess(''); setCsvPreview(null); setShowCsvModal(true) }} className="hidden items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#e0e0e0] px-3 py-2 text-xs text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0] sm:flex">
            <Upload size={13} />Importar
          </button>
          <button onClick={() => setShowModal(true)}
            className="shrink-0 whitespace-nowrap rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3ab89f] sm:px-4 sm:text-sm">
            + Agregar
          </button>
        </div>

        {filters.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {filters.map(f => (
              <span key={f.field + ':' + f.value} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D1E20] px-2.5 py-1 text-xs font-medium text-white">
                {FILTER_LABEL[f.field]}: {f.value}
                <button onClick={() => removeFilter(f.field, f.value)} className="text-white/60 transition hover:text-white"><X size={12} /></button>
              </span>
            ))}
            {filters.length >= 2 && (
              <button onClick={clearFilters} className="text-xs font-medium text-[#888] underline transition hover:text-[#1D1E20]">Limpiar</button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-0 sm:px-6 lg:px-10">
        {loading ? (
          <p className="pt-5 text-sm text-[#999]">Cargando...</p>
        ) : filtered.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-[#e0e0e0] px-6 py-14 text-center">
            <div className="mb-3 text-3xl">👥</div>
            <p className="text-sm text-[#888]">{guests.length === 0 ? 'Aún no hay invitados' : 'Sin resultados'}</p>
            <p className="mt-1 text-xs text-[#bbb]">{guests.length === 0 ? 'Agrega tu primer invitado o importa un CSV' : 'Intenta con otro filtro'}</p>
          </div>
        ) : (
          <>
            {isMobile && (
            <div className="mt-3 flex flex-col gap-2 sm:hidden">
              {filtered.map((guest, gIdx) => {
                const groupColor = guest.party_members.length > 0 ? GROUP_COLORS[gIdx % GROUP_COLORS.length] : null
                const guestTags = guest.tags || []
                const isSelected = selected.has(guest.id)
                return (
                  <div key={guest.id}>
                    <SwipeableGuestCard
                      guest={guest} groupColor={groupColor} isSelected={isSelected}
                      guestTags={guestTags} availableTags={availableTags}
                      onSelect={() => toggleSelect(guest.id, gIdx, false)}
                      onEdit={() => openEdit(guest)} onDelete={() => deleteGuest(guest.id)}
                      onWaLongPressStart={handleWaLongPressStart} onWaLongPressEnd={handleWaLongPressEnd}
                      onWaTouchMove={handleWaTouchMove} onStatusChange={(s) => updateStatus(guest.id, s)}
                    />
                    {groupColor && guest.party_members.map((m, mi) => {
                      const isLast = mi === guest.party_members.length - 1
                      return (
                        <div key={m.id} className={'border border-t-0 bg-[#fafafa] px-3 py-2 ' + (isLast ? 'rounded-b-xl' : '')} style={{ borderColor: '#e8e8e8' }}>
                          <div className="flex items-center gap-2 pl-2">
                            <input type="checkbox" checked={selectedMembers.has(m.id)} onChange={() => toggleSelectMember(m.id)} className="shrink-0" style={{ cursor: 'pointer', accentColor: '#48C9B0' }} />
                            <div className="h-6 w-[3px] shrink-0 rounded-full opacity-40" style={{ background: groupColor }} />
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: groupColor + '22', color: groupColor }}>+{mi + 1}</div>
                            <span className="flex-1 truncate text-xs text-[#888]">{m.name || 'Acompañante'}</span>
                            <StatusDot value={m.rsvp_status} onChange={s => updatePartyMemberStatus(m.id, guest.id, s)} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
            )}

            {!isMobile && (
            <div className="mt-3 hidden rounded-xl border border-[#e8e8e8] sm:block">
              <div className="sticky top-0 z-10 items-center rounded-t-xl border-b border-[#e8e8e8] bg-[#f8f8f8] px-4 py-2" style={{ display: 'grid', gridTemplateColumns: gridCols }}>
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="cursor-pointer accent-[#48C9B0]" />
                <button onClick={() => handleHeaderClick('name')} className="cursor-pointer text-left text-[11px] font-semibold uppercase tracking-wide text-[#aaa] transition hover:text-[#1D1E20]">Nombre{getSortIndicator('name')}</button>
                {visibleCols.has('tags')     && <div className="text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">Tags</div>}
                {visibleCols.has('mesa')     && <div className="text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">Mesa</div>}
                {visibleCols.has('lado')     && <div className="text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">Grupo</div>}
                {visibleCols.has('notas')    && <button onClick={() => handleHeaderClick('notes')} className="cursor-pointer text-left text-[11px] font-semibold uppercase tracking-wide text-[#aaa] transition hover:text-[#1D1E20]">Notas{getSortIndicator('notes')}</button>}
                {visibleCols.has('telefono') && <button onClick={() => handleHeaderClick('phone')} className="cursor-pointer text-left text-[11px] font-semibold uppercase tracking-wide text-[#aaa] transition hover:text-[#1D1E20]">Teléfono{getSortIndicator('phone')}</button>}
                {visibleCols.has('estatus')  && <button onClick={() => handleHeaderClick('status')} className="cursor-pointer text-left text-[11px] font-semibold uppercase tracking-wide text-[#aaa] transition hover:text-[#1D1E20]">Estatus{getSortIndicator('status')}</button>}
                <div />
              </div>
              {filtered.map((guest, gIdx) => {
                const groupColor = guest.party_members.length > 0 ? GROUP_COLORS[gIdx % GROUP_COLORS.length] : null
                const isLastGuest = gIdx === filtered.length - 1
                const hasMembers = guest.party_members.length > 0
                const guestTags = guest.tags || []
                const tableLabel = getTableLabel(guest.id)
                return (
                  <div key={guest.id}>
                    <div
                      className={'items-center px-4 py-2.5 transition ' + (selected.has(guest.id) ? 'bg-[#f0fdfb]' : gIdx % 2 === 0 ? 'bg-white hover:bg-[#f5f5f5]' : 'bg-[#fafafa] hover:bg-[#f5f5f5]') + (hasMembers || !isLastGuest ? ' border-b border-[#f0f0f0]' : '')}
                      style={{ display: 'grid', gridTemplateColumns: gridCols }}
                    >
                      <input type="checkbox" checked={selected.has(guest.id)}
                        onChange={e => toggleSelect(guest.id, gIdx, e.nativeEvent instanceof MouseEvent ? (e.nativeEvent as MouseEvent).shiftKey : false)}
                        onClick={e => e.stopPropagation()} style={{ cursor: 'pointer', accentColor: '#48C9B0' }} />
                      <div onClick={() => openEdit(guest)} className="flex cursor-pointer items-center gap-1.5 flex-wrap">
                        {groupColor && <div className="mr-1 h-5 w-[3px] shrink-0 rounded-full" style={{ background: groupColor }} />}
                        <span className="text-sm font-semibold text-[#1D1E20]">{guest.name}</span>
                        {hasMembers && <span className="text-xs font-semibold" style={{ color: groupColor || '#aaa' }}>+{guest.party_members.length}</span>}
                        {guest.needs_attention && (
                          <span
                            className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{ background: 'var(--error-bg)', color: 'var(--error-text)', border: '1px solid var(--error-border)' }}
                            title={ATTENTION_LABEL[guest.attention_reason || 'otro']}
                          >
                            <AlertTriangle size={12} />
                            {ATTENTION_LABEL[guest.attention_reason || 'otro']}
                          </span>
                        )}
                      </div>
                      {visibleCols.has('tags') && (
                        <div onClick={() => openEdit(guest)} className="flex flex-wrap gap-1 cursor-pointer">
                          {guestTags.length > 0 ? (<>{guestTags.slice(0, 2).map(tag => { const tagIdx = availableTags.indexOf(tag); const col = getTagColor(tagIdx >= 0 ? tagIdx : 0); return <span key={tag} onClick={(e) => { e.stopPropagation(); addFilter('tag', tag) }} className="cursor-pointer truncate rounded-full border px-2 py-0.5 text-[10px] font-medium transition hover:opacity-75" style={{ background: col.bg, borderColor: col.border, color: col.text, maxWidth: '120px' }}>{tag}</span> })}{guestTags.length > 2 && <span className="rounded-full border border-[#e0e0e0] bg-[#f2f2f2] px-2 py-0.5 text-[10px] font-medium text-[#888]">+{guestTags.length - 2}</span>}</>) : <span className="text-[#ddd] text-xs">—</span>}
                        </div>
                      )}
                      {visibleCols.has('mesa') && (
                        <div>{tableLabel ? <span onClick={(e) => { e.stopPropagation(); addFilter('table', tableLabel) }} className="cursor-pointer rounded-full border border-[#c8ede7] bg-[#f0fdfb] px-2 py-0.5 text-[10px] font-semibold text-[#1a9e88] transition hover:opacity-75">{tableLabel}</span> : <span className="text-[#ddd] text-xs">—</span>}</div>
                      )}
                      {visibleCols.has('lado') && (
                        <div>{guest.side ? <span onClick={(e) => { e.stopPropagation(); addFilter('side', guest.side!) }} className="cursor-pointer rounded-full border border-[#e0e0e0] bg-[#f8f8f8] px-2 py-0.5 text-[10px] font-medium text-[#555] transition hover:opacity-75">{guest.side}</span> : <span className="text-[#ddd] text-xs">—</span>}</div>
                      )}
                      {visibleCols.has('notas') && (
                        <div onClick={() => openEdit(guest)} className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#aaa] hover:text-[#1D1E20]" title={guest.notes || ''}>
                          {guest.notes || <span className="text-[#ddd]">—</span>}
                        </div>
                      )}
                      {visibleCols.has('telefono') && (
                        <div className="flex items-center gap-1.5">
                          {guest.phone ? (
                            <>
                              <span onClick={() => openEdit(guest)} className="cursor-pointer text-xs text-[#888] hover:text-[#1D1E20]">{guest.phone}</span>
                              <div className="relative">
                                <button onClick={() => setShowWaMenu(showWaMenu === guest.id ? null : guest.id)} className="flex items-center p-0.5">
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#25D366">{WA_ICON}</svg>
                                </button>
                                {showWaMenu === guest.id && (
                                  <div ref={waMenuRef} className="absolute left-0 top-full z-50 mt-1 min-w-[240px] rounded-xl border border-[#e8e8e8] bg-white p-1 shadow-lg">
                                    <div className="mb-1 flex items-center gap-1 border-b border-[#f0f0f0] px-1.5 pb-1.5 pt-0.5">
                                      <span className="mr-auto text-[10px] font-medium uppercase tracking-wide text-[#aaa]">Abrir en</span>
                                      <button onClick={e => { e.stopPropagation(); setWaTargetPref('app') }}
                                        className={'rounded-md px-2 py-0.5 text-[10px] font-semibold transition ' + (waTarget === 'app' ? 'bg-[#f0fdfb] text-[#1a9e88]' : 'text-[#999] hover:text-[#1D1E20]')}>App</button>
                                      <button onClick={e => { e.stopPropagation(); setWaTargetPref('web') }}
                                        className={'rounded-md px-2 py-0.5 text-[10px] font-semibold transition ' + (waTarget === 'web' ? 'bg-[#f0fdfb] text-[#1a9e88]' : 'text-[#999] hover:text-[#1D1E20]')}>Web</button>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto">
                                      {activeTemplates.length === 0 ? (
                                        <p className="px-3 py-2.5 text-xs text-[#aaa]">No hay plantillas — ve a Configuración</p>
                                      ) : activeTemplates.map((template: string, ti: number) => (
                                        <button key={ti} onClick={() => { openWhatsApp(guest.phone!, buildWaText(guest, ti)); setShowWaMenu(null) }}
                                          className="w-full rounded-lg px-3 py-2 text-left text-xs leading-snug text-[#1D1E20] hover:bg-[#f0fdfb]">
                                          <span className="mb-0.5 block text-[10px] font-semibold text-[#48C9B0]">{templateNames?.[ti] || 'Plantilla ' + (ti + 1)}</span>
                                          {template.length > 60 ? template.substring(0, 60) + '...' : template}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : <span className="text-xs text-[#ddd]">—</span>}
                        </div>
                      )}
                      {visibleCols.has('estatus') && (
                        <select value={guest.rsvp_status} onChange={e => updateStatus(guest.id, e.target.value as RsvpStatus)}
                          className="w-[120px] cursor-pointer rounded-md border px-2 py-1 text-xs font-semibold outline-none"
                          style={{ background: STATUS_LABEL[guest.rsvp_status].bg, borderColor: STATUS_LABEL[guest.rsvp_status].border, color: STATUS_LABEL[guest.rsvp_status].color }}>
                          <option value="mensaje_enviado">Mensaje enviado</option>
                          <option value="pending">Pendiente</option>
                          <option value="respondio">Respondió</option>
                          <option value="accion_necesaria">Acción necesaria</option>
                          <option value="confirmed">Confirmado</option>
                          <option value="declined">Declinado</option>
                        </select>
                      )}
                      <button onClick={() => deleteGuest(guest.id)} className="flex items-center justify-center p-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cc3333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{TRASH_ICON}</svg>
                      </button>
                    </div>
                    {groupColor && guest.party_members.map((m, mi) => {
                      const isLastMember = mi === guest.party_members.length - 1
                      return (
                        <div key={m.id}
                          className={'items-center px-4 py-2.5 bg-[#fafafa] ' + (isLastMember && !isLastGuest ? 'border-b-2 border-[#f0f0f0]' : 'border-b border-[#f8f8f8]')}
                          style={{ display: 'grid', gridTemplateColumns: gridCols }}>
                          <div className="flex items-center justify-center">
                            <input type="checkbox" checked={selectedMembers.has(m.id)} onChange={() => toggleSelectMember(m.id)} style={{ cursor: 'pointer', accentColor: '#48C9B0' }} />
                          </div>
                          <div className="flex items-center gap-2 pl-4">
                            <div className="h-4 w-[2px] shrink-0 rounded-full opacity-40" style={{ background: groupColor }} />
                            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: groupColor + '22', color: groupColor }}>+{mi + 1}</div>
                            <span className="text-xs text-[#888]">{m.name || 'Acompañante'}</span>
                          </div>
                          {visibleCols.has('tags')     && <div />}
                          {visibleCols.has('mesa')     && <div />}
                          {visibleCols.has('lado')     && <div />}
                          {visibleCols.has('notas')    && <div />}
                          {visibleCols.has('telefono') && <div className="text-xs text-[#aaa]">{m.phone || ''}</div>}
                          {visibleCols.has('estatus')  && (
                            <select value={m.rsvp_status} onChange={e => updatePartyMemberStatus(m.id, guest.id, e.target.value as RsvpStatus)}
                              className="w-[120px] cursor-pointer rounded-md border px-2 py-1 text-xs font-semibold outline-none"
                              style={{ background: STATUS_LABEL[m.rsvp_status].bg, borderColor: STATUS_LABEL[m.rsvp_status].border, color: STATUS_LABEL[m.rsvp_status].color }}>
                              <option value="mensaje_enviado">Mensaje enviado</option>
                              <option value="pending">Pendiente</option>
                              <option value="respondio">Respondió</option>
                              <option value="accion_necesaria">Acción necesaria</option>
                              <option value="confirmed">Confirmado</option>
                              <option value="declined">Declinado</option>
                            </select>
                          )}
                          <button onClick={() => deletePartyMember(m.id, guest.id)} className="flex items-center justify-center p-1 opacity-40 transition-opacity hover:opacity-100">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cc3333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{TRASH_ICON}</svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
            )}
          </>
        )}
      </div>

      {editGuest && (
        <EditGuestModal key={editGuest.id} guest={editGuest}
          availableTags={availableTags} groupPool={groupPool} allergyPool={allergyPool}
          onCreateTag={createEventTag} onDeleteTag={deleteEventTag}
          onCreateGroup={createGroup} onDeleteGroup={deleteGroup}
          onCreateAllergy={createAllergy} onDeleteAllergy={deleteAllergy}
          onSubmit={f => submitEditGuest(editGuest, f)}
          onClose={() => setEditGuest(null)}
          onDelete={() => { const gid = editGuest.id; setEditGuest(null); setTimeout(() => deleteGuest(gid), 0) }}
          onResolveAttention={() => resolveAttention(editGuest.id)}
        />
      )}

      {deleteChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteChatModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[#1D1E20]">Este invitado tiene una conversación</h3>
            <p className="mt-1.5 text-sm text-[#666]">¿Qué quieres hacer con el chat?</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={async () => { const m = deleteChatModal; setDeleteChatModal(null); await performDeleteGuest(m.guestId, m.conversationIds, 'unlink') }}
                className="rounded-lg border border-[#e0e0e0] py-2.5 text-sm font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]"
              >
                Conservar el chat
                <span className="mt-0.5 block text-xs font-normal text-[#999]">Se guarda el historial; el hilo queda sin invitado</span>
              </button>
              <button
                onClick={async () => { const m = deleteChatModal; setDeleteChatModal(null); await performDeleteGuest(m.guestId, m.conversationIds, 'purge') }}
                className="rounded-lg bg-[#cc3333] py-2.5 text-sm font-semibold text-white transition hover:bg-[#b82e2e]"
              >
                Eliminar también el chat
              </button>
              <button onClick={() => setDeleteChatModal(null)} className="py-1.5 text-xs font-medium text-[#999]">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <AddGuestModal
          availableTags={availableTags} groupPool={groupPool} allergyPool={allergyPool}
          onCreateTag={createEventTag} onDeleteTag={deleteEventTag}
          onCreateGroup={createGroup} onDeleteGroup={deleteGroup}
          onCreateAllergy={createAllergy} onDeleteAllergy={deleteAllergy}
          onSubmit={submitAddGuest}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* input oculto para importar CSV */}
      <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleCSV} className="hidden" />

      {/* Importar invitados — pasos (componente compartido) */}
      <ImportStepsModal
        open={showCsvModal && !csvPreview}
        onClose={() => { setShowCsvModal(false); setCsvPreview(null) }}
        title="Importar invitados"
        subtitle="Trae tu lista de invitados desde Excel en dos pasos."
        step1Desc="Ya trae las columnas correctas (nombre, teléfono, email, notas, tags). Solo llénala y guárdala como CSV."
        downloadLabel="Descargar plantilla CSV"
        onDownload={downloadTemplate}
        step2Desc="Selecciona el archivo CSV que llenaste. Verás una vista previa antes de guardar."
        selectLabel="Seleccionar archivo CSV"
        onSelectFile={() => fileRef.current?.click()}
        error={csvError || undefined}
      />

      {/* Importar invitados — vista previa */}
      <AnimatePresence>
      {showCsvModal && csvPreview && (
        <motion.div
          key="csv-preview-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-2xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1D1E20]">Importar invitados</h2>
              <button onClick={() => { setShowCsvModal(false); setCsvPreview(null) }} className="text-xl text-[#aaa]">✕</button>
            </div>
            <div>
                <div className="mb-4 rounded-xl border border-[#e8e8e8] bg-[#f8f8f8] p-4">
                  <p className="mb-1 text-sm font-semibold text-[#1D1E20]">Resumen del archivo</p>
                  <p className="text-xs text-[#666]">{csvPreview.rows.length} invitados encontrados</p>
                  {csvPreview.hasDuplicates && <p className="mt-1 text-xs font-semibold text-[#cc3333]">{csvPreview.duplicates.length} con WhatsApp duplicado</p>}
                </div>
                {csvPreview.hasDuplicates && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-semibold text-[#cc3333]">Números duplicados detectados:</p>
                    <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-[#ffc0c0] bg-[#fff8f8] p-3">
                      {csvPreview.duplicates.map((d, i) => (
                        <div key={i} className="text-xs text-[#cc3333]">
                          <span className="font-semibold">{d.name}</span> ({d.phone}) — duplica a <span className="font-semibold">{d.conflictWith}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(csvPreview.newTags.length > 0 || csvPreview.newGroups.length > 0 || csvPreview.newAllergies.length > 0) && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-semibold text-[#1a9e88]">Se agregarán estos nuevos:</p>
                    <div className="flex flex-col gap-1.5 rounded-lg border border-[#c8ede7] bg-[#f0fdfb] p-3 text-xs text-[#1a9e88]">
                      {csvPreview.newTags.length > 0 && <div><span className="font-semibold">Tags:</span> {csvPreview.newTags.join(', ')}</div>}
                      {csvPreview.newGroups.length > 0 && <div><span className="font-semibold">Grupos:</span> {csvPreview.newGroups.join(', ')}</div>}
                      {csvPreview.newAllergies.length > 0 && <div><span className="font-semibold">Alergias:</span> {csvPreview.newAllergies.join(', ')}</div>}
                    </div>
                  </div>
                )}
                {csvError && <div className="mb-3 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] p-2.5 text-xs text-[#cc3333]">{csvError}</div>}
                {csvSuccess && <div className="mb-3 rounded-lg border border-[#a0e0c0] bg-[#f0fff6] p-2.5 text-xs text-[#2a7a50]">{csvSuccess}</div>}
                <div className="flex flex-col gap-2">
                  {csvPreview.hasDuplicates ? (
                    <button onClick={() => confirmCsvImport(true)} disabled={csvImporting} className="w-full rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white disabled:opacity-60">
                      {csvImporting ? 'Importando...' : `Importar ${csvPreview.rows.length - csvPreview.duplicates.length} sin duplicados`}
                    </button>
                  ) : (
                    <button onClick={() => confirmCsvImport(false)} disabled={csvImporting} className="w-full rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white disabled:opacity-60">
                      {csvImporting ? 'Importando...' : `Confirmar importación (${csvPreview.rows.length} invitados)`}
                    </button>
                  )}
                  <button onClick={() => setCsvPreview(null)} disabled={csvImporting} className="w-full rounded-lg border border-[#e0e0e0] py-2.5 text-xs text-[#888] disabled:opacity-60">Cancelar</button>
                </div>
              </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {showBulkCompanionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1D1E20]">Agregar acompañantes</h2>
              <button onClick={() => setShowBulkCompanionModal(false)} disabled={bulkCompanionSaving} className="text-xl text-[#aaa] disabled:opacity-40">✕</button>
            </div>
            <p className="mb-4 text-xs text-[#888]">
              Se agregará <span className="font-semibold text-[#1D1E20]">{bulkCompanionCount} acompañante{bulkCompanionCount > 1 ? 's' : ''}</span> a cada uno de los <span className="font-semibold text-[#1D1E20]">{selected.size} invitados</span> seleccionados.
            </p>
            {maxCanAdd === 0 ? (
              <p className="mb-4 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] p-2.5 text-xs text-[#cc3333]">Todos los invitados seleccionados ya tienen 15 acompañantes (el máximo).</p>
            ) : (
              <>
                {bulkCompanionCount > maxCanAdd && <p className="mb-3 rounded-lg border border-[#f0d080] bg-[#fffbf0] p-2.5 text-xs text-[#b8860b]">Algunos invitados ya tienen acompañantes — solo se agregarán los que quepan (máx. {maxCanAdd}).</p>}
                <div className="mb-5 flex items-center justify-center gap-4">
                  <button onClick={() => setBulkCompanionCount(c => Math.max(1, c - 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e0e0e0] text-lg font-bold text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">−</button>
                  <span className="w-8 text-center text-2xl font-bold text-[#1D1E20]">{bulkCompanionCount}</span>
                  <button onClick={() => setBulkCompanionCount(c => Math.min(maxCanAdd, c + 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e0e0e0] text-lg font-bold text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">+</button>
                </div>
              </>
            )}
            <div className="flex gap-2.5">
              <button onClick={() => setShowBulkCompanionModal(false)} disabled={bulkCompanionSaving} className="flex-1 rounded-lg border border-[#e0e0e0] py-2.5 text-sm text-[#888] disabled:opacity-50">Cancelar</button>
              <button onClick={bulkAddCompanions} disabled={bulkCompanionSaving || maxCanAdd === 0} className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white disabled:opacity-60">{bulkCompanionSaving ? <><Loader2 size={15} className="animate-spin" />Guardando...</> : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {showWaSheet && (
        <div className="fixed inset-0 z-[200] flex items-end sm:hidden" onClick={() => setShowWaSheet(null)}>
          <div className="w-full rounded-t-2xl border-t border-[#e8e8e8] bg-white pb-8 pt-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e0e0e0]" />
            <div className="mb-3 px-5">
              <p className="text-xs text-[#aaa]">Enviar a</p>
              <p className="text-sm font-semibold text-[#1D1E20]">{showWaSheet.name}</p>
            </div>
            <div className="border-t border-[#f0f0f0]" />
            {activeTemplates.length === 0 ? (
              <p className="px-5 py-4 text-sm text-[#aaa]">No hay plantillas — configúralas en Configuración.</p>
            ) : (
              <div className="flex max-h-[55vh] flex-col overflow-y-auto">
                {activeTemplates.map((template: string, ti: number) => (
                  <button key={ti} onClick={() => { openWhatsApp(showWaSheet.phone!, buildWaText(showWaSheet, ti)); setShowWaSheet(null) }}
                    className="border-b border-[#f5f5f5] px-5 py-3.5 text-left transition active:bg-[#f0fdfb]">
                    <p className="mb-0.5 text-[10px] font-semibold text-[#48C9B0]">{templateNames?.[ti] || 'Plantilla ' + (ti + 1)}</p>
                    <p className="text-sm text-[#1D1E20] line-clamp-2">{template.length > 80 ? template.substring(0, 80) + '...' : template}</p>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowWaSheet(null)} className="mx-5 mt-3 w-[calc(100%-40px)] rounded-xl border border-[#e0e0e0] py-3 text-sm font-medium text-[#666]">Cancelar</button>
          </div>
        </div>
      )}

      {showMobileBulkSheet && (
        <div className="fixed inset-0 z-[200] flex items-end sm:hidden" onClick={() => setShowMobileBulkSheet(false)}>
          <div className="w-full rounded-t-2xl border-t border-[#e8e8e8] bg-white pb-8 pt-3 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#e0e0e0]" />
            <div className="mb-2 px-3">
              <p className="text-xs font-semibold text-[#1D1E20]">{selected.size} invitados{selectedMembers.size > 0 ? ' · ' + selectedMembers.size + ' acompañantes' : ''} seleccionados</p>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <BulkMenuContent
                onClose={() => setShowMobileBulkSheet(false)}
                onBulkUpdateStatus={bulkUpdateStatus}
                onBulkDelete={bulkDelete}
                onOpenCompanionModal={() => { setBulkCompanionCount(1); setShowBulkCompanionModal(true) }}
                hasGuests={selected.size > 0}
              />
            </div>
            <div className="px-3 pt-2">
              <button onClick={() => setShowMobileBulkSheet(false)} className="w-full rounded-xl border border-[#e0e0e0] py-3 text-sm font-medium text-[#666]">Cancelar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}