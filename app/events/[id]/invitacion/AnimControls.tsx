'use client'
import type { InviteDoc } from '@/lib/invite/schema'
import type { SiAnimId, NoAnimId } from '@/lib/invite/theme'
import { setTheme } from '@/lib/invite/doc'

const SI_OPTS: { id: SiAnimId; label: string }[] = [
  { id: 'confeti', label: 'Confeti' },
  { id: 'corazones', label: 'Corazones' },
  { id: 'fuegos', label: 'Fuegos' },
  { id: 'globos', label: 'Globos' },
  { id: 'champan', label: 'Champán' },
  { id: 'estrellas', label: 'Estrellas' },
  { id: 'emojis', label: 'Emojis' },
  { id: 'arcade', label: 'Arcade' },
  { id: 'jackpot', label: 'Jackpot 777' },
  { id: 'bola-disco', label: 'Bola disco' },
]
const NO_OPTS: { id: NoAnimId; label: string }[] = [
  { id: 'calido', label: 'Cierre cálido' },
  { id: 'lluvia', label: 'Lluvia' },
  { id: 'nevada', label: 'Nevada' },
  { id: 'corazon-roto', label: 'Corazón roto' },
  { id: 'matorral', label: 'Matorral' },
  { id: 'luces-off', label: 'Luces off' },
  { id: 'scratch', label: 'Scratch' },
]

export default function AnimControls({ doc, onChange }: { doc: InviteDoc; onChange: (next: InviteDoc) => void }) {
  const t = doc.theme

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-[#666]">Al confirmar (Sí)</span>
        <div className="flex flex-wrap gap-1.5">
          {SI_OPTS.map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(setTheme(doc, { anim: { si: o.id } }))}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                t.anim.si === o.id ? 'border-[#48C9B0] bg-[#48C9B0]/10 text-[#1D1E20]' : 'border-[#e0e0e0] text-[#666] hover:border-[#48C9B0]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-[#666]">Al declinar (No)</span>
        <div className="flex flex-wrap gap-1.5">
          {NO_OPTS.map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(setTheme(doc, { anim: { no: o.id } }))}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                t.anim.no === o.id ? 'border-[#48C9B0] bg-[#48C9B0]/10 text-[#1D1E20]' : 'border-[#e0e0e0] text-[#666] hover:border-[#48C9B0]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-[#999]">Se emparejan solas con la plantilla. Pruébalas tocando Sí o No en la vista previa.</p>
    </div>
  )
}
