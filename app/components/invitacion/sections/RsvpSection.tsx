'use client'
import { useState } from 'react'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import type { RsvpSubmission } from '@/lib/invite'
import type { Theme } from '@/lib/invite/theme'
import { Check, X } from 'lucide-react'
import SectionShell from '../SectionShell'
import RsvpAnimation from '../RsvpAnimation'
import RegistroForm from '../RegistroForm'

const SI_MSG = '¡Nos vemos ahí!'
const NO_MSG = '¡Te vamos a extrañar!'

type Content = Extract<Section, { type: 'rsvp' }>['content']

type Row = {
  key: string
  id?: string
  name: string
  attends: boolean | null
  allergies: string[]
}

// Corre en el inicializador de useState, antes del corte por modo: tiene que
// tolerar que no haya invitado aunque la seccion no se llegue a pintar.
function buildRows(ctx: InviteCtx): Row[] {
  const guestRow: Row | null = ctx.guest
    ? {
        key: 'guest',
        name: ctx.guest.name,
        attends: ctx.guest.rsvp_status === 'confirmed' ? true : ctx.guest.rsvp_status === 'declined' ? false : null,
        allergies: ctx.guest.allergies,
      }
    : null
  const companionRows: Row[] = ctx.companions.map((c, i) => ({
    key: c.id || `companion-${i}`,
    id: c.id,
    name: c.name,
    attends: c.rsvp_status === 'confirmed' ? true : c.rsvp_status === 'declined' ? false : null,
    allergies: c.allergies,
  }))
  return guestRow ? [guestRow, ...companionRows] : companionRows
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
          className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-xs text-[#1D1E20] outline-none focus:border-[var(--inv-acento)]"
        />
      )}
    </div>
  )
}

function PuertaAviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-[#e8e8e8] bg-white px-5 py-6 text-center">
      <p className="text-base font-semibold text-[#1D1E20]">{titulo}</p>
      <p className="mt-1 text-sm text-[#888]">{texto}</p>
    </div>
  )
}

export default function RsvpSection({ content, ctx, anim }: { content: Content; ctx: InviteCtx; anim: Theme['anim'] }) {
  const [rows, setRows] = useState<Row[]>(() => buildRows(ctx))
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState<'si' | 'no' | null>(null)
  const [playKey, setPlayKey] = useState(0)

  // En la puerta publica no hay a quien confirmar todavia: el registro ocupa
  // este slot, con el titulo y el tema que el anfitrion ya eligio. El corte va
  // DESPUES de los hooks, no antes.
  if (ctx.mode === 'compartida') {
    if (!ctx.puerta) return null
    return (
      <SectionShell variant="form">
        <h2 className="px-2 text-center text-xl font-semibold lg:text-2xl" style={{ color: 'var(--inv-texto-titulo)', fontFamily: 'var(--inv-font-titulo)' }}>
          {content.titulo}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-center text-sm opacity-70" style={{ color: 'var(--inv-texto)' }}>{content.texto}</p>
        <div className="mt-8">
          {ctx.puerta.agotado ? (
            <PuertaAviso
              titulo="Ya no quedan lugares"
              texto="Este evento llegó a su cupo. Escríbele al anfitrión por si se libera alguno."
            />
          ) : ctx.deadlinePassed ? (
            <PuertaAviso
              titulo="Los registros ya cerraron"
              texto="La fecha límite para confirmar ya pasó. Escríbele al anfitrión si todavía quieres ir."
            />
          ) : (
            <RegistroForm
              token={ctx.puerta.token}
              maxCompanions={ctx.puerta.maxCompanions}
              botonClassName={ctx.botonClassName}
              onDone={ctx.puerta.onDone}
            />
          )}
        </div>
      </SectionShell>
    )
  }

  if (!ctx.guest) return null

  const isPreview = ctx.mode === 'preview'
  const locked = Boolean(ctx.deadlinePassed)
  const disabled = locked
  const note = isPreview
    ? 'Vista previa — toca Sí o No para ver la animación'
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
    if (locked || !allChosen || submitting) return
    const outcome: 'si' | 'no' = rows.some(r => r.attends === true) ? 'si' : 'no'
    setPlayKey(k => k + 1)

    if (isPreview || !ctx.onSubmit) {
      setPlaying(outcome)
      return
    }

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
      setPlaying(outcome)
    } catch {
      setError('No pudimos guardar tu confirmación. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SectionShell variant="form">
      <h2 className="px-2 text-center text-xl font-semibold lg:text-2xl" style={{ color: 'var(--inv-texto-titulo)', fontFamily: 'var(--inv-font-titulo)' }}>
        {content.titulo}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-center text-sm opacity-70" style={{ color: 'var(--inv-texto)' }}>{content.texto}</p>

      <div className="mt-8 flex flex-col gap-4">
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
                    ? 'border-[var(--inv-acento)] bg-[var(--inv-acento)]/10 text-[#2a7a50]'
                    : 'border-[#e8e8e8] text-[#666]'
                }`}
              >
                <Check size={14} /> Sí
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
                <X size={14} /> No
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

      {!submitted && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !allChosen || submitting}
          className={`${ctx.botonClassName ?? 'inv-btn inv-btn-elevado'} mt-6 block w-full px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {submitting ? 'Enviando…' : 'Confirmar asistencia'}
        </button>
      )}

      {submitted && (
        <p className="mt-6 text-center text-sm font-medium text-[#2a7a50]">¡Gracias por confirmar!</p>
      )}

      {playing && (
        <RsvpAnimation
          key={playKey}
          open
          kind={playing}
          animId={playing === 'si' ? anim.si : anim.no}
          message={playing === 'si' ? SI_MSG : NO_MSG}
          onDone={() => {
            setPlaying(null)
            if (!isPreview) setSubmitted(true)
          }}
        />
      )}
    </SectionShell>
  )
}
