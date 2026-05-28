'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { Trash2, Send, Clock, MessageSquare, AlertCircle, CheckCircle, XCircle, Download, Upload, Columns3, Search, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PartyMember, Guest, Event, EventSettings, EventStatus, RsvpStatus } from '@/lib/types'
import StatsCollapse, { StatsToggleButton, useStatsToggle } from '@/app/components/ui/StatsCollapse'

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  mensaje_enviado:  { label: 'Mensaje enviado',  color: '#1a56a0', bg: '#f0f5ff', border: '#b3c8ee', icon: <Send       size={13} /> },
  pending:          { label: 'Pendiente',         color: '#b8860b', bg: '#fffbf0', border: '#f0d080', icon: <Clock      size={13} /> },
  respondio:        { label: 'Respondió',         color: '#c06000', bg: '#fff8f0', border: '#f0c090', icon: <MessageSquare size={13} /> },
  accion_necesaria: { label: 'Acción necesaria',  color: '#cc3333', bg: '#fff0f0', border: '#ffc0c0', icon: <AlertCircle size={13} /> },
  confirmed:        { label: 'Confirmado',        color: '#2a7a50', bg: '#f0fff6', border: '#a0e0c0', icon: <CheckCircle size={13} /> },
  declined:         { label: 'Declinado',         color: '#cc3333', bg: '#fff0f0', border: '#ffc0c0', icon: <XCircle    size={13} /> },
}

const STATUS_ORDER: RsvpStatus[] = ['pending', 'mensaje_enviado', 'respondio', 'accion_necesaria', 'confirmed', 'declined']

type ColumnKey = 'tags' | 'mesa' | 'lado' | 'notas' | 'telefono' | 'estatus'

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'tags',     label: 'Tags' },
  { key: 'mesa',     label: 'Mesa' },
  { key: 'lado',     label: 'Lado' },
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

const SIDE_OPTIONS = [
  { value: 'familia_novia',  label: 'Familia novia' },
  { value: 'familia_novio',  label: 'Familia novio' },
  { value: 'amigos_novia',   label: 'Amigos novia' },
  { value: 'amigos_novio',   label: 'Amigos novio' },
  { value: 'papas_novia',    label: 'Papás novia' },
  { value: 'papas_novio',    label: 'Papás novio' },
  { value: 'ambos_lados',    label: 'Ambos lados' },
  { value: 'sin_clasificar', label: 'Sin clasificar' },
]

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

function getTagColor(tagIndex: number) { return TAG_COLORS[tagIndex % TAG_COLORS.length] }

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

type EditMember = { id?: string; name: string; phone: string; rsvp_status: RsvpStatus }
type GuestTableInfo = { tableNumber: number; tableName: string | null }

function normalizePhone(phone: string): string { return phone.replace(/\D/g, '') }

function TagSelector({ availableTags, selectedTags, onChange }: { availableTags: string[]; selectedTags: string[]; onChange: (tags: string[]) => void }) {
  if (availableTags.length === 0) return <p className="text-xs text-[#bbb]">Sin tags — agrégalos desde Configuración.</p>
  const toggle = (tag: string) => onChange(selectedTags.includes(tag) ? selectedTags.filter(t => t !== tag) : [...selectedTags, tag])
  return (
    <div className="flex flex-wrap gap-1.5">
      {availableTags.map((tag, i) => {
        const col = getTagColor(i)
        const isSelected = selectedTags.includes(tag)
        return (
          <button key={tag} type="button" onClick={() => toggle(tag)}
            className="rounded-full border px-2.5 py-1 text-xs font-medium transition"
            style={isSelected ? { background: col.bg, borderColor: col.border, color: col.text } : { background: '#f8f8f8', borderColor: '#e0e0e0', color: '#aaa' }}>
            {tag}
          </button>
        )
      })}
    </div>
  )
}

const ALLERGY_OPTIONS = ['Gluten', 'Lácteos', 'Mariscos', 'Nueces', 'Huevo', 'Soya', 'Cerdo']

function AllergySelector({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [otherText, setOtherText] = useState('')
  const otherAllergies = value.filter(a => !ALLERGY_OPTIONS.includes(a))
  const toggle = (a: string) => onChange(value.includes(a) ? value.filter(x => x !== a) : [...value, a])
  const addOther = () => { const t = otherText.trim(); if (t && !value.includes(t)) onChange([...value, t]); setOtherText('') }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {ALLERGY_OPTIONS.map(a => (
          <button key={a} type="button" onClick={() => toggle(a)}
            className={'rounded-full border px-2.5 py-1 text-xs font-medium transition ' +
              (value.includes(a) ? 'border-[#cc3333] bg-[#fff0f0] text-[#cc3333]' : 'border-[#e0e0e0] bg-[#f8f8f8] text-[#aaa] hover:border-[#cc3333] hover:text-[#cc3333]')}>
            {a}
          </button>
        ))}
      </div>
      {otherAllergies.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {otherAllergies.map(a => (
            <span key={a} className="flex items-center gap-1 rounded-full border border-[#e0e0e0] bg-[#f8f8f8] px-2.5 py-1 text-xs text-[#555]">
              {a}
              <button type="button" onClick={() => onChange(value.filter(x => x !== a))} className="opacity-60 transition hover:opacity-100">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input type="text" value={otherText} onChange={e => setOtherText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addOther()} placeholder="Otra alergia..."
          className="flex-1 rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] px-3 py-1.5 text-xs text-[#1D1E20] outline-none transition focus:border-[#48C9B0]" />
        <button type="button" onClick={addOther} disabled={!otherText.trim()}
          className="rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">+</button>
      </div>
    </div>
  )
}

function MembersEditor({ value, onChange }: { value: EditMember[]; onChange: (v: EditMember[]) => void }) {
  const MAX = 15
  const add = () => { if (value.length < MAX) onChange([...value, { name: '', phone: '', rsvp_status: 'pending' }]) }
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const update = (i: number, field: keyof EditMember, val: string) => onChange(value.map((m, idx) => idx === i ? { ...m, [field]: val } : m))
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-medium text-[#555]">Acompañantes <span className="font-normal text-[#ccc]">(máx. {MAX})</span></label>
        {value.length < MAX && <button type="button" onClick={add} className="text-xs font-semibold text-[#48C9B0] hover:underline">+ Agregar</button>}
      </div>
      {value.length === 0 && <p className="text-xs text-[#bbb]">Sin acompañantes — haz clic en "Agregar" para incluir uno.</p>}
      <div className="flex flex-col gap-2">
        {value.map((m, i) => (
          <div key={i} className="rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] p-3">
            <div className="mb-2"><span className="text-[11px] font-semibold text-[#aaa]">+{i + 1}</span></div>
            <div className="flex flex-col gap-2">
              <input type="text" value={m.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Nombre (opcional)" style={{ ...inp, fontSize: '13px', padding: '8px 12px' }} />
              <input type="tel" value={m.phone} onChange={e => update(i, 'phone', e.target.value)} placeholder="WhatsApp (opcional)" style={{ ...inp, fontSize: '13px', padding: '8px 12px' }} />
              <select value={m.rsvp_status} onChange={e => update(i, 'rsvp_status', e.target.value)} style={{ ...inp, fontSize: '13px', padding: '8px 12px', cursor: 'pointer' }}>
                <option value="mensaje_enviado">Mensaje enviado</option>
                <option value="pending">Pendiente</option>
                <option value="respondio">Respondió</option>
                <option value="accion_necesaria">Acción necesaria</option>
                <option value="confirmed">Confirmado</option>
                <option value="declined">Declinado</option>
              </select>
              <button type="button" onClick={() => remove(i)} className="mt-1 w-full rounded-lg border border-[#ffe0e0] bg-[#fff5f5] py-1.5 text-xs font-semibold text-[#cc3333] transition hover:bg-[#ffe8e8]">Eliminar acompañante</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type CsvDuplicateResult = {
  hasDuplicates: boolean
  rows: Array<{ event_id: string; name: string; phone: string | null; email: string | null; party_size: number; rsvp_status: string; tags: string[]; notes: string | null }>
  duplicates: Array<{ row: number; name: string; phone: string; conflictWith: string }>
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
}

function BulkMenuContent({ onClose, onBulkUpdateStatus, onBulkDelete, onOpenCompanionModal }: BulkMenuContentProps) {
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
      <div className="my-1 mx-3 h-px bg-[#f0f0f0]" />
      <button onClick={() => { onClose(); onOpenCompanionModal() }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition hover:bg-[#f8f8f8] sm:py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#e8e8e8] bg-[#f8f8f8] text-[#555]"><UserPlus size={11} /></span>
        <span className="font-medium text-[#555]">Agregar acompañante</span>
      </button>
      <div className="my-1 mx-3 h-px bg-[#f0f0f0]" />
      <button onClick={onBulkDelete} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition hover:bg-[#fff0f0] sm:py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#ffc0c0] bg-[#fff0f0] text-[#cc3333]"><Trash2 size={11} /></span>
        <span className="font-medium text-[#cc3333]">Eliminar seleccionados</span>
      </button>
    </>
  )
}

export default function EventPage() {
  const { id } = useParams()

  const { visible: statsVisible, toggle: toggleStats } = useStatsToggle(id as string, 'guests')

  const [event, setEvent] = useState<Event | null>(null)
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [filtered, setFiltered] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | RsvpStatus>('all')
  const [guestTableMap, setGuestTableMap] = useState<Map<string, GuestTableInfo>>(new Map())

  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(() => loadSavedColumns())
  const [showColMenu, setShowColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

  const [showModal, setShowModal] = useState(false)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [csvError, setCsvError] = useState('')
  const [csvSuccess, setCsvSuccess] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvPreview, setCsvPreview] = useState<CsvDuplicateResult | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)

  const [editGuest, setEditGuest] = useState<Guest | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editMembers, setEditMembers] = useState<EditMember[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSide, setEditSide] = useState('')
  const [editAllergies, setEditAllergies] = useState<string[]>([])

  const [selected, setSelected] = useState<Set<string>>(new Set())
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

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [newTags, setNewTags] = useState<string[]>([])
  const [newMembers, setNewMembers] = useState<EditMember[]>([])
  const [newSide, setNewSide] = useState('')
  const [newAllergies, setNewAllergies] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [sortField, setSortField] = useState<'name' | 'phone' | 'notes' | 'status' | null>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await Promise.all([loadEvent(), loadGuests()])
      }
    }
    init()
  }, [])

  useEffect(() => {
    let result = guests
    if (filter !== 'all') result = result.filter(g => g.rsvp_status === filter || g.party_members.some(m => m.rsvp_status === filter))
    if (search) result = result.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
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
    setFiltered(result)
  }, [guests, filter, search, sortField, sortDirection])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node)) setShowBulkMenu(false)
      if (waMenuRef.current && !waMenuRef.current.contains(e.target as Node)) setShowWaMenu(null)
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false)
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
  const handleWaLongPressEnd = (guest: Guest) => { if (waLongPressTimer.current) { clearTimeout(waLongPressTimer.current); waLongPressTimer.current = null; window.open('https://wa.me/' + guest.phone!.replace(/\D/g, ''), '_blank') } }
  const handleWaTouchMove = () => { if (waLongPressTimer.current) { clearTimeout(waLongPressTimer.current); waLongPressTimer.current = null } }

  const loadEvent = async () => {
    const [{ data }, { data: settings }] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase.from('event_settings').select('*').eq('event_id', id).single(),
    ])
    if (data) setEvent(data)
    if (settings) setEventSettings(settings)
  }

  // ── FIX PERFORMANCE: O(n) con Map en lugar de O(n²) con filter por cada guest ──
  const loadGuests = async () => {
    const [
      { data: guestsData },
      { data: membersData },
      { data: seatsData },
      { data: tablesData },
    ] = await Promise.all([
      supabase.from('guests').select('*').eq('event_id', id).order('name'),
      supabase.from('party_members').select('*').eq('event_id', id).order('created_at'),
      supabase.from('table_seats').select('guest_id, table_id').eq('event_id', id),
      supabase.from('tables').select('id, number, name').eq('event_id', id),
    ])
    if (!guestsData) { setLoading(false); return }

    const tableById = new Map((tablesData || []).map(t => [t.id, t]))
    const map = new Map<string, GuestTableInfo>()
    for (const seat of (seatsData || [])) {
      if (!seat.guest_id) continue
      const table = tableById.get(seat.table_id)
      if (table) map.set(seat.guest_id, { tableNumber: table.number, tableName: table.name })
    }
    setGuestTableMap(map)

    // Agrupar party_members por guest_id con Map — O(n) en lugar de O(n²)
    const membersByGuestId = new Map<string, PartyMember[]>()
    for (const m of (membersData || [])) {
      if (!membersByGuestId.has(m.guest_id)) membersByGuestId.set(m.guest_id, [])
      membersByGuestId.get(m.guest_id)!.push(m)
    }

    setGuests(guestsData.map(g => ({
      ...g,
      tags: g.tags || [],
      party_members: membersByGuestId.get(g.id) || [],
    })))
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

  const deleteGuest = async (guestId: string) => {
    if (!confirm('¿Eliminar este invitado?')) return
    await supabase.from('guests').delete().eq('id', guestId)
    await supabase.rpc('decrement_guests', { event_id_input: id })
    setGuests(prev => prev.filter(g => g.id !== guestId))
    setEvent(prev => prev ? { ...prev, total_guests: Math.max(0, prev.total_guests - 1) } : prev)
    setSelected(prev => { const n = new Set(prev); n.delete(guestId); return n })
  }

  const deletePartyMember = async (memberId: string, guestId: string) => {
    if (!confirm('¿Eliminar este acompañante?')) return
    await supabase.from('party_members').delete().eq('id', memberId)
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, party_size: g.party_size - 1, party_members: g.party_members.filter(m => m.id !== memberId) } : g))
  }

  const openEdit = (guest: Guest) => {
    setEditGuest(guest); setEditName(guest.name); setEditPhone(guest.phone || '')
    setEditEmail(guest.email || ''); setEditNotes(guest.notes || '')
    setEditTags(guest.tags || []); setEditError('')
    setEditSide(guest.side || ''); setEditAllergies(guest.allergies || [])
    setEditMembers(guest.party_members.map(m => ({ id: m.id, name: m.name, phone: m.phone || '', rsvp_status: m.rsvp_status })))
  }

  const handleHeaderClick = (field: 'name' | 'phone' | 'notes' | 'status') => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('asc') }
  }

  const getSortIndicator = (field: 'name' | 'phone' | 'notes' | 'status') => {
    if (sortField !== field) return ''
    return sortDirection === 'asc' ? ' ▲' : ' ▼'
  }

  const handleEditSave = async () => {
    if (!editGuest) return
    if (!editName) { setEditError('El nombre es obligatorio'); return }
    if (editPhone) {
      const normalizedEdit = normalizePhone(editPhone)
      if (normalizedEdit.length > 0) {
        const duplicate = guests.find(g => g.id !== editGuest.id && g.phone && normalizePhone(g.phone) === normalizedEdit)
        if (duplicate) { setEditError(`Este WhatsApp ya está registrado para "${duplicate.name}"`); return }
      }
    }
    setEditSaving(true); setEditError('')
    const { error } = await supabase.from('guests').update({ name: editName, phone: editPhone || null, email: editEmail || null, party_size: 1 + editMembers.length, notes: editNotes || null, tags: editTags, side: editSide || null, allergies: editAllergies.length > 0 ? editAllergies : null }).eq('id', editGuest.id)
    if (error) { setEditError('Error: ' + error.message); setEditSaving(false); return }
    const existingIds = editGuest.party_members.map(m => m.id)
    const keepIds = editMembers.filter(m => m.id).map(m => m.id as string)
    const toDelete = existingIds.filter(id => !keepIds.includes(id))
    if (toDelete.length > 0) await supabase.from('party_members').delete().in('id', toDelete)
    for (const m of editMembers.filter(m => m.id)) await supabase.from('party_members').update({ name: m.name, phone: m.phone || null, rsvp_status: m.rsvp_status }).eq('id', m.id!)
    const toInsert = editMembers.filter(m => !m.id)
    if (toInsert.length > 0) await supabase.from('party_members').insert(toInsert.map(m => ({ guest_id: editGuest.id, event_id: id as string, name: m.name, phone: m.phone || null, rsvp_status: m.rsvp_status })))
    await loadGuests(); setEditGuest(null); setEditSaving(false)
  }

  const toggleSelect = (guestId: string, idx: number, shiftKey: boolean) => {
    if (shiftKey && lastCheckedIdx.current !== null) {
      const start = Math.min(lastCheckedIdx.current, idx)
      const end   = Math.max(lastCheckedIdx.current, idx)
      const rangeIds = filtered.slice(start, end + 1).map(g => g.id)
      setSelected(prev => {
        const next = new Set(prev)
        const adding = !prev.has(guestId)
        rangeIds.forEach(rid => adding ? next.add(rid) : next.delete(rid))
        return next
      })
    } else {
      setSelected(prev => { const next = new Set(prev); next.has(guestId) ? next.delete(guestId) : next.add(guestId); return next })
    }
    lastCheckedIdx.current = idx
  }

  const toggleSelectAll = () => {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(g => g.id)))
    lastCheckedIdx.current = null
  }

  const bulkUpdateStatus = async (status: RsvpStatus) => {
    const ids = Array.from(selected)
    await supabase.from('guests').update({ rsvp_status: status }).in('id', ids)
    setGuests(prev => prev.map(g => selected.has(g.id) ? { ...g, rsvp_status: status } : g))
    setSelected(new Set()); setShowBulkMenu(false); setShowMobileBulkSheet(false)
  }

  const bulkDelete = async () => {
    if (!confirm('¿Eliminar ' + selected.size + ' invitados?')) return
    const ids = Array.from(selected)
    await supabase.from('guests').delete().in('id', ids)
    await supabase.rpc('increment_guests_by', { event_id_input: id, amount: -ids.length })
    setGuests(prev => prev.filter(g => !selected.has(g.id)))
    setEvent(prev => prev ? { ...prev, total_guests: Math.max(0, prev.total_guests - ids.length) } : prev)
    setSelected(new Set()); setShowBulkMenu(false); setShowMobileBulkSheet(false)
  }

  // ── FIX PERFORMANCE: optimistic update — sin await loadGuests() al final ──
  const bulkAddCompanions = async () => {
    if (bulkCompanionCount < 1) return
    setBulkCompanionSaving(true)
    const ids = Array.from(selected)

    const rows: { guest_id: string; event_id: string; name: string; phone: null; rsvp_status: string }[] = []
    const addCountByGuest = new Map<string, number>()

    for (const guestId of ids) {
      const guest = guests.find(g => g.id === guestId); if (!guest) continue
      const canAdd = Math.max(0, 15 - guest.party_members.length)
      const toAdd = Math.min(bulkCompanionCount, canAdd)
      if (toAdd === 0) continue
      addCountByGuest.set(guestId, toAdd)
      for (let i = 0; i < toAdd; i++) rows.push({ guest_id: guestId, event_id: id as string, name: '', phone: null, rsvp_status: 'pending' })
    }

    if (rows.length === 0) { setBulkCompanionSaving(false); setShowBulkCompanionModal(false); return }

    const [{ data: insertedMembers }, ] = await Promise.all([
      supabase.from('party_members').insert(rows).select(),
      supabase.rpc('increment_party_size', { guest_ids: Array.from(addCountByGuest.keys()), amount: bulkCompanionCount }),
    ])

    // Optimistic update: actualizar estado local sin recargar todo
    if (insertedMembers) {
      const newMembersByGuestId = new Map<string, PartyMember[]>()
      for (const m of insertedMembers) {
        if (!newMembersByGuestId.has(m.guest_id)) newMembersByGuestId.set(m.guest_id, [])
        newMembersByGuestId.get(m.guest_id)!.push(m)
      }
      setGuests(prev => prev.map(g => {
        const newMembers = newMembersByGuestId.get(g.id)
        if (!newMembers) return g
        return {
          ...g,
          party_size: g.party_size + newMembers.length,
          party_members: [...g.party_members, ...newMembers],
        }
      }))
    }

    setBulkCompanionSaving(false)
    setShowBulkCompanionModal(false)
    setBulkCompanionCount(1)
    setSelected(new Set())
    setShowBulkMenu(false)
    setShowMobileBulkSheet(false)
  }

  const buildWaText = (guest: Guest, templateIndex = 0) => {
    const playlistUrl = eventSettings?.playlist_token ? window.location.origin + '/playlist/' + eventSettings.playlist_token : ''
    const templates = eventSettings?.message_templates as string[] | null
    const text = (templates?.[templateIndex] || 'Hola {nombre}, te escribimos de parte de {evento}.')
      .replace('{nombre}', guest.name).replace('{evento}', event?.name || '')
      .replace('{fecha}', event?.event_date ? new Date(event.event_date).toLocaleDateString('es-MX') : '')
      .replace('{hora}', event?.event_time || '').replace('{venue}', event?.venue || '')
      .replace('{direccion}', event?.address || '').replace('{playlist}', playlistUrl)
    return encodeURIComponent(text)
  }

  const resetForm = () => { setName(''); setPhone(''); setEmail(''); setNotes(''); setNewTags([]); setNewMembers([]); setNewSide(''); setNewAllergies([]); setFormError('') }

  const handleAddGuest = async () => {
    if (!name) { setFormError('El nombre es obligatorio'); return }
    if (phone) {
      const normalizedNew = normalizePhone(phone)
      if (normalizedNew.length > 0) {
        const duplicate = guests.find(g => g.phone && normalizePhone(g.phone) === normalizedNew)
        if (duplicate) { setFormError(`Este WhatsApp ya está registrado para "${duplicate.name}"`); return }
      }
    }
    setSaving(true); setFormError('')
    const { data: guestData, error } = await supabase.from('guests').insert({ event_id: id, name, phone: phone || null, email: email || null, party_size: 1 + newMembers.length, notes: notes || null, tags: newTags, rsvp_status: 'pending', side: newSide || null, allergies: newAllergies.length > 0 ? newAllergies : null }).select().single()
    if (error || !guestData) { setFormError('Error: ' + error?.message); setSaving(false); return }
    if (newMembers.length > 0) await supabase.from('party_members').insert(newMembers.map(m => ({ guest_id: guestData.id, event_id: id, name: m.name, phone: m.phone || null, rsvp_status: m.rsvp_status })))
    await supabase.rpc('increment_guests', { event_id_input: id })
    setEvent(prev => prev ? { ...prev, total_guests: prev.total_guests + 1 } : prev)
    await loadGuests(); resetForm(); setShowModal(false); setSaving(false)
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
      const plusIdx   = headers.findIndex(h => h.includes('plus') || h.includes('acomp'))
      if (nameIdx === -1) { setCsvError('No se encontró columna "nombre"'); return }
      const eventTags = event?.guest_tags || []
      const rows = lines.slice(1).map(line => {
        const cols = line.split(sep).map(c => c.trim().replace(/"/g, '').replace(/\r/g, ''))
        const rawStatus = statusIdx >= 0 ? cols[statusIdx]?.toLowerCase() || '' : ''
        const rsvpStatus = rawStatus.includes('conf') ? 'confirmed' : rawStatus.includes('decl') || rawStatus.includes('no') ? 'declined' : 'pending'
        const rawTags = tagsIdx >= 0 ? cols[tagsIdx] || '' : ''
        const parsedTags = rawTags ? rawTags.split(/[,|]/).map((t: string) => t.trim()).filter((t: string) => eventTags.includes(t)) : []
        const plusOnes = plusIdx >= 0 ? parseInt(cols[plusIdx] || '0', 10) || 0 : 0
        return { event_id: id as string, name: cols[nameIdx] || '', phone: phoneIdx >= 0 ? cols[phoneIdx] || null : null, email: emailIdx >= 0 ? cols[emailIdx] || null : null, party_size: 1 + plusOnes, rsvp_status: rsvpStatus, tags: parsedTags, notes: notesIdx >= 0 ? cols[notesIdx] || null : null }
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
      setCsvPreview({ hasDuplicates: duplicates.length > 0, rows, duplicates })
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
    const { error } = await supabase.from('guests').insert(rowsToImport)
    if (error) { setCsvError('Error al importar: ' + error.message); setCsvImporting(false); return }
    await supabase.rpc('increment_guests_by', { event_id_input: id, amount: rowsToImport.length })
    setEvent(prev => prev ? { ...prev, total_guests: prev.total_guests + rowsToImport.length } : prev)
    await loadGuests()
    setCsvSuccess('✓ ' + rowsToImport.length + ' invitados importados' + (skipDuplicates && csvPreview.duplicates.length > 0 ? ' (' + csvPreview.duplicates.length + ' duplicados omitidos)' : ''))
    setCsvPreview(null); setCsvImporting(false)
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
    const tagExample = eventTags.length >= 2 ? eventTags[0] + ',' + eventTags[1] : eventTags.length === 1 ? eventTags[0] : 'familia'
    const headers = 'nombre,telefono,email,notas,tags,rsvp_status'
    const examples = [
      `"Maria Jose Garcia","+52 81 1234 5678","mj@ejemplo.com","Mesa 3","${tagExample}","confirmed"`,
      `"Patricio Juarez","+52 55 9876 5432","","Sin restricciones alimentarias","","pending"`,
      `"Andres Garza","","andres@ejemplo.com","Llegara tarde","","pending"`,
    ]
    const instructions = ['', '# INSTRUCCIONES:', '# nombre -> obligatorio', '# telefono -> formato +52 XX XXXX XXXX (opcional)', '# email -> correo electronico (opcional)', '# notas -> texto libre (opcional)', `# tags -> separados por coma: ${eventTags.length ? eventTags.join(', ') : '(configura tags en Configuracion)'}`, '# rsvp_status -> confirmed | pending | declined  (vacio = pending)']
    const csv = [headers, ...examples, ...instructions].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_guestflow.csv'; a.click()
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
  const someSelected = selected.size > 0

  const activeTemplates = (eventSettings?.message_templates as string[] | null)?.filter((t: string) => t.trim()) || []
  const templateNames = eventSettings?.template_names as string[] | null
  const availableTags = event?.guest_tags || []

  const maxCanAdd = selected.size === 0 ? 15 : Math.max(0, 15 - Math.max(...Array.from(selected).map(gid => guests.find(g => g.id === gid)?.party_members.length ?? 0)))

  const gridCols = ['40px', '2fr', ...(visibleCols.has('tags') ? ['1.2fr'] : []), ...(visibleCols.has('mesa') ? ['90px'] : []), ...(visibleCols.has('lado') ? ['100px'] : []), ...(visibleCols.has('notas') ? ['1fr'] : []), ...(visibleCols.has('telefono') ? ['1.5fr'] : []), ...(visibleCols.has('estatus') ? ['140px'] : []), '40px'].join(' ')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#ffffff', color: '#1D1E20', overflow: 'hidden' }}>

      <div className="shrink-0 border-b border-[#e8e8e8] px-4 pt-4 pb-0 sm:px-6 sm:pt-5 lg:px-10 lg:pt-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-[#1D1E20] sm:text-xl">Invitados</h1>
            <p className="mt-0.5 text-xs text-[#888] sm:text-sm">Gestiona a todos tus invitados.</p>
          </div>
          <div className="lg:hidden shrink-0 pt-1">
            <StatsToggleButton visible={statsVisible} onClick={toggleStats} />
          </div>
        </div>

        <StatsCollapse visible={statsVisible}>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Confirmados</span>
                <CheckCircle size={14} className="text-[#48C9B0]" />
              </div>
              <div className="text-xl font-bold text-[#1D1E20]">{confirmed}<span className="ml-1.5 text-sm font-normal text-[#aaa]">/ {totalPersonas}</span></div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e8e8e8]">
                <div className="h-full rounded-full bg-[#48C9B0] transition-all" style={{ width: totalPersonas > 0 ? `${(confirmed / totalPersonas) * 100}%` : '0%' }} />
              </div>
            </div>
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Pendientes</span>
                <Clock size={14} className={pending > 0 ? 'text-[#b8860b]' : 'text-[#bbb]'} />
              </div>
              <div className="text-xl font-bold" style={{ color: pending > 0 ? '#b8860b' : '#1D1E20' }}>{pending + mensajeEnviado}</div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e8e8e8]">
                <div className="h-full rounded-full bg-[#f0d080] transition-all" style={{ width: totalPersonas > 0 ? `${((pending + mensajeEnviado) / totalPersonas) * 100}%` : '0%' }} />
              </div>
            </div>
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Atención</span>
                <AlertCircle size={14} className={conAtencion > 0 ? 'text-[#cc3333]' : 'text-[#bbb]'} />
              </div>
              <div className="text-xl font-bold" style={{ color: conAtencion > 0 ? '#cc3333' : '#1D1E20' }}>{conAtencion}</div>
              {conAtencion > 0 ? <div className="mt-1 text-[10px] font-medium text-[#cc3333]">Respondieron o acción requerida</div> : <div className="mt-1 text-[10px] text-[#48C9B0]">Sin pendientes urgentes ✓</div>}
            </div>
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Declinados</span>
                <XCircle size={14} className={declined > 0 ? 'text-[#cc3333]' : 'text-[#bbb]'} />
              </div>
              <div className="text-xl font-bold" style={{ color: declined > 0 ? '#cc3333' : '#1D1E20' }}>{declined}</div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e8e8e8]">
                <div className="h-full rounded-full bg-[#ffc0c0] transition-all" style={{ width: totalPersonas > 0 ? `${(declined / totalPersonas) * 100}%` : '0%' }} />
              </div>
            </div>
          </div>
        </StatsCollapse>

        <div className="mb-3 flex items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none lg:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa] pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              className="w-full rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] pl-8 pr-3 py-2 text-sm text-[#1D1E20] outline-none" />
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}
            className="min-w-0 flex-1 cursor-pointer rounded-lg border-none bg-[#1D1E20] px-3 py-2 text-sm font-semibold text-white outline-none sm:flex-none sm:w-48">
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
              {selected.size} sel. ▾
            </button>
          )}
          {someSelected && (
            <div className="relative hidden sm:block" ref={bulkMenuRef}>
              <button onClick={() => setShowBulkMenu(!showBulkMenu)}
                className="whitespace-nowrap rounded-lg bg-[#1D1E20] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#2d2e30]">
                {selected.size} seleccionados ▾
              </button>
              {showBulkMenu && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[230px] rounded-xl border border-[#e8e8e8] bg-white py-1.5 shadow-xl">
                  <BulkMenuContent
                    onClose={() => setShowBulkMenu(false)}
                    onBulkUpdateStatus={bulkUpdateStatus}
                    onBulkDelete={bulkDelete}
                    onOpenCompanionModal={() => { setBulkCompanionCount(1); setShowBulkCompanionModal(true) }}
                  />
                </div>
              )}
            </div>
          )}
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
          <button onClick={exportCSV} className="hidden items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#e0e0e0] px-3 py-2 text-xs text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0] sm:flex">
            <Download size={13} />Exportar
          </button>
          <button onClick={() => { setCsvError(''); setCsvSuccess(''); setCsvPreview(null); setShowCsvModal(true) }} className="hidden items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#e0e0e0] px-3 py-2 text-xs text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0] sm:flex">
            <Upload size={13} />Importar
          </button>
          <button onClick={() => { resetForm(); setShowModal(true) }}
            className="shrink-0 whitespace-nowrap rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3ab89f] sm:px-4 sm:text-sm">
            + Agregar
          </button>
        </div>
      </div>

      <div className="hidden shrink-0 border-b border-[#e8e8e8] bg-[#f8f8f8] px-6 py-2 sm:px-6 lg:px-10 sm:block">
        <div className="items-center" style={{ display: 'grid', gridTemplateColumns: gridCols }}>
          <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="cursor-pointer accent-[#48C9B0]" />
          <button onClick={() => handleHeaderClick('name')} className="cursor-pointer text-left text-[11px] font-semibold uppercase tracking-wide text-[#aaa] transition hover:text-[#1D1E20]">Nombre{getSortIndicator('name')}</button>
          {visibleCols.has('tags')     && <div className="text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">Tags</div>}
          {visibleCols.has('mesa')     && <div className="text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">Mesa</div>}
          {visibleCols.has('lado')     && <div className="text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">Lado</div>}
          {visibleCols.has('notas')    && <button onClick={() => handleHeaderClick('notes')} className="cursor-pointer text-left text-[11px] font-semibold uppercase tracking-wide text-[#aaa] transition hover:text-[#1D1E20]">Notas{getSortIndicator('notes')}</button>}
          {visibleCols.has('telefono') && <button onClick={() => handleHeaderClick('phone')} className="cursor-pointer text-left text-[11px] font-semibold uppercase tracking-wide text-[#aaa] transition hover:text-[#1D1E20]">Teléfono{getSortIndicator('phone')}</button>}
          {visibleCols.has('estatus')  && <button onClick={() => handleHeaderClick('status')} className="cursor-pointer text-left text-[11px] font-semibold uppercase tracking-wide text-[#aaa] transition hover:text-[#1D1E20]">Estatus{getSortIndicator('status')}</button>}
          <div />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3 sm:px-6 lg:px-10">
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
            <div className="flex flex-col gap-2 sm:hidden">
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
                          <div className="flex items-center gap-2 pl-6">
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

            <div className="hidden rounded-b-xl border border-[#e8e8e8] sm:block">
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
                      <div onClick={() => openEdit(guest)} className="flex cursor-pointer items-center gap-1.5">
                        {groupColor && <div className="mr-1 h-5 w-[3px] shrink-0 rounded-full" style={{ background: groupColor }} />}
                        <span className="text-sm font-semibold text-[#1D1E20]">{guest.name}</span>
                        {hasMembers && <span className="text-xs font-semibold" style={{ color: groupColor || '#aaa' }}>+{guest.party_members.length}</span>}
                      </div>
                      {visibleCols.has('tags') && (
                        <div onClick={() => openEdit(guest)} className="flex flex-wrap gap-1 cursor-pointer">
                          {guestTags.length > 0 ? guestTags.map(tag => { const tagIdx = availableTags.indexOf(tag); const col = getTagColor(tagIdx >= 0 ? tagIdx : 0); return <span key={tag} className="rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ background: col.bg, borderColor: col.border, color: col.text }}>{tag}</span> }) : <span className="text-[#ddd] text-xs">—</span>}
                        </div>
                      )}
                      {visibleCols.has('mesa') && (
                        <div>{tableLabel ? <span className="rounded-full border border-[#c8ede7] bg-[#f0fdfb] px-2 py-0.5 text-[10px] font-semibold text-[#1a9e88]">{tableLabel}</span> : <span className="text-[#ddd] text-xs">—</span>}</div>
                      )}
                      {visibleCols.has('lado') && (
                        <div>{guest.side ? <span className="rounded-full border border-[#e0e0e0] bg-[#f8f8f8] px-2 py-0.5 text-[10px] font-medium text-[#555]">{SIDE_OPTIONS.find(o => o.value === guest.side)?.label ?? guest.side}</span> : <span className="text-[#ddd] text-xs">—</span>}</div>
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
                                  <div ref={waMenuRef} className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-xl border border-[#e8e8e8] bg-white p-1 shadow-lg">
                                    {activeTemplates.length === 0 ? (
                                      <p className="px-3 py-2.5 text-xs text-[#aaa]">No hay plantillas — ve a Configuración</p>
                                    ) : activeTemplates.map((template: string, ti: number) => (
                                      <button key={ti} onClick={() => { window.open('https://wa.me/' + guest.phone!.replace(/\D/g, '') + '?text=' + buildWaText(guest, ti), '_blank'); setShowWaMenu(null) }}
                                        className="w-full rounded-lg px-3 py-2 text-left text-xs leading-snug text-[#1D1E20] hover:bg-[#f0fdfb]">
                                        <span className="mb-0.5 block text-[10px] font-semibold text-[#48C9B0]">{templateNames?.[ti] || 'Plantilla ' + (ti + 1)}</span>
                                        {template.length > 60 ? template.substring(0, 60) + '...' : template}
                                      </button>
                                    ))}
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
                          <div />
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
          </>
        )}
      </div>

      {editGuest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md overflow-y-auto rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-xl sm:p-8" style={{ maxHeight: '90vh' }}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1D1E20] sm:text-xl">Editar invitado</h2>
              <button onClick={() => setEditGuest(null)} className="text-xl text-[#aaa]">✕</button>
            </div>
            <div className="flex flex-col gap-4">
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Nombre *</label><input type="text" value={editName} onChange={e => setEditName(e.target.value)} style={inp} /></div>
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">WhatsApp</label><input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+52 81 1234 5678" style={inp} /></div>
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Email</label><input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="ana@ejemplo.com" style={inp} /></div>
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Notas</label><textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Mesa preferida, restricciones..." rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
              {availableTags.length > 0 && <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Tags</label><TagSelector availableTags={availableTags} selectedTags={editTags} onChange={setEditTags} /></div>}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#555]">Lado <span className="font-normal text-[#ccc]">(opcional)</span></label>
                <select value={editSide} onChange={e => setEditSide(e.target.value)} className="w-full rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] px-3.5 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]">
                  <option value="">— Sin asignar —</option>
                  {SIDE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#555]">Alergias <span className="font-normal text-[#ccc]">(opcional)</span></label>
                <AllergySelector value={editAllergies} onChange={setEditAllergies} />
              </div>
              <div className="border-t border-[#f0f0f0] pt-4"><MembersEditor value={editMembers} onChange={setEditMembers} /></div>
            </div>
            {editError && <div className="mt-3 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] p-2.5 text-xs text-[#cc3333]">{editError}</div>}
            <div className="mt-6 flex gap-2.5">
              <button onClick={() => setEditGuest(null)} className="flex-1 rounded-lg border border-[#e0e0e0] py-3 text-sm text-[#888]">Cancelar</button>
              <button onClick={handleEditSave} disabled={editSaving} className="flex-[2] rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white disabled:opacity-60">{editSaving ? 'Guardando...' : 'Guardar cambios'}</button>
            </div>
            <button onClick={() => { const gid = editGuest!.id; setEditGuest(null); setTimeout(() => deleteGuest(gid), 0) }}
              className="mt-2 w-full rounded-lg border border-[#ffe0e0] bg-[#fff5f5] py-3 text-sm font-semibold text-[#cc3333] transition hover:bg-[#ffe8e8] sm:hidden">
              Eliminar invitado
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md overflow-y-auto rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-xl sm:p-8" style={{ maxHeight: '90vh' }}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1D1E20] sm:text-xl">Agregar invitado</h2>
              <button onClick={() => setShowModal(false)} className="text-xl text-[#aaa]">✕</button>
            </div>
            <div className="flex flex-col gap-4">
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Nombre *</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ana García" style={inp} /></div>
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">WhatsApp <span className="font-normal text-[#ccc]">(opcional)</span></label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+52 81 1234 5678" style={inp} /></div>
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Email <span className="font-normal text-[#ccc]">(opcional)</span></label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ana@ejemplo.com" style={inp} /></div>
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Notas <span className="font-normal text-[#ccc]">(opcional)</span></label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Mesa preferida, restricciones..." rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
              {availableTags.length > 0 && <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Tags <span className="font-normal text-[#ccc]">(opcional)</span></label><TagSelector availableTags={availableTags} selectedTags={newTags} onChange={setNewTags} /></div>}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#555]">Lado <span className="font-normal text-[#ccc]">(opcional)</span></label>
                <select value={newSide} onChange={e => setNewSide(e.target.value)} className="w-full rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] px-3.5 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]">
                  <option value="">— Sin asignar —</option>
                  {SIDE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#555]">Alergias <span className="font-normal text-[#ccc]">(opcional)</span></label>
                <AllergySelector value={newAllergies} onChange={setNewAllergies} />
              </div>
              <div className="border-t border-[#f0f0f0] pt-4"><MembersEditor value={newMembers} onChange={setNewMembers} /></div>
            </div>
            {formError && <div className="mt-3 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] p-2.5 text-xs text-[#cc3333]">{formError}</div>}
            <div className="mt-6 flex gap-2.5">
              <button onClick={() => setShowModal(false)} className="flex-1 rounded-lg border border-[#e0e0e0] py-3 text-sm text-[#888]">Cancelar</button>
              <button onClick={handleAddGuest} disabled={saving} className="flex-[2] rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Guardando...' : 'Agregar invitado'}</button>
            </div>
          </div>
        </div>
      )}

      {showCsvModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-xl sm:p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1D1E20] sm:text-xl">Importar invitados</h2>
              <button onClick={() => { setShowCsvModal(false); setCsvPreview(null) }} className="text-xl text-[#aaa]">✕</button>
            </div>
            {!csvPreview && (
              <>
                <div className="mb-6">
                  <div className="mb-2 flex items-center gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#48C9B0] text-xs font-bold text-white">1</div>
                    <span className="text-sm font-semibold text-[#1D1E20]">Descarga la plantilla</span>
                  </div>
                  <p className="mb-3 ml-8 text-xs leading-relaxed text-[#666]">Llénala en Excel o Google Sheets y guárdala como CSV.</p>
                  <div className="mb-3 ml-8 rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] p-3 font-mono text-xs leading-relaxed">
                    <span className="font-semibold text-[#b8860b]">nombre</span> — obligatorio<br/>
                    <span className="font-semibold text-[#48C9B0]">telefono</span> — WhatsApp (opcional)<br/>
                    <span className="font-semibold text-[#48C9B0]">email</span> — correo (opcional)<br/>
                    <span className="font-semibold text-[#48C9B0]">notas</span> — texto libre (opcional)<br/>
                    <span className="font-semibold text-[#48C9B0]">tags</span> — separados por coma (opcional)<br/>
                    <span className="font-semibold text-[#48C9B0]">rsvp_status</span> — confirmed | pending | declined
                  </div>
                  <button onClick={downloadTemplate} className="ml-8 rounded-lg border border-[#48C9B0] px-4 py-2 text-xs text-[#1a9e88] transition hover:bg-[#f0fdfb]">Descargar plantilla CSV</button>
                </div>
                <div className="mb-6 border-t border-[#f0f0f0]" />
                <div>
                  <div className="mb-2 flex items-center gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#48C9B0] text-xs font-bold text-white">2</div>
                    <span className="text-sm font-semibold text-[#1D1E20]">Sube tu archivo</span>
                  </div>
                  {csvError && <div className="mb-3 ml-8 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] p-2.5 text-xs text-[#cc3333]">{csvError}</div>}
                  {csvSuccess && <div className="mb-3 ml-8 rounded-lg border border-[#a0e0c0] bg-[#f0fff6] p-2.5 text-xs text-[#2a7a50]">{csvSuccess}</div>}
                  <label className="ml-8 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white">
                    Seleccionar archivo CSV
                    <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleCSV} className="hidden" />
                  </label>
                </div>
                <div className="mt-6 text-right">
                  <button onClick={() => setShowCsvModal(false)} className="rounded-lg border border-[#e0e0e0] px-5 py-2 text-xs text-[#888]">Cerrar</button>
                </div>
              </>
            )}
            {csvPreview && (
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
            )}
          </div>
        </div>
      )}

      {showBulkCompanionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1D1E20]">Agregar acompañantes</h2>
              <button onClick={() => setShowBulkCompanionModal(false)} className="text-xl text-[#aaa]">✕</button>
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
              <button onClick={() => setShowBulkCompanionModal(false)} className="flex-1 rounded-lg border border-[#e0e0e0] py-2.5 text-sm text-[#888]">Cancelar</button>
              <button onClick={bulkAddCompanions} disabled={bulkCompanionSaving || maxCanAdd === 0} className="flex-[2] rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white disabled:opacity-60">{bulkCompanionSaving ? 'Guardando...' : 'Confirmar'}</button>
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
              <div className="flex flex-col">
                {activeTemplates.map((template: string, ti: number) => (
                  <button key={ti} onClick={() => { window.open('https://wa.me/' + showWaSheet.phone!.replace(/\D/g, '') + '?text=' + buildWaText(showWaSheet, ti), '_blank'); setShowWaSheet(null) }}
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
              <p className="text-xs font-semibold text-[#1D1E20]">{selected.size} invitados seleccionados</p>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <BulkMenuContent
                onClose={() => setShowMobileBulkSheet(false)}
                onBulkUpdateStatus={bulkUpdateStatus}
                onBulkDelete={bulkDelete}
                onOpenCompanionModal={() => { setBulkCompanionCount(1); setShowBulkCompanionModal(true) }}
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