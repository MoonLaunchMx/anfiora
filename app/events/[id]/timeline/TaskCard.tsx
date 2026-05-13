'use client'

import { Bell, AlertTriangle, Clock, Building2, CheckCircle2, Circle, Star, RotateCcw, Calendar } from 'lucide-react'
import { TimelineTask } from '@/lib/types'

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

const REMINDER_OPTIONS = [
  { value: '15min',  label: '15 minutos antes', minutes: 15 },
  { value: '30min',  label: '30 minutos antes', minutes: 30 },
  { value: '1h',     label: '1 hora antes',     minutes: 60 },
  { value: '2h',     label: '2 horas antes',    minutes: 120 },
  { value: '1d',     label: '1 día antes',      minutes: 60 * 24 },
  { value: '2d',     label: '2 días antes',     minutes: 60 * 24 * 2 },
  { value: '1w',     label: '1 semana antes',   minutes: 60 * 24 * 7 },
  { value: 'custom', label: 'Fecha personalizada', minutes: null },
]

export type UrgencyLevel = 'overdue' | 'today' | 'tomorrow' | 'normal' | 'done'

export function getUrgency(task: TimelineTask): UrgencyLevel {
  if (task.is_completed) return 'done'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const [y, m, d] = task.task_date.split('-').map(Number)
  const taskDay = new Date(y, m - 1, d)
  if (taskDay < today) return 'overdue'
  if (taskDay.getTime() === today.getTime()) return 'today'
  if (taskDay.getTime() === tomorrow.getTime()) return 'tomorrow'
  return 'normal'
}

export const URGENCY_DOT: Record<UrgencyLevel, string> = {
  overdue:  'bg-[#dc2626]',
  today:    'bg-[#d97706]',
  tomorrow: 'bg-[#d0d0d0]',
  normal:   'bg-[#d0d0d0]',
  done:     'bg-[#e8e8e8]',
}

const URGENCY_DATE_COLOR: Record<UrgencyLevel, string> = {
  overdue:  'text-[#dc2626]',
  today:    'text-[#d97706]',
  tomorrow: 'text-[#888]',
  normal:   'text-[#888]',
  done:     'text-[#bbb]',
}

export function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`
}

export function formatDate(d: string) {
  const [, month, day] = d.split('-').map(Number)
  return `${day} ${MONTH_NAMES[month - 1].slice(0, 3).toLowerCase()}`
}

export function formatDateFull(taskDate: string, taskTime: string | null, urgency: UrgencyLevel): string {
  if (urgency === 'overdue')  return `Vencida · ${formatDate(taskDate)}`
  if (urgency === 'today')    return taskTime ? `Hoy · ${formatTime(taskTime)}` : 'Hoy'
  if (urgency === 'tomorrow') return taskTime ? `Mañana · ${formatTime(taskTime)}` : 'Mañana'
  return taskTime ? `${formatDate(taskDate)} · ${formatTime(taskTime)}` : formatDate(taskDate)
}

export function getCat(v: string) {
  return CATEGORIES.find(c => c.value === v) || CATEGORIES[7]
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

export function formatReminderLabel(reminderDate: string, taskDate: string, taskTime: string | null): string {
  const base = taskTime || '09:00'
  const [y, mo, d] = taskDate.split('-').map(Number)
  const [h, min] = base.split(':').map(Number)
  const baseTs = new Date(y, mo - 1, d, h, min).getTime()
  const remTs  = new Date(reminderDate).getTime()
  const diffMin = Math.round((baseTs - remTs) / 60000)
  const match = REMINDER_OPTIONS.find(o => o.minutes === diffMin)
  if (match) return match.label
  const rd = new Date(reminderDate)
  return `${rd.getDate()} ${MONTH_NAMES[rd.getMonth()].slice(0, 3)} ${rd.getHours()}:${rd.getMinutes().toString().padStart(2, '0')}`
}

function openGoogleCalendar(task: TimelineTask) {
  const [year, month, day] = task.task_date.split('-').map(Number)
  const pad = (n: number) => n.toString().padStart(2, '0')
  let dates: string
  if (task.task_time) {
    const [h, m] = task.task_time.split(':').map(Number)
    const endH = h + 1 >= 24 ? 23 : h + 1
    dates = `${year}${pad(month)}${pad(day)}T${pad(h)}${pad(m)}00/${year}${pad(month)}${pad(day)}T${pad(endH)}${pad(m)}00`
  } else {
    const next = new Date(year, month - 1, day + 1)
    dates = `${year}${pad(month)}${pad(day)}/${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`
  }
  const title   = encodeURIComponent(`${task.emoji ? task.emoji + ' ' : ''}${task.title}`)
  const details = task.notes ? encodeURIComponent(task.notes) : ''
  window.open(
    'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + title + '&dates=' + dates + (details ? '&details=' + details : ''),
    '_blank', 'noopener,noreferrer'
  )
}

export function CategoryIcon({ category }: { category: string }) {
  const cls = "w-4 h-4 fill-none stroke-[1.5px] stroke-[#888]"
  const icons: Record<string, React.JSX.Element> = {
    evento:       <svg viewBox="0 0 24 24" className={cls} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
    tarea:        <svg viewBox="0 0 24 24" className={cls} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
    recordatorio: <svg viewBox="0 0 24 24" className={cls} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
    reunion:      <svg viewBox="0 0 24 24" className={cls} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    entrega:      <svg viewBox="0 0 24 24" className={cls} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    pago:         <svg viewBox="0 0 24 24" className={cls} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
    comunicacion: <svg viewBox="0 0 24 24" className={cls} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    otro:         <svg viewBox="0 0 24 24" className={cls} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>,
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-[#f8f8f8] border border-[#e8e8e8] flex items-center justify-center flex-shrink-0">
      {icons[category] || icons.otro}
    </div>
  )
}

export function CalendarTaskIcon({ category }: { category: string }) {
  const props = {
    width: 10, height: 10, viewBox: '0 0 24 24', fill: 'none',
    stroke: '#888', strokeWidth: 2,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    className: 'flex-shrink-0',
  }
  const icons: Record<string, React.JSX.Element> = {
    evento:       <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
    tarea:        <svg {...props}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
    recordatorio: <svg {...props}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
    reunion:      <svg {...props}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    entrega:      <svg {...props}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    pago:         <svg {...props}><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
    comunicacion: <svg {...props}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    otro:         <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>,
  }
  return icons[category] || icons.otro
}

interface TaskCardProps {
  t: TimelineTask
  onEdit: (t: TimelineTask) => void
  onToggleCompleted: (t: TimelineTask) => void
}

export function TaskCard({ t, onEdit, onToggleCompleted }: TaskCardProps) {
  const urgency      = getUrgency(t)
  const dateColor    = URGENCY_DATE_COLOR[urgency]
  const isBlocking   = t.priority === 'bloqueante'
  const supplierName = t.event_supplier?.supplier?.name || null
  // ← FIX: fallback a email si full_name es null
  const ownerLabel   = t.assigned_user?.full_name || t.assigned_user?.email || t.assigned_to_name || null

  return (
    <div
      onClick={() => onEdit(t)}
      className={[
        'flex-1 ml-3 my-1 bg-white border border-[#e8e8e8] cursor-pointer rounded-xl transition-all hover:border-[#c8c8c8] hover:shadow-sm',
        t.is_completed ? 'opacity-45' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3 px-4 pt-3 pb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1.5">
            <p className={[
              'text-sm font-medium leading-snug flex-1 min-w-0',
              t.is_completed ? 'line-through text-[#bbb]' : 'text-[#1D1E20]',
            ].join(' ')}>
              {t.emoji && <span className="mr-1">{t.emoji}</span>}
              {t.title}
            </p>
            {isBlocking && (
              <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-medium text-white bg-[#1D1E20] px-1.5 py-0.5 rounded mt-0.5">
                <AlertTriangle size={9} />Bloqueante
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={'flex items-center gap-1 text-[11px] font-medium ' + dateColor}>
              <Clock size={10} className="flex-shrink-0" />
              {formatDateFull(t.task_date, t.task_time, urgency)}
            </span>
            {supplierName && (
              <>
                <span className="text-[#e0e0e0] text-[10px]">·</span>
                <span className="flex items-center gap-1 text-[11px] text-[#48C9B0]">
                  <Building2 size={10} className="flex-shrink-0" />{supplierName}
                </span>
              </>
            )}
            {ownerLabel && (
              <>
                <span className="text-[#e0e0e0] text-[10px]">·</span>
                <span className="flex items-center gap-1 text-[11px] text-[#888]">
                  <span className="w-4 h-4 rounded-full bg-[#e0f7f2] text-[#0F6E56] text-[8px] font-semibold flex items-center justify-center flex-shrink-0">
                    {getInitials(ownerLabel)}
                  </span>
                  {ownerLabel}
                </span>
              </>
            )}
            <span className="text-[#e0e0e0] text-[10px]">·</span>
            <span className="text-[10px] text-[#bbb]">{getCat(t.category).label}</span>
            {t.reminder_date && (
              <>
                <span className="text-[#e0e0e0] text-[10px]">·</span>
                <span className="flex items-center gap-1 text-[10px] text-[#48C9B0]">
                  <Bell size={9} />
                  {formatReminderLabel(t.reminder_date, t.task_date, t.task_time)}
                </span>
              </>
            )}
          </div>

          {t.notes && !t.is_completed && (
            <p className="hidden sm:block mt-1.5 text-[11px] text-[#bbb] leading-relaxed line-clamp-1">
              {t.notes}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          {t.is_highlighted && <Star size={13} className="text-amber-400 fill-amber-400" />}
          <button
            onClick={e => { e.stopPropagation(); onToggleCompleted(t) }}
            className="flex-shrink-0"
          >
            {t.is_completed
              ? <CheckCircle2 size={18} className="text-[#48C9B0]" />
              : <Circle size={18} className="text-[#ddd] hover:text-[#48C9B0] transition-colors" />
            }
          </button>
        </div>
      </div>

      {!t.is_completed && (
        <div className="hidden sm:flex items-center border-t border-[#f5f5f5] px-4 py-1.5">
          <button
            onClick={e => { e.stopPropagation(); onToggleCompleted(t) }}
            className="flex items-center gap-1.5 text-[11px] text-[#48C9B0] font-medium hover:text-[#3ab89f] pr-3 transition-colors"
          >
            <CheckCircle2 size={12} />Completar
          </button>
          <span className="text-[#e8e8e8] text-xs">|</span>
          <button
            onClick={e => { e.stopPropagation(); onEdit(t) }}
            className="flex items-center gap-1.5 text-[11px] text-[#aaa] hover:text-[#555] px-3 transition-colors"
          >
            <RotateCcw size={11} />Reagendar
          </button>
          <span className="text-[#e8e8e8] text-xs">|</span>
          <button
            onClick={e => { e.stopPropagation(); openGoogleCalendar(t) }}
            className="flex items-center gap-1.5 text-[11px] text-[#aaa] hover:text-[#555] px-3 transition-colors"
          >
            <Calendar size={11} />Google Calendar
          </button>
        </div>
      )}
    </div>
  )
}