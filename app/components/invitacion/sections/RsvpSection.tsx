'use client'
import { useState } from 'react'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import type { RsvpSubmission } from '@/lib/invite'
import { Check, X } from 'lucide-react'

type Content = Extract<Section, { type: 'rsvp' }>['content']

type Row = {
  key: string
  id?: string
  name: string
  attends: boolean | null
  allergies: string[]
}

function buildRows(ctx: InviteCtx): Row[] {
  const guestRow: Row = {
    key: 'guest',
    name: ctx.guest.name,
    attends: ctx.guest.rsvp_status === 'confirmed' ? true : ctx.guest.rsvp_status === 'declined' ? false : null,
    allergies: ctx.guest.allergies,
  }
  const companionRows: Row[] = ctx.companions.map((c, i) => ({
    key: c.id || `companion-${i}`,
    id: c.id,
    name: c.name,
    attends: c.rsvp_status === 'confirmed' ? true : c.rsvp_status === 'declined' ? false : null,
    allergies: c.allergies,
  }))
  return [guestRow, ...companionRows]
}

function AllergyChips({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled: boolean }) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const v = draft.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setDraft('')
  }

  return (
    <div className="mt-3">
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((a, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-[#f2f2f2] px-2.5 py-1 text-[11px] text-[#666]">
              {a}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                  className="text-[#999] hover:text-[#cc3333]"
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && (
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              commit()
            }
          }}
          onBlur={commit}
          placeholder="Alergia o restricción + Enter"
          className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-xs text-[#1D1E20] outline-none focus:border-[#48C9B0]"
        />
      )}
    </div>
  )
}

export default function RsvpSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const [rows, setRows] = useState<Row[]>(() => buildRows(ctx))
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabled = ctx.mode === 'preview' || Boolean(ctx.deadlinePassed)
  const note = ctx.mode === 'preview'
    ? 'Vista previa — así confirmará tu invitado'
    : ctx.deadlinePassed
    ? 'Confirmaciones cerradas'
    : null

  const allChosen = rows.every(r => r.attends !== null)

  const setAttends = (key: string, value: boolean) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, attends: value } : r)))
  }
  const setAllergies = (key: string, allergies: string[]) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, allergies } : r)))
  }

  const handleSubmit = async () => {
    if (!ctx.onSubmit || disabled || !allChosen || submitting) return
    const [guestRow, ...companionRows] = rows
    const payload: RsvpSubmission = {
      guestAttends: Boolean(guestRow.attends),
      guestAllergies: guestRow.allergies,
      companions: companionRows.map(r => ({
        id: r.id,
        name: r.name,
        attends: Boolean(r.attends),
        allergies: r.allergies,
      })),
    }
    setSubmitting(true)
    setError(null)
    try {
      await ctx.onSubmit(payload)
      setSubmitted(true)
    } catch {
      setError('No pudimos guardar tu confirmación. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="px-6 py-14">
      <h2 className="text-center text-xl text-[#1D1E20]" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm text-[#666]">{content.texto}</p>

      <div className="mx-auto mt-8 flex max-w-sm flex-col gap-4">
        {rows.map(row => (
          <div key={row.key} className="rounded-2xl border border-[#e8e8e8] bg-white px-5 py-4">
            <p className="text-sm font-medium text-[#1D1E20]">{row.name}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setAttends(row.key, true)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  row.attends === true
                    ? 'border-[#48C9B0] bg-[#48C9B0]/10 text-[#2a7a50]'
                    : 'border-[#e8e8e8] text-[#666]'
                }`}
              >
                <Check size={14} /> Asisto
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setAttends(row.key, false)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  row.attends === false
                    ? 'border-[#cc3333] bg-[#fff0f0] text-[#cc3333]'
                    : 'border-[#e8e8e8] text-[#666]'
                }`}
              >
                <X size={14} /> No podré
              </button>
            </div>

            <AllergyChips
              value={row.allergies}
              onChange={v => setAllergies(row.key, v)}
              disabled={disabled}
            />
          </div>
        ))}
      </div>

      {note && <p className="mt-5 text-center text-xs text-[#999]">{note}</p>}
      {error && <p className="mt-3 text-center text-xs text-[#cc3333]">{error}</p>}

      {!disabled && !submitted && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allChosen || submitting}
          className="mx-auto mt-6 block w-full max-w-sm rounded-full bg-[#48C9B0] py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Enviando…' : 'Confirmar asistencia'}
        </button>
      )}

      {submitted && (
        <p className="mt-6 text-center text-sm font-medium text-[#2a7a50]">¡Gracias por confirmar!</p>
      )}
    </section>
  )
}
