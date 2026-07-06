'use client'
import type { DressCode } from '@/lib/dresscode'

export default function DressCodePreview({ dc }: { dc: DressCode; eventName: string }) {
  return <div className="text-sm text-[#999]">Vista previa en construcción ({dc.nivel ?? 'sin nivel'})</div>
}
