'use client'

import { useState } from 'react'
import { Activity, ChevronDown, ChevronUp } from 'lucide-react'
import { AuditEntry, EventOption } from './lib/types'
import { formatDateTime, timeAgo } from './lib/format'

interface Props {
  entries: AuditEntry[]
  loading: boolean
  eventOptions: EventOption[]
  onReload: () => void
}

function getActionColor(action: string): string {
  if (action.includes('created') || action.includes('accepted')) return 'bg-[#e8faf6] text-[#1a7a60]'
  if (action.includes('deleted') || action.includes('revoked'))  return 'bg-[#fee2e2] text-[#cc3333]'
  if (action.includes('updated') || action.includes('invited'))  return 'bg-[#fffbeb] text-[#92400e]'
  if (action.includes('checked_in'))                             return 'bg-[#ede9fe] text-[#5b21b6]'
  return 'bg-[#f0f0f0] text-[#555]'
}

const ACTION_LABELS: Record<string, string> = {
  'guest.created':             'Invitado agregado',
  'guest.updated':             'Invitado editado',
  'guest.deleted':             'Invitado eliminado',
  'guest.rsvp_updated':        'RSVP actualizado',
  'guest.checked_in':          'Check-in realizado',
  'party_member.created':      'Acompanante agregado',
  'party_member.deleted':      'Acompanante eliminado',
  'party_member.rsvp_updated': 'RSVP acompanante',
  'table.created':             'Mesa creada',
  'table.updated':             'Mesa editada',
  'table.deleted':             'Mesa eliminada',
  'table.guest_assigned':      'Invitado asignado a mesa',
  'table.guest_removed':       'Invitado removido de mesa',
  'event.updated':             'Evento editado',
  'event.settings_updated':    'Configuracion actualizada',
  'collaborator.invited':      'Colaborador invitado',
  'collaborator.revoked':      'Acceso revocado',
  'collaborator.accepted':     'Invitacion aceptada',
}

export default function ActividadTab({ entries, loading, eventOptions, onReload }: Props) {
  const [selectedEvent, setSelectedEvent] = useState('all')
  const [actionFilter, setActionFilter]   = useState('all')
  const [expanded, setExpanded]           = useState<string | null>(null)

  const filtered = entries.filter(e => {
    const matchEvent  = selectedEvent === 'all' || e.event_id === selectedEvent
    const matchAction = actionFilter === 'all' || e.action.startsWith(actionFilter)
    return matchEvent && matchAction
  })

  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e8e8e8] px-4 py-3">
        <select
          value={selectedEvent}
          onChange={e => setSelectedEvent(e.target.value)}
          className="rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#555] outline-none focus:border-[#48C9B0]"
        >
          <option value="all">Todos los eventos</option>
          {eventOptions.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#555] outline-none focus:border-[#48C9B0]"
        >
          <option value="all">Todas las acciones</option>
          <option value="guest">Invitados</option>
          <option value="party_member">Acompanantes</option>
          <option value="table">Mesas</option>
          <option value="event">Evento</option>
          <option value="collaborator">Colaboradores</option>
        </select>

        <button
          onClick={onReload}
          className="rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#555] transition hover:bg-[#f5f5f5]"
        >
          Recargar
        </button>

        <span className="text-xs text-[#888]">{filtered.length + ' registros'}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#48C9B0] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <Activity size={32} className="mx-auto mb-3 text-[#ddd]" />
          <p className="text-sm text-[#888]">Sin actividad registrada</p>
          <p className="mt-1 text-xs text-[#bbb]">Las acciones apareceran aqui una vez que integres logAction() en las mutaciones</p>
        </div>
      ) : (
        <div className="divide-y divide-[#f8f8f8]">
          {filtered.map(entry => (
            <div key={entry.id}>
              <div
                className="flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-[#fafafa]"
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              >
                <span className={'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ' + getActionColor(entry.action)}>
                  {ACTION_LABELS[entry.action] || entry.action}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-[#1D1E20]">
                      {entry.user_name || entry.user_email}
                    </span>
                    {entry.entity_label && (
                      <>
                        <span className="text-[#ccc] text-xs">·</span>
                        <span className="text-xs text-[#888]">{entry.entity_label}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[10px] text-[#bbb]">{timeAgo(entry.created_at)}</span>
                    {eventOptions.find(e => e.id === entry.event_id) && (
                      <>
                        <span className="text-[#e0e0e0] text-[10px]">·</span>
                        <span className="text-[10px] text-[#bbb]">
                          {eventOptions.find(e => e.id === entry.event_id)?.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-[#bbb]">{formatDateTime(entry.created_at)}</p>
                  {(entry.old_value || entry.new_value) && (
                    expanded === entry.id
                      ? <ChevronUp size={12} className="ml-auto mt-1 text-[#bbb]" />
                      : <ChevronDown size={12} className="ml-auto mt-1 text-[#bbb]" />
                  )}
                </div>
              </div>

              {expanded === entry.id && (entry.old_value || entry.new_value) && (
                <div className="border-t border-[#f5f5f5] bg-[#fafafa] px-4 py-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {entry.old_value && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#bbb]">Antes</p>
                        <pre className="overflow-x-auto rounded-lg border border-[#e8e8e8] bg-white p-2 text-[11px] text-[#666]">
                          {JSON.stringify(entry.old_value, null, 2)}
                        </pre>
                      </div>
                    )}
                    {entry.new_value && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#bbb]">Despues</p>
                        <pre className="overflow-x-auto rounded-lg border border-[#e8e8e8] bg-white p-2 text-[11px] text-[#666]">
                          {JSON.stringify(entry.new_value, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
