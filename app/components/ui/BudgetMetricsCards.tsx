'use client'

import { Wallet, FileCheck, CheckCircle2, AlertCircle } from 'lucide-react'
import { Currency, formatCurrency } from '@/lib/types'
import HealthBar from './HealthBar'

type Props = {
  totalBudget: number
  totalContracted: number
  totalPaid: number
  currency: Currency
}

export default function BudgetMetricsCards({
  totalBudget, totalContracted, totalPaid, currency,
}: Props) {
  const balance      = totalBudget - totalContracted
  const totalPending = totalContracted - totalPaid
  const isOverBudget = totalContracted > totalBudget
  const balanceLabel = isOverBudget ? 'Excedido' : 'Disponible'

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden grid-cols-4 gap-3 sm:grid">
        <Card icon={<Wallet className="text-[#48C9B0]" size={16} />} label="Estimado" value={formatCurrency(totalBudget, currency)} />
        <Card icon={<FileCheck className="text-[#888]" size={16} />} label="Cotizado" value={formatCurrency(totalContracted, currency)} />
        <Card
          icon={<CheckCircle2 className="text-[#888]" size={16} />}
          label="Pagado"
          value={formatCurrency(totalPaid, currency)}
          subValue={`Por pagar: ${formatCurrency(totalPending, currency)}`}
        />
        <Card
          icon={<AlertCircle className={isOverBudget ? 'text-red-500' : 'text-[#48C9B0]'} size={16} />}
          label={balanceLabel}
          value={formatCurrency(Math.abs(balance), currency)}
          valueClass={isOverBudget ? 'text-red-600' : 'text-[#1D1E20]'}
          progressBar={<HealthBar budgeted={totalBudget} contracted={totalContracted} className="mt-2" />}
        />
      </div>

      {/* MOBILE: 1 card unificada con 2x2 grid limpio */}
      <div className="rounded-xl border border-[#e8e8e8] bg-white p-4 sm:hidden">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat label="Estimado" value={formatCurrency(totalBudget, currency)} />
          <Stat label="Cotizado" value={formatCurrency(totalContracted, currency)} />
          <Stat label="Pagado"   value={formatCurrency(totalPaid, currency)} />
          <Stat
            label={balanceLabel}
            value={formatCurrency(Math.abs(balance), currency)}
            valueClass={isOverBudget ? 'text-red-600' : 'text-[#1D1E20]'}
          />
        </div>
        <div className="mt-4 border-t border-[#f0f0f0] pt-3">
          <HealthBar budgeted={totalBudget} contracted={totalContracted} />
        </div>
      </div>
    </>
  )
}

function Card({
  icon, label, value, subValue, valueClass = 'text-[#1D1E20]', progressBar,
}: {
  icon: React.ReactNode; label: string; value: string; subValue?: string
  valueClass?: string; progressBar?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      {subValue && <p className="mt-0.5 text-[10px] text-[#aaa]">{subValue}</p>}
      {progressBar}
    </div>
  )
}

function Stat({
  label, value, valueClass = 'text-[#1D1E20]',
}: {
  label: string; value: string; valueClass?: string
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">{label}</p>
      <p className={`mt-1 text-base font-bold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  )
}