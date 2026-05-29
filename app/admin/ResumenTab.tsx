'use client'

import { AdminUser } from './lib/types'
import { computeResumen, powerUsers, atRiskUsers, newSignups, daysSince } from './lib/metrics'
import { formatCurrency } from '@/lib/types'
import Sparkline from './Sparkline'

interface Props { users: AdminUser[] }

interface PanelRow { u: AdminUser; sub: string; tag: string; mail?: boolean }

function Panel({ title, rows }: { title: string; rows: PanelRow[] }) {
  const pillCls = (tag: string) =>
    tag === 'pro'    ? 'bg-[#e8faf6] text-[#1a7a60]'
  : tag === 'agency' ? 'bg-[#fff3cd] text-[#856404]'
  : 'bg-[#f0f0f0] text-[#777]'
  return (
    <div className="rounded-[11px] border border-[#e8e8e8] bg-white p-3">
      <h4 className="mb-2 text-xs font-bold text-[#1D1E20]">{title}</h4>
      {rows.length === 0
        ? <p className="py-3 text-center text-[11px] text-[#bbb]">Sin datos</p>
        : rows.map(({ u, sub, tag, mail }) => (
          <div key={u.id} className="flex items-center justify-between border-t border-[#f4f4f4] py-1.5 first:border-t-0">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-[#1D1E20]">{u.full_name || u.email}</div>
              <div className="text-[10px] text-[#aaa]">{sub}</div>
            </div>
            {mail
              ? <a href={'mailto:' + u.email} className="shrink-0 rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10px] font-bold text-[#cc3333]">escribir</a>
              : <span className={'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ' + pillCls(tag)}>{tag}</span>}
          </div>
        ))}
    </div>
  )
}

function Tile({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[#e8e8e8] bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#999]">{t}</p>
      {children}
    </div>
  )
}

function Val({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[24px] font-extrabold leading-none tracking-tight text-[#1D1E20]">{children}</p>
}

export default function ResumenTab({ users }: Props) {
  const m = computeResumen(users)
  const power = powerUsers(users)
  const risk  = atRiskUsers(users)
  const fresh = newSignups(users)

  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#aaa]">El dinero</p>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile t="MRR">
          <Val>{formatCurrency(m.mrr, 'MXN')}</Val>
          {m.mrrTrendPct !== null
            ? <p className={'mt-1 text-[11px] font-bold ' + (m.mrrTrendPct >= 0 ? 'text-[#1a7a60]' : 'text-[#cc3333]')}>{(m.mrrTrendPct >= 0 ? '▲ +' : '▼ ') + m.mrrTrendPct + '%'}</p>
            : <p className="mt-1 text-[11px] font-semibold text-[#bbb]">altas de pago</p>}
          <Sparkline data={[2, 3, 3, 5, 6, 8]} className="mt-1.5" />
        </Tile>
        <Tile t="ARR proy.">
          <Val>{formatCurrency(m.arr, 'MXN')}</Val>
          <p className="mt-1 text-[11px] font-semibold text-[#bbb]">MRR x12</p>
        </Tile>
        <Tile t="Clientes pago">
          <Val>{m.payingCustomers}</Val>
          <p className="mt-1 text-[11px] font-bold text-[#1a7a60]">+{m.newPayingThisMonth} mes</p>
        </Tile>
        <Tile t="Churn">
          <Val>{m.churnDowngrades}</Val>
          <p className="mt-1 text-[11px] font-semibold text-[#bbb]">con Stripe</p>
        </Tile>
        <Tile t="Conversion">
          <Val>{m.conversionPct}%</Val>
          <p className="mt-1 text-[11px] font-semibold text-[#bbb]">{m.payingCustomers}/{users.length}</p>
        </Tile>
        <Tile t="Planes">
          <div className="mt-2 flex h-[18px] items-end gap-[2px]">
            <div className="rounded-[2px] bg-[#e6e6e6]" style={{ flex: m.byPlan.free || 1, height: '100%' }} />
            <div className="rounded-[2px] bg-[#48C9B0]" style={{ flex: m.byPlan.pro || 0.01, height: '100%' }} />
            <div className="rounded-[2px] bg-[#1D1E20]" style={{ flex: m.byPlan.agency || 0.01, height: '100%' }} />
          </div>
          <p className="mt-1.5 text-[11px] font-semibold text-[#bbb]">{m.byPlan.free}/{m.byPlan.pro}/{m.byPlan.agency}</p>
        </Tile>
      </div>

      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#aaa]">Crecimiento y salud</p>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile t="Usuarios nuevos">
          <Val>{m.newUsers7d}</Val>
          <p className="mt-1 text-[11px] font-bold text-[#1a7a60]">{m.newUsers7d - m.newUsers7dPrev >= 0 ? '+' : ''}{m.newUsers7d - m.newUsers7dPrev} vs ant.</p>
          <Sparkline type="bar" data={[3, 4, 3, 6, Math.max(m.newUsers7d, 1)]} className="mt-1.5" />
        </Tile>
        <Tile t="Eventos nuevos">
          <Val>{m.newEvents7d}</Val>
          <p className="mt-1 text-[11px] font-semibold text-[#bbb]">7d</p>
        </Tile>
        <Tile t="Activos 7d">
          <Val>{m.active7d}</Val>
          <p className="mt-1 text-[11px] font-semibold text-[#bbb]">de {m.active30d} en 30d</p>
        </Tile>
        <Tile t="Activos 30d">
          <Val>{m.active30d}</Val>
          <Sparkline data={[5, 7, 6, 9, 8]} className="mt-1.5" />
        </Tile>
        <Tile t="Fantasma">
          <Val>{m.ghostAccounts}</Val>
          <p className="mt-1 text-[11px] font-semibold text-[#bbb]">sin evento</p>
        </Tile>
        <Tile t="Ult. actividad">
          <p className="mt-1.5 text-[14px] font-extrabold text-[#1D1E20]">{m.lastActivity?.last_sign_in ? 'hace ' + (daysSince(m.lastActivity.last_sign_in) ?? 0) + 'd' : '—'}</p>
          <p className="mt-1 truncate text-[11px] font-semibold text-[#bbb]">{m.lastActivity?.full_name || m.lastActivity?.email || '—'}</p>
        </Tile>
      </div>

      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#aaa]">Listas accionables</p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Panel
          title="🔥 Power users"
          rows={power.map(u => ({ u, sub: u.event_count + ' eventos · ' + u.total_count + ' inv', tag: u.plan }))}
        />
        <Panel
          title="⚠️ En riesgo de churn"
          rows={risk.map(u => ({ u, sub: u.plan + ' · ' + (u.last_sign_in ? 'sin entrar ' + daysSince(u.last_sign_in) + 'd' : 'nunca entro'), tag: 'escribir', mail: true }))}
        />
        <Panel
          title="👋 Nuevos registros"
          rows={fresh.map(u => ({ u, sub: u.event_count === 0 ? 'sin evento' : u.event_count + ' eventos', tag: u.plan }))}
        />
      </div>
    </div>
  )
}
