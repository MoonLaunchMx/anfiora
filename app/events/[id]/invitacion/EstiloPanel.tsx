'use client'
import type { InviteDoc } from '@/lib/invite/schema'
import { applyVibe } from '@/lib/invite/doc'
import VibePicker from './VibePicker'

export default function EstiloPanel({ doc, onChange }: { doc: InviteDoc; onChange: (next: InviteDoc) => void }) {
  return <VibePicker activeVibeId={doc.theme.vibeId} onSelect={id => onChange(applyVibe(doc, id))} />
}
