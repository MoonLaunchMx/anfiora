'use client'

import { useMemo, useState } from 'react'
import { formatCurrency, formatEventDate, type EventStatus } from '@/lib/types'
import { computeChipDeuda, sumaPorMoneda } from '@/lib/dashboard/salud'
import { buildUrgencias, comparaUrgencias } from '@/lib/dashboard/urgencias'
import FeedAtencion from './FeedAtencion'
import type { EventMetrics, Rol, Tono } from '@/lib/dashboard/types'

type Tab = 'activos' | 'pasados' | 'pausados' | 'cancelados'

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }
const ROLE_STYLES: Record<string, string> = {
  admin:  'bg-[#E1F5EE] text-[#0F6E56]',
  editor: 'bg-[#FAEEDA] text-[#854F0B]',
  viewer: 'bg-[#f1efe8] text-[#444441]',
}

const CHIP_BASE = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap'
const CHIP: Record<Tono, string> = {
  ok:     `${CHIP_BASE} border-[#A0E0C0] bg-[#F0FFF6] text-[#2A7A50]`,
  aviso:  `${CHIP_BASE} border-[#F0DCA8] bg-[#FFF8E8] text-[#B8860B]`,
  alerta: `${CHIP_BASE} border-[#FFC0C0] bg-[#FFF0F0] text-[#CC3333]`,
  vacio:  `${CHIP_BASE} border-[#E8E8E8] bg-[#F8F8F8] text-[#888]`,
}

const LABEL = 'text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#BBB]'

function fechaDe(e: { event_date: string | null }): Date {
  if (!e.event_date) return new Date(8640000000000000)
  const [y, m, d] = e.event_date.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d)
}

function diasFaltantes(e: { event_date: string | null }, hoy: Date): number | null {
  if (!e.event_date) return null
  return Math.round((fechaDe(e).getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000)
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-[#e8e8e8] bg-white px-4 py-4">
      <div className="mb-3 h-4 w-3/5 rounded bg-[#f0f0f0]" />
      <div className="mb-4 h-3 w-2/5 rounded bg-[#f0f0f0]" />
      <div className="mb-2 h-1.5 w-full rounded-full bg-[#f0f0f0]" />
      <div className="h-1.5 w-full rounded-full bg-[#f0f0f0]" />
    </div>
  )
}

function Global({ label, valor, sub, color }: { label: string; valor: React.ReactNode; sub: string; color: string }) {
  return (
    <div className="rounded-[13px] border border-[#E8E8E8] bg-white px-[15px] py-3" style={{ borderLeft: `3px solid ${color}` }}>
      <span className={LABEL}>{label}</span>
      <p className="mt-[5px] font-display text-[22px] font-extrabold leading-none tracking-[-0.02em] sm:text-[24px]">{valor}</p>
      <p className="mt-[3px] text-[11px] text-[#888]">{sub}</p>
    </div>
  )
}

type Props = {
  metrics: EventMetrics[]
  rol: Rol
  loading: boolean
  onElegirEvento: (eventId: string) => void
  onNuevoEvento: () => void
  onCambiarEstado: (eventId: string, estado: EventStatus) => void
  eventoPrevio: string | null
}

export default function ContextoCartera({
  metrics, rol, loading, onElegirEvento, onNuevoEvento, onCambiarEstado, eventoPrevio,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('activos')
  const [sortAsc, setSortAsc] = useState(true)
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null)

  const hoy = useMemo(() => new Date(), [])

  const grupos = useMemo(() => {
    const corte = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()
    const proximo = (m: EventMetrics) => fechaDe(m.event).getTime() >= corte
    const porFecha = (a: EventMetrics, b: EventMetrics) => fechaDe(a.event).getTime() - fechaDe(b.event).getTime()
    return {
      activos:    metrics.filter(m => m.event.event_status === 'active' && proximo(m)).sort((a, b) => sortAsc ? porFecha(a, b) : porFecha(b, a)),
      pasados:    metrics.filter(m => m.event.event_status === 'active' && !proximo(m)).sort((a, b) => porFecha(b, a)),
      pausados:   metrics.filter(m => m.event.event_status === 'paused').sort((a, b) => porFecha(b, a)),
      cancelados: metrics.filter(m => m.event.event_status === 'cancelled').sort((a, b) => porFecha(b, a)),
    }
  }, [metrics, sortAsc, hoy])

  const activos = grupos.activos
  const visibles = grupos[activeTab]
  const mios = visibles.filter(m => !m.event.is_shared)
  const compartidos = visibles.filter(m => m.event.is_shared)

  const urgencias = activos
    .flatMap(m => buildUrgencias([m], { puedeVerDinero: m.event.shared_role !== 'viewer' }))
    .sort(comparaUrgencias)

  const vencidas       = activos.reduce((s, m) => s + m.tareas.vencidas, 0)
  const bloqueantes    = activos.reduce((s, m) => s + m.tareas.bloqueantesVencidas, 0)
  const eventosConVenc = activos.filter(m => m.tareas.vencidas > 0).length
  const confirmados    = activos.reduce((s, m) => s + m.invitados.confirmados, 0)
  const invitados      = activos.reduce((s, m) => s + m.invitados.total, 0)
  const atencion       = activos.reduce((s, m) => s + m.invitados.atencion, 0)

  const conDinero = activos.filter(m => m.event.shared_role !== 'viewer')
  const porPagar  = sumaPorMoneda(conDinero, m => m.dinero.porPagar)
  const estimado  = sumaPorMoneda(conDinero, m => m.dinero.estimado)
  const pagado    = sumaPorMoneda(conDinero, m => m.dinero.pagado)

  const masProximo = activos[0] ? diasFaltantes(activos[0].event, hoy) : null

  const tarjetasGlobales = [
    <Global
      key="vencidas"
      label="Tareas vencidas"
      valor={<span className="text-[#CC3333]">{vencidas}</span>}
      sub={`en ${eventosConVenc} ${eventosConVenc === 1 ? 'evento' : 'eventos'} · ${bloqueantes} bloqueantes`}
      color="#CC3333"
    />,
    <Global
      key="porpagar"
      label="Por pagar en total"
      valor={<>{formatCurrency(porPagar.total, porPagar.currency)}{porPagar.otras > 0 && <span className="ml-1.5 text-[11px] font-medium text-[#888]">+{porPagar.otras} monedas</span>}</>}
      sub="contratado menos pagado"
      color="#B8860B"
    />,
    <Global
      key="confirmados"
      label="Confirmados en total"
      valor={<>{confirmados}<span className="ml-1 text-xs font-medium tracking-normal text-[#888]">de {invitados}</span></>}
      sub={atencion > 0 ? `${atencion} requieren atención` : 'nadie requiere atención'}
      color="#48C9B0"
    />,
    <Global
      key="estimado"
      label="Presupuesto gestionado"
      valor={<>{formatCurrency(estimado.total, estimado.currency)}{estimado.otras > 0 && <span className="ml-1.5 text-[11px] font-medium text-[#888]">+{estimado.otras} monedas</span>}</>}
      sub={`${formatCurrency(pagado.total, pagado.currency)} ya pagado`}
      color="#D4A853"
    />,
  ]

  const globales = rol === 'planner' ? tarjetasGlobales : [tarjetasGlobales[2], tarjetasGlobales[0], tarjetasGlobales[1], tarjetasGlobales[3]]

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'activos',    label: 'Activos',    count: grupos.activos.length },
    { key: 'pasados',    label: 'Pasados',    count: grupos.pasados.length },
    { key: 'pausados',   label: 'Pausados',   count: grupos.pausados.length },
    { key: 'cancelados', label: 'Cancelados', count: grupos.cancelados.length },
  ]

  const Tarjeta = ({ m }: { m: EventMetrics }) => {
    const ev = m.event
    const dias = diasFaltantes(ev, hoy)
    const chip = computeChipDeuda(m)
    const enFoco = ev.id === eventoPrevio
    const verDinero = ev.shared_role !== 'viewer'
    const pctConf = m.invitados.pctConfirmado
    const pctPag = m.dinero.estimado > 0 ? Math.min(100, Math.round((m.dinero.pagado / m.dinero.estimado) * 100)) : 0
    const pctCon = Math.min(100, m.dinero.pctContratado)
    const menu = menuAbierto === ev.id

    const tonoDias: Tono = dias === null ? 'vacio' : dias < 40 ? 'alerta' : dias < 60 ? 'aviso' : 'vacio'

    return (
      <div
        onClick={() => onElegirEvento(ev.id)}
        className={'group relative cursor-pointer rounded-[13px] border bg-white px-4 py-4 transition hover:border-[#48C9B0] hover:shadow-[0_2px_12px_rgba(72,201,176,0.12)] active:scale-[0.99] ' + (
          enFoco ? 'border-[#c8ede7]' : 'border-[#E8E8E8]'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {ev.event_type && <span className={CHIP.vacio}>{ev.event_type}</span>}
            {dias !== null && activeTab === 'activos' && (
              <span className={CHIP[tonoDias]}>{dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`}</span>
            )}
            {enFoco && <span className={CHIP.ok}>En foco</span>}
            {ev.is_shared && ev.shared_role && (
              <span className={'rounded px-1.5 py-0.5 text-[10px] font-semibold ' + (ROLE_STYLES[ev.shared_role] || '')}>
                {ROLE_LABEL[ev.shared_role] || ev.shared_role}
              </span>
            )}
          </div>
          {!ev.is_shared && (
            <div data-menu className="relative shrink-0" onClick={e => e.stopPropagation()}>
              <button
                onClick={e => { e.stopPropagation(); setMenuAbierto(menu ? null : ev.id) }}
                className={'flex h-7 w-7 items-center justify-center rounded-lg text-[#bbb] transition hover:bg-[#f0f0f0] hover:text-[#555] ' + (menu ? 'bg-[#f0f0f0] text-[#555]' : '')}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <circle cx="7" cy="2.5" r="1.2" /><circle cx="7" cy="7" r="1.2" /><circle cx="7" cy="11.5" r="1.2" />
                </svg>
              </button>
              {menu && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
                  <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#bbb]">Cambiar estado</div>
                  {([
                    { label: 'Activo',    status: 'active' as EventStatus, color: '#555' },
                    { label: 'Pausado',   status: 'paused' as EventStatus, color: '#555' },
                    { label: 'Cancelado', status: 'cancelled' as EventStatus, color: '#cc3333' },
                  ]).filter(o => o.status !== ev.event_status).map(o => (
                    <button
                      key={o.status}
                      onClick={e => { e.stopPropagation(); setMenuAbierto(null); onCambiarEstado(ev.id, o.status) }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs transition hover:bg-[#f8f8f8]"
                      style={{ color: o.color }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <h4 className="mt-2 truncate font-display text-[14px] font-bold tracking-[-0.01em] text-[#1D1E20]">{ev.name}</h4>
        <p className="mt-0.5 truncate text-[11px] text-[#888]">
          {formatEventDate(ev.event_date, ev.event_end_date)}
          {ev.venue && ` · ${ev.venue}`}
        </p>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="text-[11px] text-[#888]">Confirmados</span>
            <span className="text-[10.5px] font-semibold">{m.invitados.confirmados} / {m.invitados.total}</span>
          </div>
          <div className="h-[5px] overflow-hidden rounded-full bg-[#F0F0F0]">
            <div className="h-full rounded-full bg-[#48C9B0]" style={{ width: `${pctConf}%` }} />
          </div>
        </div>

        {verDinero && (
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-[11px] text-[#888]">{m.dinero.excedido ? 'Contratado del estimado' : 'Pagado del estimado'}</span>
              <span className="text-[10.5px] font-semibold">
                {formatCurrency(m.dinero.excedido ? m.dinero.contratado : m.dinero.pagado, ev.currency)} / {formatCurrency(m.dinero.estimado, ev.currency)}
              </span>
            </div>
            <div className="h-[5px] overflow-hidden rounded-full bg-[#F0F0F0]">
              <div
                className="h-full rounded-full"
                style={{ width: `${m.dinero.excedido ? pctCon : pctPag}%`, background: m.dinero.excedido ? '#CC3333' : '#48C9B0' }}
              />
            </div>
          </div>
        )}

        <div className="my-3 h-px bg-[#F0F0F0]" />
        <div className="flex items-center justify-between gap-3">
          <span className={CHIP[chip.tono]}>{chip.texto === 'OK' ? 'OK' : chip.texto === 'Borrador' || chip.texto === 'Sin publicar' ? chip.texto : `${chip.texto} vencidas`}</span>
          <span className="text-[11px] font-semibold text-[#1A9E88]">Entrar</span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (metrics.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e0e0e0] px-6 py-16 text-center sm:py-20">
        <p className="text-sm text-[#888] sm:text-base">Aún no tienes eventos</p>
        <p className="mt-1 text-xs text-[#bbb] sm:text-sm">Crea tu primer evento para empezar</p>
        <button
          onClick={onNuevoEvento}
          className="mt-4 rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
        >
          + Crear evento
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">

      <div>
        <h2 className="font-display text-xl font-extrabold tracking-[-0.02em]">Tu cartera</h2>
        <p className="mt-0.5 text-[11px] text-[#888]">
          {activos.length} {activos.length === 1 ? 'evento activo' : 'eventos activos'}
          {masProximo !== null && ` · el más próximo ${masProximo === 0 ? 'es hoy' : masProximo === 1 ? 'es mañana' : `en ${masProximo} días`}`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{globales}</div>

      <FeedAtencion urgencias={urgencias} titulo="Lo más urgente de toda tu cartera" mostrarEvento max={3} />

      <div className="flex items-center gap-2 pt-1">
        <div className="flex flex-1 gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ' + (
                activeTab === tab.key ? 'bg-[#1D1E20] text-white' : 'text-[#888] hover:bg-[#efefef]'
              )}
            >
              {tab.label}
              <span className={'rounded-full px-1.5 py-0.5 text-[10px] font-bold ' + (
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-[#e8e8e8] text-[#666]'
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        {activeTab === 'activos' && (
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-[11px] text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
          >
            {sortAsc ? 'Fecha ↑' : 'Fecha ↓'}
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e0e0e0] px-6 py-16 text-center">
          <p className="text-sm text-[#888]">
            {activeTab === 'activos'    && 'No tienes eventos activos'}
            {activeTab === 'pasados'    && 'No tienes eventos pasados'}
            {activeTab === 'pausados'   && 'No tienes eventos pausados'}
            {activeTab === 'cancelados' && 'No tienes eventos cancelados'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {mios.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#888]">Mis eventos</h3>
                <span className="rounded-full bg-[#e8e8e8] px-1.5 py-0.5 text-[10px] font-bold text-[#666]">{mios.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {mios.map(m => <Tarjeta key={m.event.id} m={m} />)}
              </div>
            </section>
          )}
          {compartidos.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#888]">Compartidos conmigo</h3>
                <span className="rounded-full bg-[#e8e8e8] px-1.5 py-0.5 text-[10px] font-bold text-[#666]">{compartidos.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {compartidos.map(m => <Tarjeta key={m.event.id} m={m} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
