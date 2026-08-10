'use client'

import { useState } from 'react'
import { Modal } from '@/app/components/ui/Modal'
import { dayLabel } from '@/lib/itinerary'
import { dayTypesFor, templateFor, expandTemplate, type DayTypeKey, type TemplateMoment } from '@/lib/itinerary-templates'

interface DayTemplateModalProps {
  eventType: string | null
  date: string
  onClose: () => void
  onApply: (moments: TemplateMoment[]) => void
}

export function DayTemplateModal({ eventType, date, onClose, onApply }: DayTemplateModalProps) {
  const options = dayTypesFor(eventType)
  const [key, setKey] = useState<DayTypeKey>(options[0].key)
  const [anchor, setAnchor] = useState(() => templateFor(eventType || '', options[0].key).defaultAnchorTime)
  const [preview, setPreview] = useState<TemplateMoment[] | null>(null)

  const tpl = templateFor(eventType || '', key)
  const { dow, num } = dayLabel(date)

  const pick = (k: DayTypeKey) => {
    setKey(k)
    setAnchor(templateFor(eventType || '', k).defaultAnchorTime)
  }

  if (preview) {
    return (
      <Modal open onClose={onClose} size="md">
        <Modal.Header title={`Así quedaría tu ${dow.toLowerCase()}`} />
        <Modal.Body>
          <p className="pb-3 text-xs text-[#888]">
            {options.find(o => o.key === key)?.label} · empieza {anchor}
          </p>
          <div className="flex flex-col">
            {preview.map((m, i) => (
              <div key={i} className="grid grid-cols-[64px_1fr] gap-2 py-1 text-sm">
                <span className="tabular-nums text-[13px] font-semibold text-[#666]">{m.start_time}</span>
                <span>
                  {m.title}
                  {m.moment_date !== date && <span className="ml-2 text-[11px] text-[#c49a3a]">día siguiente</span>}
                  {!m.visible_to_guests && <span className="ml-2 text-[11px] text-[#bbb]">oculto</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="pt-3 text-[11px] text-[#bbb]">
            Se agregan como borrador: mueve, edita o borra lo que no aplique.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={() => setPreview(null)} className="flex-1 rounded-xl border border-[#e0e0e0] py-2.5 text-sm text-[#888] hover:bg-[#f8f8f8]">
            Cambiar
          </button>
          <button onClick={() => onApply(preview)} className="flex-[2] rounded-xl bg-[#48C9B0] py-2.5 text-sm font-semibold text-white hover:bg-[#3ab89f]">
            Agregar {preview.length} momentos
          </button>
        </Modal.Footer>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header title="Armar el día" />
      <Modal.Body>
        <div className="flex items-baseline gap-2 border-b border-[#e8e8e8] pb-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d4a853]">{dow}</span>
          <span className="text-[22px] font-semibold tabular-nums">{num}</span>
        </div>

        <p className="pb-2 pt-4 text-xs font-semibold text-[#666]">¿Qué pasa este día?</p>
        <div className="flex flex-wrap gap-2">
          {options.map(o => (
            <button
              key={o.key}
              onClick={() => pick(o.key)}
              className={[
                'rounded-full border px-3 py-1.5 text-[12.5px] transition',
                key === o.key
                  ? 'border-[#d4a853] bg-[#fffbf0] font-semibold text-[#c49a3a]'
                  : 'border-[#e0e0e0] text-[#666] hover:bg-[#f8f8f8]',
              ].join(' ')}
            >
              {o.label}
            </button>
          ))}
        </div>

        <p className="pb-2 pt-5 text-xs font-semibold text-[#666]">¿A qué hora empieza?</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-xl border border-[#e0e0e0] bg-[#f8f8f8] px-3 py-2 text-sm text-[#666]">{tpl.anchorLabel}</div>
          <input
            type="time"
            value={anchor}
            onChange={e => setAnchor(e.target.value)}
            className="w-[108px] shrink-0 rounded-xl border border-[#e0e0e0] bg-[#f8f8f8] px-2 py-2 text-center text-base tabular-nums focus:border-[#d4a853] focus:outline-none"
          />
        </div>
        <p className="pt-2 text-[11px] text-[#bbb]">Todo lo demás se acomoda solo a partir de esa hora.</p>
      </Modal.Body>
      <Modal.Footer>
        <button onClick={onClose} className="flex-1 rounded-xl border border-[#e0e0e0] py-2.5 text-sm text-[#888] hover:bg-[#f8f8f8]">
          Cancelar
        </button>
        <button
          onClick={() => setPreview(expandTemplate(tpl, anchor, date))}
          disabled={!anchor}
          className="flex-[2] rounded-xl bg-[#48C9B0] py-2.5 text-sm font-semibold text-white hover:bg-[#3ab89f] disabled:opacity-40"
        >
          Ver propuesta
        </button>
      </Modal.Footer>
    </Modal>
  )
}
