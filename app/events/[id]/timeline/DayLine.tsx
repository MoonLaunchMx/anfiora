'use client'

import { dayLabel } from '@/lib/itinerary'
import { Plus } from 'lucide-react'

interface DayLineProps {
  date: string
  active: boolean
  count: number
  visibleCount: number
  canEdit: boolean
  onAdd: () => void
}

export function DayLine({ date, active, count, visibleCount, canEdit, onAdd }: DayLineProps) {
  const { dow, num } = dayLabel(date)
  return (
    <div className="sticky top-0 z-[2] flex h-14 items-center gap-3 bg-white">
      <span className="flex items-baseline gap-2 whitespace-nowrap">
        <span
          className={[
            'font-semibold uppercase tracking-[0.14em] transition-all duration-[400ms] ease-out motion-reduce:transition-none',
            active ? 'text-sm text-[#48C9B0] tracking-[0.17em]' : 'text-[11px] text-[#999]',
          ].join(' ')}
        >
          {dow}
        </span>
        <span
          className={[
            'font-semibold tabular-nums transition-all duration-[400ms] ease-out motion-reduce:transition-none',
            active ? 'text-2xl text-[#48C9B0]' : 'text-[13px] text-[#666]',
          ].join(' ')}
        >
          {num}
        </span>
      </span>
      <span className="h-px min-w-3 flex-1 bg-[#e8e8e8]" />
      <span className={`whitespace-nowrap text-[11px] transition-colors ${active ? 'text-[#666]' : 'text-[#bbb]'}`}>
        {count === 0 ? 'Sin momentos' : `${count} momentos · ${visibleCount} visibles`}
      </span>
      {canEdit && (
        <button
          onClick={onAdd}
          aria-label={`Agregar momento el ${dow} ${num}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#bbb] transition hover:bg-[#eafaf6] hover:text-[#48C9B0]"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  )
}
