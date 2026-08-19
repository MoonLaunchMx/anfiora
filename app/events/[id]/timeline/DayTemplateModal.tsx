'use client'

import { useState } from 'react'
import { Modal } from '@/app/components/ui/Modal'
import { dayLabel } from '@/lib/itinerary'
import { dayTypesFor, templateFor, expandTemplate, type DayTypeKey, type TemplateMoment } from '@/lib/itinerary-templates'

interface DayTemplateModalProps {
  eventType: string | null
  date: string
  days: string[]
  countByDate: Record<string, number>
  onClose: () => void
  onApply: (moments: TemplateMoment[]) => void
}

export function DayTemplateModal({ eventType, date, days, countByDate, onClose, onApply }: DayTemplateModalProps) {
  const options = dayTypesFor(eventType)
  // El dia es una decision del usuario, no del scroll: entra por el prop solo como
  // punto de partida. Antes se heredaba del dia activo y en un evento sin momentos
  // no habia scroll del cual heredarlo, asi que siempre caia en el primer dia.
  const [chosen, setChosen] = useState(date)
  const [key, setKey] = useState<DayTypeKey>(options[0].key)
  const [anchor, setAnchor] = useState(() => templateFor(eventType || '', options[0].key).defaultAnchorTime)
  const [preview, setPreview] = useState<TemplateMoment[] | null>(null)

  const tpl = templateFor(eventType || '', key)
  const { dow, num } = dayLabel(chosen)
  const varios = days.length > 1
  const yaTiene = countByDate[chosen] || 0

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
            {varios && <span className="font-medium text-[#666]">{dow} {num} · </span>}
            {options.find(o => o.key === key)?.label} · empieza {anchor}
          </p>
          <div className="flex flex-col">
            {preview.map((m, i) => (
              <div key={i} className="grid grid-cols-[64px_1fr] gap-2 py-1 text-sm">
                <span className="tabular-nums text-[13px] font-semibold text-[#666]">{m.start_time}</span>
                <span>
                  {m.title}
                  {m.moment_date !== chosen && <span className="ml-2 text-[11px] text-[#c49a3a]">día siguiente</span>}
                  {!m.visible_to_guests && <span className="ml-2 text-[11px] text-[#bbb]">oculto</span>}
                </span>
              </div>
            ))}
          </div>
          {yaTiene > 0 && (
            <p className="mt-3 rounded-lg bg-[#fffbf0] px-3 py-2 text-[11px] text-[#c49a3a]">
              Ese día ya tiene {yaTiene} {yaTiene === 1 ? 'momento' : 'momentos'}. Estos se suman a los que ya están, no los reemplazan.
            </p>
          )}
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
        {varios ? (
          <>
            <p className="pb-2 text-xs font-semibold text-[#666]">¿Cuál día?</p>
            {/* auto-fit reparte el ancho completo en columnas iguales y se va a un
                segundo renglon solo cuando los dias ya no caben. Sin esto, un dia con
                fecha mas larga quedaba mas ancho que los demas. */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(74px,1fr))] gap-2 border-b border-[#e8e8e8] pb-4">
              {days.map(d => {
                const l = dayLabel(d)
                const activo = d === chosen
                return (
                  <button
                    key={d}
                    onClick={() => setChosen(d)}
                    className={[
                      'rounded-xl border px-2 py-2 text-center transition',
                      activo
                        ? 'border-[#48C9B0] bg-[#48C9B0]'
                        : 'border-[#e0e0e0] hover:bg-[#f8f8f8]',
                    ].join(' ')}
                  >
                    <span className={[
                      'block text-[10px] font-semibold uppercase tracking-[0.12em]',
                      activo ? 'text-white/85' : 'text-[#999]',
                    ].join(' ')}>
                      {l.dow.slice(0, 3)}
                    </span>
                    <span className={[
                      'block text-[14px] font-semibold tabular-nums',
                      activo ? 'text-white' : 'text-[#666]',
                    ].join(' ')}>
                      {l.num}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="flex items-baseline gap-2 border-b border-[#e8e8e8] pb-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d4a853]">{dow}</span>
            <span className="text-[22px] font-semibold tabular-nums">{num}</span>
          </div>
        )}

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
          onClick={() => setPreview(expandTemplate(tpl, anchor, chosen))}
          disabled={!anchor}
          className="flex-[2] rounded-xl bg-[#48C9B0] py-2.5 text-sm font-semibold text-white hover:bg-[#3ab89f] disabled:opacity-40"
        >
          Ver propuesta
        </button>
      </Modal.Footer>
    </Modal>
  )
}
