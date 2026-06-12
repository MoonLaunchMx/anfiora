'use client'

import { type LucideIcon } from 'lucide-react'

export interface TabItem {
  key: string
  label: string
  shortLabel?: string  // se muestra en mobile cuando el label completo no cabe
  icon: LucideIcon
  badge?: number
}

interface TabToggleProps {
  tabs: TabItem[]
  active: string
  onChange: (key: string) => void
}

export function TabToggle({ tabs, active, onChange }: TabToggleProps) {
  return (
    <div className="inline-flex gap-0.5 rounded-lg border border-[#e8e8e8] bg-[#f4f4f4] p-0.5">
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition ' +
              (isActive
                ? 'bg-white font-medium text-[#1D1E20] shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#e8e8e8]'
                : 'font-normal text-[#888] hover:text-[#555]')
            }
          >
            <Icon
              size={14}
              className={isActive ? 'text-[#48C9B0]' : 'text-[#bbb]'}
            />
            {tab.shortLabel ? (
              <>
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </>
            ) : (
              <span>{tab.label}</span>
            )}
            {tab.badge !== undefined && (
              <span className={
                'ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ' +
                (isActive ? 'bg-[#48C9B0] text-white' : 'bg-[#e8e8e8] text-[#888]')
              }>
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}