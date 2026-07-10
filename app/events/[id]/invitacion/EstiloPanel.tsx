'use client'
import type { InviteDoc } from '@/lib/invite/schema'
import { applyVibe } from '@/lib/invite/doc'
import VibePicker from './VibePicker'
import PersonalizarPanel from './PersonalizarPanel'

export default function EstiloPanel({ doc, onChange }: { doc: InviteDoc; onChange: (next: InviteDoc) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <VibePicker activeVibeId={doc.theme.vibeId} onSelect={id => onChange(applyVibe(doc, id))} />
      <PersonalizarPanel doc={doc} onChange={onChange} />
    </div>
  )
}
