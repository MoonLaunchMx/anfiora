'use client'
import type { DressCode } from '@/lib/dresscode'

export default function DressCodeEditor({ dc }: { dc: DressCode; onChange: (next: DressCode) => void }) {
  return <div className="text-sm text-[#999]">Editor en construcción ({dc.nivel ?? 'sin nivel'})</div>
}
