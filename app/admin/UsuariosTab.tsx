'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Mail, Ban, Trash2, CheckCircle } from 'lucide-react'
import { AdminUser, GlobalStats } from './lib/types'
import { formatDate, timeAgo, PLAN_STYLES } from './lib/format'

interface Props {
  users: AdminUser[]
  stats: GlobalStats | null
  actionLoading: string | null
  onChangePlan: (userId: string, plan: string) => void
  onAdminAction: (userId: string, action: 'delete' | 'ban' | 'unban') => void
  onConfirmDelete: (u: AdminUser) => void
}

type SortBy = 'created_at' | 'event_count' | 'guest_count' | 'last_sign_in'

export default function UsuariosTab({ users, stats, actionLoading, onChangePlan, onAdminAction, onConfirmDelete }: Props) {
  const [search, setSearch]         = useState('')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [sortBy, setSortBy]         = useState<SortBy>('created_at')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = users
    .filter(u => {
      const matchSearch = search === '' ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.full_name || '').toLowerCase().includes(search.toLowerCase())
      const matchPlan = planFilter === 'all' || u.plan === planFilter
      return matchSearch && matchPlan
    })
    .sort((a, b) => {
      if (sortBy === 'event_count')  return b.event_count - a.event_count
      if (sortBy === 'guest_count')  return b.guest_count - a.guest_count
      if (sortBy === 'last_sign_in') return new Date(b.last_sign_in || 0).getTime() - new Date(a.last_sign_in || 0).getTime()
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  return (
    <>
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
            <p className="text-xs text-[#888]">Usuarios totales</p>
            <p className="mt-1 text-2xl font-bold text-[#1D1E20]">{stats.total_users}</p>
            <p className="mt-1 text-xs text-[#48C9B0]">{'+' + stats.new_users_7d + ' esta semana'}</p>
          </div>
          <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
            <p className="text-xs text-[#888]">Por plan</p>
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#888]">Free</span>
                <span className="text-xs font-semibold text-[#1D1E20]">{stats.free_users}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#48C9B0]">Pro</span>
                <span className="text-xs font-semibold text-[#1D1E20]">{stats.pro_users}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#f59e0b]">Agency</span>
                <span className="text-xs font-semibold text-[#1D1E20]">{stats.agency_users}</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
            <p className="text-xs text-[#888]">Eventos totales</p>
            <p className="mt-1 text-2xl font-bold text-[#1D1E20]">{stats.total_events}</p>
            <p className="mt-1 text-xs text-[#48C9B0]">{'+' + stats.new_events_7d + ' esta semana'}</p>
          </div>
          <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
            <p className="text-xs text-[#888]">Personas totales</p>
            <p className="mt-1 text-2xl font-bold text-[#1D1E20]">{stats.total_guests}</p>
            <p className="mt-1 text-xs text-[#888]">invitados + acomp.</p>
          </div>
          <div className="rounded-xl border border-[#e8e8e8] bg-white p-4 sm:col-span-2">
            <p className="mb-2 text-xs text-[#888]">RSVPs globales</p>
            <div className="space-y-1.5">
              {[
                { label: 'Confirmados', val: stats.confirmed, color: 'bg-[#48C9B0]', text: 'text-[#2a7a50]' },
                { label: 'Pendientes',  val: stats.pending,   color: 'bg-[#f59e0b]', text: 'text-[#b8860b]' },
                { label: 'Declinados',  val: stats.declined,  color: 'bg-[#ef4444]', text: 'text-[#cc3333]' },
              ].map(({ label, val, color, text }) => (
                <div key={label}>
                  <div className="mb-0.5 flex justify-between text-xs">
                    <span className={text}>{label}</span>
                    <span className="font-medium text-[#1D1E20]">{val}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#f0f0f0]">
                    <div className={'h-1.5 rounded-full ' + color} style={{ width: stats.total_guests ? Math.round(val / stats.total_guests * 100) + '%' : '0%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#e8e8e8] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#e8e8e8] px-4 py-3">
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-sm text-[#1D1E20] outline-none focus:border-[#48C9B0] min-w-[180px]"
          />
          <div className="flex gap-2">
            {['all', 'free', 'pro', 'agency'].map(p => (
              <button key={p} onClick={() => setPlanFilter(p)}
                className={'rounded-lg px-3 py-1.5 text-xs font-medium transition ' + (planFilter === p ? 'bg-[#48C9B0] text-white' : 'border border-[#e0e0e0] text-[#555] hover:bg-[#f5f5f5]')}>
                {p === 'all' ? 'Todos' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
            className="rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#555] outline-none">
            <option value="created_at">Mas recientes</option>
            <option value="event_count">Mas eventos</option>
            <option value="guest_count">Mas invitados</option>
            <option value="last_sign_in">Ultimo login</option>
          </select>
          <span className="text-xs text-[#888]">{filtered.length + ' usuario' + (filtered.length !== 1 ? 's' : '')}</span>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f0f0f0] text-left">
                <th className="px-4 py-3 text-xs font-medium text-[#888]">Usuario</th>
                <th className="px-4 py-3 text-xs font-medium text-[#888]">Plan</th>
                <th className="px-4 py-3 text-xs font-medium text-[#888]">Eventos</th>
                <th className="px-4 py-3 text-xs font-medium text-[#888]">Inv / Acomp / Total</th>
                <th className="px-4 py-3 text-xs font-medium text-[#888]">Registro</th>
                <th className="px-4 py-3 text-xs font-medium text-[#888]">Ultimo login</th>
                <th className="px-4 py-3 text-xs font-medium text-[#888]">Cambiar plan</th>
                <th className="px-4 py-3 text-xs font-medium text-[#888]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-[#888]">Sin resultados</td></tr>
              ) : filtered.map(u => (
                <>
                  <tr key={u.id}
                    className={'border-b border-[#f8f8f8] transition hover:bg-[#fafafa] cursor-pointer' + (u.banned ? ' opacity-50' : '')}
                    onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {expandedId === u.id ? <ChevronUp size={14} className="text-[#aaa] shrink-0" /> : <ChevronDown size={14} className="text-[#aaa] shrink-0" />}
                        <div>
                          <p className="font-medium text-[#1D1E20]">{u.full_name || '—'}</p>
                          <p className="text-xs text-[#888]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (PLAN_STYLES[u.plan] || PLAN_STYLES.free)}>{u.plan}</span>
                      {u.banned && <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">suspendido</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#1D1E20]">{u.event_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-medium text-[#1D1E20]">{u.guest_count}</span>
                        <span className="text-[#ccc]">/</span>
                        <span className="text-[#888]">{u.party_count}</span>
                        <span className="text-[#ccc]">/</span>
                        <span className="font-semibold text-[#48C9B0]">{u.total_count}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#888]">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-xs text-[#888]">{u.last_sign_in ? timeAgo(u.last_sign_in) : '—'}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <select value={u.plan} onChange={e => onChangePlan(u.id, e.target.value)}
                        className="rounded-lg border border-[#e0e0e0] px-2 py-1 text-xs text-[#555] outline-none hover:border-[#48C9B0]">
                        <option value="free">free</option>
                        <option value="pro">pro</option>
                        <option value="agency">agency</option>
                      </select>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button title="Enviar email" onClick={() => { window.location.href = 'mailto:' + u.email }}
                          className="rounded-lg p-1.5 text-[#888] transition hover:bg-[#f0f0f0] hover:text-[#1D1E20]">
                          <Mail size={14} />
                        </button>
                        {u.banned ? (
                          <button title="Reactivar" disabled={!!actionLoading} onClick={() => onAdminAction(u.id, 'unban')}
                            className="rounded-lg p-1.5 text-[#48C9B0] transition hover:bg-[#e8faf6]">
                            <CheckCircle size={14} />
                          </button>
                        ) : (
                          <button title="Suspender" disabled={!!actionLoading} onClick={() => onAdminAction(u.id, 'ban')}
                            className="rounded-lg p-1.5 text-[#f59e0b] transition hover:bg-[#fff3cd]">
                            <Ban size={14} />
                          </button>
                        )}
                        <button title="Eliminar usuario" disabled={!!actionLoading} onClick={() => onConfirmDelete(u)}
                          className="rounded-lg p-1.5 text-[#ef4444] transition hover:bg-[#fee2e2]">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === u.id && (
                    <tr key={u.id + '-exp'}>
                      <td colSpan={8} className="bg-[#fafafa] px-8 py-4">
                        {u.events.length === 0 ? (
                          <p className="text-xs text-[#aaa]">Sin eventos creados</p>
                        ) : (
                          <div>
                            <p className="mb-2 text-xs font-medium text-[#888]">{'Eventos (' + u.events.length + ')'}</p>
                            <div className="flex flex-wrap gap-2">
                              {u.events
                                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                .map(ev => (
                                  <div key={ev.id} className="rounded-lg border border-[#e8e8e8] bg-white px-3 py-2">
                                    <p className="text-xs font-medium text-[#1D1E20]">{ev.name}</p>
                                    <p className="text-xs text-[#aaa]">
                                      {ev.guest_count + ' inv · ' + ev.party_count + ' acomp · '}
                                      <span className="font-semibold text-[#48C9B0]">{ev.total_count + ' total'}</span>
                                      {' · ' + formatDate(ev.created_at)}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="divide-y divide-[#f0f0f0] md:hidden">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#888]">Sin resultados</p>
          ) : filtered.map(u => (
            <div key={u.id} className={u.banned ? 'opacity-50' : ''}>
              <div className="px-4 py-4 cursor-pointer" onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}>
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <p className="font-medium text-[#1D1E20]">{u.full_name || '—'}</p>
                    <p className="text-xs text-[#888]">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (PLAN_STYLES[u.plan] || PLAN_STYLES.free)}>{u.plan}</span>
                    {expandedId === u.id ? <ChevronUp size={14} className="text-[#aaa]" /> : <ChevronDown size={14} className="text-[#aaa]" />}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-[#888]">
                  <span>{u.event_count + ' eventos'}</span>
                  <span>{u.guest_count + ' inv'}</span>
                  <span>{u.party_count + ' acomp'}</span>
                  <span className="font-semibold text-[#48C9B0]">{u.total_count + ' total'}</span>
                  <span>{'Registro: ' + formatDate(u.created_at)}</span>
                  <span>{'Ultimo login: ' + (u.last_sign_in ? timeAgo(u.last_sign_in) : '—')}</span>
                </div>
              </div>
              {expandedId === u.id && (
                <div className="border-t border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
                  {u.events.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1.5 text-xs font-medium text-[#888]">Eventos</p>
                      <div className="space-y-1.5">
                        {u.events.map(ev => (
                          <div key={ev.id} className="rounded-lg border border-[#e8e8e8] bg-white px-3 py-2">
                            <p className="text-xs font-medium text-[#1D1E20]">{ev.name}</p>
                            <p className="text-xs text-[#aaa]">
                              {ev.guest_count + ' inv · ' + ev.party_count + ' acomp · '}
                              <span className="font-semibold text-[#48C9B0]">{ev.total_count + ' total'}</span>
                              {' · ' + formatDate(ev.created_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <select value={u.plan} onChange={e => onChangePlan(u.id, e.target.value)} onClick={e => e.stopPropagation()}
                      className="rounded-lg border border-[#e0e0e0] px-2 py-1 text-xs text-[#555] outline-none">
                      <option value="free">free</option>
                      <option value="pro">pro</option>
                      <option value="agency">agency</option>
                    </select>
                    <button onClick={() => { window.location.href = 'mailto:' + u.email }} className="rounded-lg border border-[#e0e0e0] p-1.5 text-[#888]"><Mail size={14} /></button>
                    {u.banned ? (
                      <button onClick={() => onAdminAction(u.id, 'unban')} className="rounded-lg border border-[#e0e0e0] p-1.5 text-[#48C9B0]"><CheckCircle size={14} /></button>
                    ) : (
                      <button onClick={() => onAdminAction(u.id, 'ban')} className="rounded-lg border border-[#e0e0e0] p-1.5 text-[#f59e0b]"><Ban size={14} /></button>
                    )}
                    <button onClick={() => onConfirmDelete(u)} className="rounded-lg border border-[#e0e0e0] p-1.5 text-[#ef4444]"><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
