'use client'

import { BookUser } from 'lucide-react'

export function EnlaceRolodex() {
  return (
    <button
      onClick={() => window.location.href = '/rolodex'}
      title="Rolodex"
      className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-2.5 py-2 text-xs text-[#888] transition hover:border-[#48C9B0] hover:text-[#1a9e88]"
    >
      <BookUser size={16} />
      <span className="hidden sm:inline">Rolodex</span>
    </button>
  )
}
