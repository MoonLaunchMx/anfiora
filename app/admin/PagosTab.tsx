'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import { AdminUser } from './lib/types'
import { getBillingRows, getBillingSummary } from '@/lib/billing'
import { formatCurrency } from '@/lib/types'
import { formatDate } from './lib/format'

interface Props { users: AdminUser[] }

function Tile({ t, v, d }: { t: string; v: string; d?: string }) {
  return (
    <div className="rounded-[10px] border border-[#e8e8e8] bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#999]">{t}</p>
      <p className="mt-1 text-[25px] font-extrabold leading-none tracking-tight text-[#1D1E20]">{v}</p>
      {d && <p className="mt-1 text-[11px] font-semibold text-[#bbb]">{d}</p>}
    </div>
  )
}

const planPill = (p: string) => p === 'agency' ? 'bg-[#fff3cd] text-[#856404]' : 'bg-[#e8faf6] text-[#1a7a60]'

export default function PagosTab({ users }: Props) {
  const [filter, setFilter] = useState<'all' | 'pro' | 'agency'>('all')
  const rows = getBillingRows(users)
  const summary = getBillingSummary(rows)
  const shown = rows.filter(r => filter === 'all' || r.plan === filter)

  return (
    <div>
      <div className="mb-3.5 flex items-center gap-2 rounded-[9px] border border-[#e6defb] bg-[#f4f1ff] px-3 py-2.5 text-xs font-semibold text-[#5b4bb0]">
        <Zap size={14} className="shrink-0" /> Datos derivados del plan. Cuando conectes Stripe, esta vista mostrara cobros e invoices reales.
      </div>

      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#aaa]">Ingresos</p>
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile t="MRR" v={formatCurrency(summary.mrr, 'MXN')} d="recurrente mensual" />
        <Tile t="Clientes activos" v={String(summary.payingCustomers)} d={summary.byPlan.pro + ' pro · ' + summary.byPlan.agency + ' agency'} />
        <Tile t="Ticket promedio" v={formatCurrency(summary.avgTicket, 'MXN')} d="por cliente" />
        <Tile t="ARR proyectado" v={formatCurrency(summary.arr, 'MXN')} d="MRR x12" />
      </div>

      <div className="rounded-[12px] border border-[#e8e8e8] bg-white">
        <div className="flex items-center justify-between border-b border-[#f0f0f0] px-3.5 py-2.5">
          <div className="flex gap-1.5">
            {(['all', 'pro', 'agency'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={'rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ' + (filter === f ? 'border-[#48C9B0] bg-[#48C9B0] text-white' : 'border-[#e0e0e0] text-[#666] hover:bg-[#f5f5f5]')}>
                {f === 'all' ? 'Todos' : f === 'pro' ? 'Pro' : 'Agency'}
              </button>
            ))}
          </div>
          <span className="text-xs text-[#999]">{rows.length} clientes de pago</span>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f0f0f0] text-left">
                {['Cliente', 'Plan', 'Monto / mes', 'Registrado', 'Estado', 'Proximo cobro', 'MRR aportado'].map(h => (
                  <th key={h} className="px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[#999]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#888]">Sin clientes de pago</td></tr>
              ) : shown.map(r => (
                <tr key={r.userId} className="border-b border-[#f6f6f6]">
                  <td className="px-3.5 py-2.5">
                    <div className="font-bold text-[#1D1E20]">{r.fullName || '—'}</div>
                    <div className="text-[11px] text-[#aaa]">{r.email}</div>
                  </td>
                  <td className="px-3.5 py-2.5"><span className={'rounded-full px-2.5 py-0.5 text-[11px] font-bold ' + planPill(r.plan)}>{r.plan}</span></td>
                  <td className="px-3.5 py-2.5 font-extrabold text-[#1D1E20]">{formatCurrency(r.amountMonthly, 'MXN')}</td>
                  <td className="px-3.5 py-2.5 text-[#666]">{formatDate(r.registeredAt)}</td>
                  <td className="px-3.5 py-2.5"><span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1a7a60]"><span className="h-[7px] w-[7px] rounded-full bg-[#1a7a60]" />Activo</span></td>
                  <td className="px-3.5 py-2.5 text-[#bbb]" title="Disponible con Stripe">—</td>
                  <td className="px-3.5 py-2.5 font-extrabold text-[#1D1E20]">{formatCurrency(r.mrrContributed, 'MXN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="divide-y divide-[#f0f0f0] md:hidden">
          {shown.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#888]">Sin clientes de pago</p>
          ) : shown.map(r => (
            <div key={r.userId} className="px-4 py-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="truncate font-bold text-[#1D1E20]">{r.fullName || r.email}</p>
                  <p className="text-[11px] text-[#aaa]">{r.email}</p>
                </div>
                <span className={'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ' + planPill(r.plan)}>{r.plan}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#888]">
                <span className="font-bold text-[#1D1E20]">{formatCurrency(r.amountMonthly, 'MXN')}/mes</span>
                <span>Registrado {formatDate(r.registeredAt)}</span>
                <span className="text-[#1a7a60]">Activo</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
