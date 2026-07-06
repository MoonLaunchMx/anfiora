'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { NIVELES, RECOMENDACIONES_SUGERIDAS, type DressCode, type DressCodeColor } from '@/lib/dresscode'

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#999]">{label}</p>
      {children}
    </div>
  )
}

function ColorRow({
  colors, onChange, avoid,
}: { colors: DressCodeColor[]; onChange: (next: DressCodeColor[]) => void; avoid?: boolean }) {
  const add = () => onChange([...colors, { hex: '#d4a853', nombre: '' }])
  const remove = (i: number) => onChange(colors.filter((_, idx) => idx !== i))
  const update = (i: number, patch: Partial<DressCodeColor>) =>
    onChange(colors.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))

  return (
    <div className="flex flex-wrap items-start gap-3">
      {colors.map((c, i) => (
        <div key={i} className="relative">
          <label
            className={`block h-11 w-11 cursor-pointer rounded-lg border ${avoid ? 'border-[#ffc0c0]' : 'border-black/10'}`}
            style={{ background: c.hex }}
          >
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : '#d4a853'}
              onChange={e => update(i, { hex: e.target.value })}
              className="h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <input
            value={c.nombre}
            onChange={e => update(i, { nombre: e.target.value })}
            placeholder="Nombre"
            className="mt-1 w-16 rounded border border-[#e8e8e8] px-1 py-0.5 text-[10px] text-[#666] focus:border-[#48C9B0] focus:outline-none"
          />
          <button
            onClick={() => remove(i)}
            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-[#e8e8e8] bg-white text-[#999] hover:text-[#cc3333]"
          >
            <X size={10} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-dashed border-[#e0e0e0] text-[#bbb] hover:border-[#48C9B0] hover:text-[#48C9B0]"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}

export default function DressCodeEditor({
  dc, onChange,
}: { dc: DressCode; onChange: (next: DressCode) => void }) {
  const [nuevaRec, setNuevaRec] = useState('')
  const patch = (p: Partial<DressCode>) => onChange({ ...dc, ...p })

  const toggleRec = (rec: string) => {
    patch({
      recomendaciones: dc.recomendaciones.includes(rec)
        ? dc.recomendaciones.filter(r => r !== rec)
        : [...dc.recomendaciones, rec],
    })
  }
  const addRec = () => {
    const v = nuevaRec.trim()
    if (v && !dc.recomendaciones.includes(v)) patch({ recomendaciones: [...dc.recomendaciones, v] })
    setNuevaRec('')
  }

  const chips = Array.from(new Set([...RECOMENDACIONES_SUGERIDAS, ...dc.recomendaciones]))

  return (
    <div>
      <Section label="Nivel de formalidad">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NIVELES.map(n => {
            const on = dc.nivel === n.id
            return (
              <button
                key={n.id}
                onClick={() => patch({ nivel: on ? null : n.id })}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  on ? 'border-[#d4a853] bg-[#fffbf0]' : 'border-[#e8e8e8] hover:border-[#d4a853]/60'
                }`}
              >
                <p className="text-[13px] font-bold text-[#1D1E20]">{n.label}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-[#888]">{n.desc}</p>
              </button>
            )
          })}
        </div>
        {dc.nivel === 'tematico' && (
          <input
            value={dc.nivel_custom ?? ''}
            onChange={e => patch({ nivel_custom: e.target.value })}
            placeholder="Describe el tema (ej. Años 20, Blanco total...)"
            className="mt-3 w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#48C9B0] focus:outline-none"
          />
        )}
      </Section>

      <Section label="Colores sugeridos">
        <ColorRow colors={dc.colores_sugeridos} onChange={c => patch({ colores_sugeridos: c })} />
      </Section>

      <Section label="Colores a evitar">
        <ColorRow colors={dc.colores_evitar} onChange={c => patch({ colores_evitar: c })} avoid />
      </Section>

      <Section label="Recomendaciones rápidas">
        <div className="flex flex-wrap gap-2">
          {chips.map(rec => {
            const on = dc.recomendaciones.includes(rec)
            return (
              <button
                key={rec}
                onClick={() => toggleRec(rec)}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${
                  on ? 'border-[#d4a853] bg-[#fffbf0] text-[#1D1E20]' : 'border-[#e8e8e8] text-[#888] hover:border-[#d4a853]/60'
                }`}
              >
                {rec}
              </button>
            )
          })}
        </div>
        <div className="mt-2.5 flex gap-2">
          <input
            value={nuevaRec}
            onChange={e => setNuevaRec(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRec())}
            placeholder="Agregar recomendación propia"
            className="flex-1 rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#48C9B0] focus:outline-none"
          />
          <button onClick={addRec} className="rounded-lg border border-[#e8e8e8] px-3 text-sm text-[#666] hover:border-[#48C9B0]">
            Agregar
          </button>
        </div>
      </Section>

      <Section label="Nota libre">
        <textarea
          value={dc.nota_libre}
          onChange={e => patch({ nota_libre: e.target.value })}
          rows={3}
          placeholder="Ej. El jardín es de pasto natural, considera el tipo de zapato."
          className="w-full resize-y rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#48C9B0] focus:outline-none"
        />
      </Section>

      <Section label="Guía por género (opcional)">
        <div className="grid gap-3 sm:grid-cols-2">
          <textarea
            value={dc.guia_ellas ?? ''}
            onChange={e => patch({ guia_ellas: e.target.value || null })}
            rows={2}
            placeholder="Para ellas..."
            className="w-full resize-y rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#48C9B0] focus:outline-none"
          />
          <textarea
            value={dc.guia_ellos ?? ''}
            onChange={e => patch({ guia_ellos: e.target.value || null })}
            rows={2}
            placeholder="Para ellos..."
            className="w-full resize-y rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#48C9B0] focus:outline-none"
          />
        </div>
      </Section>
    </div>
  )
}
