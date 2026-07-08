'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { X, Plus, ImagePlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { NIVELES, getRecomendacionesSugeridas, type DressCode, type DressCodeColor } from '@/lib/dresscode'

type FotoField = 'fotos_ellas' | 'fotos_ellos'

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
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
            className="mt-1.5 w-20 rounded border border-[#e8e8e8] px-2 py-1 text-xs text-[#666] focus:border-[#48C9B0] focus:outline-none"
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
  dc, onChange, eventType,
}: { dc: DressCode; onChange: (next: DressCode) => void; eventType: string | null }) {
  const { id } = useParams()
  const [nuevaRec, setNuevaRec] = useState('')
  const [uploading, setUploading] = useState<FotoField | null>(null)
  const patch = (p: Partial<DressCode>) => onChange({ ...dc, ...p })

  const uploadFotos = async (files: File[], field: FotoField) => {
    const slots = 3 - dc[field].length
    if (slots <= 0) return
    setUploading(field)
    const urls: string[] = []
    for (const file of files.slice(0, slots)) {
      const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const path = `dress-code/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`
      const { error } = await supabase.storage.from('event-media').upload(path, file, { upsert: false })
      if (!error) urls.push(supabase.storage.from('event-media').getPublicUrl(path).data.publicUrl)
    }
    if (urls.length) patch({ [field]: [...dc[field], ...urls] } as Partial<DressCode>)
    setUploading(null)
  }

  const removeFoto = (field: FotoField, i: number) =>
    patch({ [field]: dc[field].filter((_, idx) => idx !== i) } as Partial<DressCode>)

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

  const chips = Array.from(new Set([...getRecomendacionesSugeridas(eventType), ...dc.recomendaciones]))

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
                  on ? 'border-[#48C9B0] bg-[#f0fdfb]' : 'border-[#e8e8e8] hover:border-[#48C9B0]/60'
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

      <div className="grid gap-5 sm:grid-cols-2">
        <Section label="Colores sugeridos">
          <ColorRow colors={dc.colores_sugeridos} onChange={c => patch({ colores_sugeridos: c })} />
        </Section>
        <Section label="Colores a evitar">
          <ColorRow colors={dc.colores_evitar} onChange={c => patch({ colores_evitar: c })} avoid />
        </Section>
      </div>

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
          rows={2}
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

      <Section label="Fotos de ejemplo (opcional)">
        <div className="grid gap-4 sm:grid-cols-2">
          {([['fotos_ellas', 'Para ellas'], ['fotos_ellos', 'Para ellos']] as [FotoField, string][]).map(([field, titulo]) => (
            <div key={field}>
              <p className="mb-2 text-[11px] font-semibold text-[#888]">{titulo}</p>
              <div className="flex flex-wrap gap-3">
                {dc[field].map((url, i) => (
                  <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-[#e8e8e8]">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => removeFoto(field, i)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[#999] hover:text-[#cc3333]"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {dc[field].length < 3 && (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[#e0e0e0] text-center text-[#bbb] hover:border-[#48C9B0] hover:text-[#48C9B0]">
                    <ImagePlus size={18} />
                    <span className="px-1 text-[10px] leading-tight">{uploading === field ? 'Subiendo...' : `Subir (${3 - dc[field].length})`}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={uploading === field}
                      onChange={e => { const fs = e.target.files ? Array.from(e.target.files) : []; if (fs.length) uploadFotos(fs, field); e.target.value = '' }}
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
