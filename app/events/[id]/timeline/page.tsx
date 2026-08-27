'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TimelineTask } from '@/lib/types'
import {
  CalendarDays, CheckCircle2, Circle, Plus,
  ChevronDown, ChevronLeft, ChevronRight,
  LayoutList, Search, SlidersHorizontal, X, AlertTriangle, Clock,
} from 'lucide-react'
import StatsCollapse, { StatsToggleButton, useStatsToggle } from '@/app/components/ui/StatsCollapse'
import { useConfirm } from '@/app/components/ui/ConfirmModal'
import { TaskCard, CategoryIcon, CalendarTaskIcon, getUrgency, formatDateFull } from './TaskCard'
import { TaskModal } from './TaskModal'
import { buildTimelineTasks } from './lib/templates'
import { ItineraryView } from './ItineraryView'
import { ItineraryAddButton, ItineraryToolbar } from './ItineraryToolbar'
import { useItinerary } from './useItinerary'
import { TabToggle, type TabItem } from '@/app/components/ui/TabToggle'
import { Modal } from '@/app/components/ui/Modal'

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'evento',        label: 'Evento' },
  { value: 'tarea',         label: 'Tarea' },
  { value: 'recordatorio',  label: 'Recordatorio' },
  { value: 'reunion',       label: 'Reunión' },
  { value: 'entrega',       label: 'Entrega' },
  { value: 'pago',          label: 'Pago' },
  { value: 'comunicacion',  label: 'Comunicación' },
  { value: 'otro',          label: 'Otro' },
]

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAY_NAMES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function groupByMonth(tasks: TimelineTask[]) {
  const groups: Record<string, TimelineTask[]> = {}
  tasks.forEach(t => {
    const [year, month] = t.task_date.split('-')
    const key = `${year}-${month}`
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  })
  return groups
}

// ─── DAY MODAL ────────────────────────────────────────────────────────────────

interface DayModalProps {
  dateKey: string
  tasks: TimelineTask[]
  onClose: () => void
  onEdit: (t: TimelineTask) => void
  onToggleCompleted: (t: TimelineTask) => void
  onAddNew: (date: string) => void
}

function DayModal({ dateKey, tasks, onClose, onEdit, onToggleCompleted, onAddNew }: DayModalProps) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return (
    <Modal open onClose={onClose} size="sm">
      <Modal.Header
        title={`${day} de ${MONTH_NAMES[month - 1]} ${year}`}
        subtitle={tasks.length === 0 ? 'Sin tareas' : `${tasks.length} tarea${tasks.length !== 1 ? 's' : ''}`}
      />
      <Modal.Body className="flex flex-col gap-2">
          {tasks.length === 0 ? (
            <div className="py-6 text-center"><p className="text-sm text-[#888]">Sin tareas este día</p></div>
          ) : tasks.map(t => {
            const urgency = getUrgency(t)
            return (
              <div key={t.id} onClick={() => onEdit(t)}
                className={['bg-white border rounded-xl p-3 cursor-pointer hover:border-[#c8c8c8] transition-all border-[#e8e8e8]', t.is_completed ? 'opacity-50' : ''].join(' ')}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={['text-sm font-medium', t.is_completed ? 'line-through text-[#bbb]' : 'text-[#1D1E20]'].join(' ')}>
                      {t.emoji && <span className="mr-1">{t.emoji}</span>}{t.title}
                    </p>
                    <span className={'text-[11px] font-medium ' + (urgency === 'overdue' || urgency === 'today' ? 'text-[#d97706]' : 'text-[#888]')}>
                      {formatDateFull(t.task_date, t.task_time, urgency)}
                    </span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); onToggleCompleted(t) }} className="flex-shrink-0 mt-0.5">
                    {t.is_completed
                      ? <CheckCircle2 size={16} className="text-[#48C9B0]" />
                      : <Circle size={16} className="text-[#ccc]" />}
                  </button>
                </div>
              </div>
            )
          })}
      </Modal.Body>
      <Modal.Footer>
        <button onClick={() => onAddNew(dateKey)}
          className="flex items-center gap-1.5 w-full justify-center py-2.5 text-sm font-medium text-[#48C9B0] border border-dashed border-[#48C9B0] rounded-xl hover:bg-[#f0fdfb] transition-colors">
          <Plus size={13} />Agregar tarea este día
        </button>
      </Modal.Footer>
    </Modal>
  )
}

// ─── FILTER DRAWER ────────────────────────────────────────────────────────────

interface FilterDrawerProps {
  search: string
  category: string
  onSearch: (v: string) => void
  onCategory: (v: string) => void
  onClose: () => void
  onClear: () => void
}

function FilterDrawer({ search, category, onSearch, onCategory, onClose, onClear }: FilterDrawerProps) {
  const hasFilters = search.trim() !== '' || category !== ''
  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header title="Filtrar" />
      <Modal.Body>
        <div className="mb-4">
          <label className="text-xs font-medium text-[#555] mb-1.5 block">Buscar</label>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb]" />
            <input type="text" value={search} onChange={e => onSearch(e.target.value)}
              placeholder="Título o notas..."
              className="w-full border border-[#e0e0e0] rounded-xl pl-8 pr-3 py-2.5 text-base focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8]" />
            {search && (
              <button onClick={() => onSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#bbb]">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-[#555] mb-1.5 block">Categoría</label>
          <div className="relative">
            <select value={category} onChange={e => onCategory(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-xl px-3 py-2.5 text-base appearance-none focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8]">
              <option value="">Todas las categorías</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-3.5 text-[#aaa] pointer-events-none" />
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        {hasFilters && (
          <button onClick={onClear} className="flex-1 py-2.5 text-sm border border-[#e0e0e0] rounded-xl text-[#888] hover:bg-[#f8f8f8]">
            Limpiar
          </button>
        )}
        <button onClick={onClose} className="flex-[2] py-2.5 text-sm bg-[#48C9B0] text-white rounded-xl font-semibold hover:bg-[#3ab89f]">
          Aplicar
        </button>
      </Modal.Footer>
    </Modal>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const searchParams    = useSearchParams()
  const { id: eventId } = useParams<{ id: string }>()
  const router          = useRouter()

  const { visible: statsVisible, toggle: toggleStats } = useStatsToggle(eventId, 'timeline')
  const askConfirm = useConfirm()

  const [tasks, setTasks]             = useState<TimelineTask[]>([])
  const [loading, setLoading]         = useState(true)
  const [section, setSection]         = useState<'tareas' | 'itinerario'>('tareas')
  const [view, setView]               = useState<'lista' | 'calendario'>('lista')
  const [showModal, setShowModal]     = useState(false)
  const [editTask, setEditTask]       = useState<TimelineTask | null>(null)
  const [prefillDate, setPrefillDate] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [calMonth, setCalMonth]       = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [search, setSearch]           = useState('')
  const [filterCat, setFilterCat]     = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [eventInfo, setEventInfo]     = useState<{ event_date: string | null; event_end_date: string | null; event_type: string | null; event_category: string | null; event_time: string | null } | null>(null)
  const [generating, setGenerating]   = useState(false)

  const itinEventInfo = useMemo(
    () => eventInfo ? { ...eventInfo, venue: null } : null,
    [eventInfo],
  )
  const itinerary = useItinerary(eventId, itinEventInfo, section === 'itinerario')

  const hasActiveFilters = search.trim() !== '' || filterCat !== ''

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from('event_timeline_tasks')
      .select(`
        *,
        assigned_user:assigned_to_user_id(id, full_name, email),
        event_supplier:event_supplier_id(id, supplier:supplier_id(id, name))
      `)
      .eq('event_id', eventId)
      .order('task_date', { ascending: true })
      .order('task_time', { ascending: true, nullsFirst: true })
    setTasks((data || []) as TimelineTask[])
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    let redirected = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' && !session && !redirected) {
        redirected = true
        router.replace('/')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/'); return }
      fetchTasks()
    })
  }, [eventId, fetchTasks])

  useEffect(() => {
    supabase
      .from('events')
      .select('event_date, event_end_date, event_type, event_category, event_time')
      .eq('id', eventId)
      .single()
      .then(({ data }) => { if (data) setEventInfo(data) })
  }, [eventId])

  useEffect(() => {
    if (!tasks.length) return
    const taskId = searchParams.get('task')
    if (!taskId) return
    const found = tasks.find(t => t.id === taskId)
    if (found) {
      openEdit(found)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [tasks])

  const openNew     = (date?: string) => { setEditTask(null); setPrefillDate(date || null); setShowModal(true) }
  const openEdit    = (t: TimelineTask) => { setEditTask(t); setPrefillDate(null); setShowModal(true) }
  const closeModal  = () => { setShowModal(false); setEditTask(null); setPrefillDate(null) }
  const handleSaved = () => { closeModal(); fetchTasks(); setSelectedDay(null) }

  const handleGeneratePlan = async () => {
    if (!eventInfo?.event_date || generating) return
    if (tasks.length > 0) {
      const ok = await askConfirm({
        title: '¿Agregar las tareas sugeridas?',
        message: 'Se suman las que falten para tu tipo de evento. Las que ya tienes no se duplican.',
        confirmLabel: 'Agregar',
        tone: 'default',
      })
      if (!ok) return
    }
    setGenerating(true)
    const existing = new Set(tasks.map(t => t.title.toLowerCase()))
    const rows = buildTimelineTasks(eventId, eventInfo.event_type, eventInfo.event_category, eventInfo.event_date, existing)
    if (rows.length > 0) await supabase.from('event_timeline_tasks').insert(rows)
    await fetchTasks()
    setGenerating(false)
  }

  const toggleCompleted = async (t: TimelineTask) => {
    await supabase.from('event_timeline_tasks').update({ is_completed: !t.is_completed }).eq('id', t.id)
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, is_completed: !x.is_completed } : x))
  }

  const clearFilters = () => { setSearch(''); setFilterCat('') }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const total     = tasks.length
  const completed = tasks.filter(t => t.is_completed).length
  const pending   = tasks.filter(t => !t.is_completed).length
  const blocking  = tasks.filter(t => t.priority === 'bloqueante' && !t.is_completed).length

  const filteredTasks = useMemo(() => {
    let result = tasks
    if (filterCat) result = result.filter(t => t.category === filterCat)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      )
    }
    return result
  }, [tasks, filterCat, search])

  const grouped = useMemo(() => groupByMonth(filteredTasks), [filteredTasks])

  const calDays = () => {
    const { year, month } = calMonth
    return {
      firstDay:    new Date(year, month, 1).getDay(),
      daysInMonth: new Date(year, month + 1, 0).getDate(),
    }
  }

  const tasksByDay = (day: number) => {
    const pad = (n: number) => n.toString().padStart(2, '0')
    const key = `${calMonth.year}-${pad(calMonth.month + 1)}-${pad(day)}`
    return tasks.filter(t => t.task_date === key)
  }

  const selectedDayTasks = selectedDay ? filteredTasks.filter(t => t.task_date === selectedDay) : []

  // ─── LIST VIEW ──────────────────────────────────────────────────────────────

  const ListView = () => {
    if (filteredTasks.length === 0) {
      return (
        <div className="mt-5 rounded-xl border border-dashed border-[#e0e0e0] px-6 py-14 text-center">
          <p className="text-sm text-[#888]">
            {hasActiveFilters ? 'Sin resultados para estos filtros' : 'Sin tareas en el timeline'}
          </p>
          {hasActiveFilters
            ? <button onClick={clearFilters} className="mt-3 text-sm text-[#48C9B0] font-medium hover:underline">Limpiar filtros</button>
            : (
              <div className="mt-4 flex flex-col items-center gap-3">
                <button
                  onClick={handleGeneratePlan}
                  disabled={!eventInfo?.event_date || generating}
                  className="rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-50"
                >
                  {generating ? 'Generando...' : 'Generar plan sugerido'}
                </button>
                {!eventInfo?.event_date
                  ? <p className="text-xs text-[#bbb]">Primero define la fecha del evento</p>
                  : <button onClick={() => openNew()} className="text-sm text-[#888] hover:text-[#48C9B0]">o agrega una tarea manual</button>}
              </div>
            )
          }
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-0">
        {Object.entries(grouped).map(([key, monthTasks]) => {
          const [year, month] = key.split('-').map(Number)
          return (
            <div key={key}>
              <p className="text-[10px] font-semibold text-[#aaa] uppercase tracking-widest pl-12 py-2.5">
                {MONTH_NAMES[month - 1]} {year}
              </p>
              {monthTasks.map((t, i) => (
                <div key={t.id} className="flex items-stretch">
                  <div className="w-12 flex flex-col items-center flex-shrink-0">
                    <div className={`w-px bg-[#ebebeb] ${i === 0 ? 'min-h-[10px]' : 'min-h-[14px]'} flex-shrink-0`} />
                    <CategoryIcon category={t.category} />
                    <div className="w-px bg-[#ebebeb] flex-1 min-h-[16px]" />
                  </div>
                  <TaskCard t={t} onEdit={openEdit} onToggleCompleted={toggleCompleted} />
                </div>
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  // ─── CALENDAR VIEW ──────────────────────────────────────────────────────────

  const CalendarView = () => {
    const { firstDay, daysInMonth } = calDays()
    const blanks = Array(firstDay).fill(null)
    const days   = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    const pad    = (n: number) => n.toString().padStart(2, '0')
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCalMonth(m => { const d = new Date(m.year, m.month - 1); return { year: d.getFullYear(), month: d.getMonth() } })}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e0e0] text-[#888] hover:border-[#48C9B0] hover:text-[#48C9B0] transition"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-semibold text-[#1D1E20]">{MONTH_NAMES[calMonth.month]} {calMonth.year}</span>
          <button
            onClick={() => setCalMonth(m => { const d = new Date(m.year, m.month + 1); return { year: d.getFullYear(), month: d.getMonth() } })}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e0e0] text-[#888] hover:border-[#48C9B0] hover:text-[#48C9B0] transition"
          >
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map(d => <div key={d} className="text-[11px] font-medium text-[#aaa] text-center py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {blanks.map((_, i) => <div key={'b' + i} />)}
          {days.map(day => {
            const dayTasks  = tasksByDay(day)
            const dateKey   = `${calMonth.year}-${pad(calMonth.month + 1)}-${pad(day)}`
            const isToday   = dateKey === new Date().toISOString().split('T')[0]
            const hasTasks  = dayTasks.length > 0
            const hasUrgent = dayTasks.some(t => { const u = getUrgency(t); return u === 'today' || u === 'overdue' })
            return (
              <button key={day} onClick={() => setSelectedDay(dateKey)}
                className={['relative flex flex-col items-center rounded-xl p-1 min-h-[64px] transition-all border border-transparent', hasTasks ? 'hover:border-[#48C9B0] hover:bg-[#f0fdfb]' : 'hover:bg-[#f8f8f8]'].join(' ')}>
                <span className={['text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0', isToday ? 'bg-[#48C9B0] text-white' : 'text-[#1D1E20]'].join(' ')}>
                  {day}
                </span>
                {hasTasks && (
                  <div className="flex flex-col gap-0.5 w-full mt-1 items-center">
                    {dayTasks.slice(0, 3).map(t => (
                      <div key={t.id} className={['flex items-center gap-1 w-full px-0.5', t.is_completed ? 'opacity-30' : ''].join(' ')}>
                        <CalendarTaskIcon category={t.category} />
                        <span className="hidden sm:block text-[10px] text-[#888] truncate leading-tight flex-1 min-w-0">{t.title}</span>
                      </div>
                    ))}
                    {dayTasks.length > 3 && <span className="text-[9px] text-[#aaa] mt-0.5">+{dayTasks.length - 3}</span>}
                    {hasUrgent && <div className="w-1 h-1 rounded-full bg-[#d97706] mt-0.5" />}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const TIMELINE_SECTIONS: TabItem[] = [
    { key: 'tareas', label: 'Tareas', icon: LayoutList },
    { key: 'itinerario', label: 'Itinerario', icon: Clock },
  ]

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'visible', background: '#ffffff', color: '#1D1E20' }}>

      <div style={{ flexShrink: 0, borderBottom: '1px solid #e8e8e8' }} className="px-4 pt-4 pb-0 sm:px-6 sm:pt-5 lg:px-10 lg:pt-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-[#1D1E20] sm:text-xl lg:text-2xl">Timeline e Itinerario</h1>
            <p className="mt-0.5 text-xs text-[#888] sm:text-sm">Las tareas de tu evento y el itinerario del gran día</p>
          </div>
          <div className="lg:hidden shrink-0 pt-1">
            <StatsToggleButton visible={statsVisible} onClick={toggleStats} />
          </div>
        </div>

        <StatsCollapse visible={statsVisible}>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">

            {/* Total */}
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Total</span>
                <CalendarDays size={14} className="text-[#888]" />
              </div>
              <div className="text-xl font-bold text-[#1D1E20]">{total}</div>
              <div className="mt-1 text-[10px] text-[#aaa]">tareas en timeline</div>
            </div>

            {/* Pendientes */}
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Pendientes</span>
                <Circle size={14} className={pending > 0 ? 'text-[#b8860b]' : 'text-[#bbb]'} />
              </div>
              <div className="text-xl font-bold" style={{ color: pending > 0 ? '#b8860b' : '#1D1E20' }}>{pending}</div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e8e8e8]">
                <div className="h-full rounded-full bg-[#f0d080] transition-all" style={{ width: total > 0 ? (pending / total * 100) + '%' : '0%' }} />
              </div>
            </div>

            {/* Completadas */}
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Completadas</span>
                <CheckCircle2 size={14} className="text-[#48C9B0]" />
              </div>
              <div className="text-xl font-bold text-[#1D1E20]">
                {completed}<span className="ml-1.5 text-sm font-normal text-[#aaa]">/ {total}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e8e8e8]">
                <div className="h-full rounded-full bg-[#48C9B0] transition-all" style={{ width: total > 0 ? (completed / total * 100) + '%' : '0%' }} />
              </div>
            </div>

            {/* Bloqueantes — reemplaza Destacadas */}
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Bloqueantes</span>
                <AlertTriangle size={14} className={blocking > 0 ? 'text-[#1D1E20]' : 'text-[#bbb]'} />
              </div>
              <div className="text-xl font-bold text-[#1D1E20]">{blocking}</div>
              {blocking > 0
                ? <div className="mt-1 text-[10px] font-medium text-[#1D1E20]">Tareas que bloquean el evento</div>
                : <div className="mt-1 text-[10px] text-[#aaa]">Sin tareas bloqueantes</div>}
            </div>

          </div>
        </StatsCollapse>

        <div className="mb-3 flex items-center justify-between gap-2 overflow-x-auto sm:justify-start">
          <TabToggle tabs={TIMELINE_SECTIONS} active={section} onChange={(k) => setSection(k as 'tareas' | 'itinerario')} />
          {section === 'itinerario' && (
            <div className="sm:hidden">
              <ItineraryAddButton itin={itinerary} />
            </div>
          )}
        </div>

        {section === 'tareas' ? (
          <div className="mb-3 flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-[#e0e0e0]">
              <button onClick={() => setView('lista')}
                className={['flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition', view === 'lista' ? 'bg-[#1D1E20] text-white' : 'text-[#888] hover:bg-[#f5f5f5]'].join(' ')}>
                <LayoutList width={13} height={13} /><span className="hidden sm:inline">Lista</span>
              </button>
              <button onClick={() => setView('calendario')}
                className={['flex items-center gap-1.5 border-l border-[#e0e0e0] px-3 py-1.5 text-xs font-medium transition', view === 'calendario' ? 'bg-[#1D1E20] text-white' : 'text-[#888] hover:bg-[#f5f5f5]'].join(' ')}>
                <CalendarDays width={13} height={13} /><span className="hidden sm:inline">Calendario</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb]" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar en título o notas..."
                  className="w-full border border-[#e0e0e0] rounded-lg pl-8 pr-8 py-1.5 text-xs focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8]" />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#bbb] hover:text-[#888]">
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="relative">
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                  className="border border-[#e0e0e0] rounded-lg pl-3 pr-8 py-1.5 text-xs appearance-none focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8] text-[#888]">
                  <option value="">Todas las categorías</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#aaa] pointer-events-none" />
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-[#aaa] hover:text-[#cc3333] transition-colors whitespace-nowrap">
                  Limpiar
                </button>
              )}
            </div>

            <button onClick={() => setShowFilters(true)}
              className={['sm:hidden flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition', hasActiveFilters ? 'border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]' : 'border-[#e0e0e0] text-[#888] hover:bg-[#f5f5f5]'].join(' ')}>
              <SlidersHorizontal width={13} height={13} />Filtrar
              {hasActiveFilters && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#48C9B0] text-[9px] font-bold text-white">
                  {(search ? 1 : 0) + (filterCat ? 1 : 0)}
                </span>
              )}
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button onClick={handleGeneratePlan}
                disabled={!eventInfo?.event_date || generating}
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0] disabled:opacity-50">
                <CalendarDays width={13} height={13} />{generating ? 'Generando...' : 'Generar plan'}
              </button>
              <button onClick={() => openNew()}
                className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3ab89f] sm:px-4 sm:text-sm">
                <Plus width={14} height={14} />Agregar
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-3 hidden items-center sm:flex">
            <ItineraryToolbar itin={itinerary} />
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }} className="px-4 pb-6 pt-4 sm:px-6 lg:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
              <p className="text-sm text-[#999]">Cargando...</p>
            </div>
          </div>
        ) : section === 'itinerario' ? (
          <ItineraryView itin={itinerary} />
        ) : view === 'lista' ? <ListView /> : <CalendarView />}
      </div>

      {showModal && (
        <TaskModal
          editTask={editTask}
          prefillDate={prefillDate}
          eventId={eventId}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
      {selectedDay && (
        <DayModal
          dateKey={selectedDay}
          tasks={selectedDayTasks}
          onClose={() => setSelectedDay(null)}
          onEdit={t => { setSelectedDay(null); openEdit(t) }}
          onToggleCompleted={toggleCompleted}
          onAddNew={date => { setSelectedDay(null); openNew(date) }}
        />
      )}
      {showFilters && (
        <FilterDrawer
          search={search}
          category={filterCat}
          onSearch={setSearch}
          onCategory={setFilterCat}
          onClose={() => setShowFilters(false)}
          onClear={clearFilters}
        />
      )}
    </div>
  )
}