'use client'

import { useState } from 'react'
import { formatAsYouType } from '@/lib/phone'

type Props = {
  token: string
  maxCompanions: number
  botonClassName?: string
  onRegistrado: () => void
}

const ERRORES: Record<string, string> = {
  cerrada: 'Los registros de este evento están cerrados.',
  bad_request: 'Revisa tu nombre y tu WhatsApp.',
}

function mensajeSinLugar(quedan: number): string {
  if (quedan <= 0) return 'Ya no quedan lugares para este evento.'
  if (quedan === 1) return 'Solo queda 1 lugar. Ajusta cuántos vienen contigo.'
  return `Solo quedan ${quedan} lugares. Ajusta cuántos vienen contigo.`
}

export default function RegistroForm({ token, maxCompanions, botonClassName, onRegistrado }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [companions, setCompanions] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      const res = await fetch(`/api/invitacion/${token}/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, companions }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        if (json?.error === 'sin_lugar') setError(mensajeSinLugar(Number(json.quedan) || 0))
        else setError(ERRORES[json?.error as string] || 'No pudimos registrarte. Intenta de nuevo.')
        return
      }
      onRegistrado()
    } catch {
      setError('No pudimos registrarte. Intenta de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]'

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-sm flex-col gap-3">
      <div>
        <label htmlFor="reg-name" className="mb-1 block text-xs font-medium text-[#666]">Tu nombre</label>
        <input
          id="reg-name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          autoComplete="name"
          className={inputClass}
          placeholder="Nombre y apellido"
        />
      </div>

      <div>
        <label htmlFor="reg-phone" className="mb-1 block text-xs font-medium text-[#666]">Tu WhatsApp</label>
        <input
          id="reg-phone"
          value={phone}
          onChange={e => setPhone(formatAsYouType(e.target.value))}
          required
          inputMode="tel"
          autoComplete="tel"
          className={inputClass}
          placeholder="55 1234 5678"
        />
      </div>

      {/* Si el anfitrion no permite acompanantes el campo no existe: un contador
          clavado en cero solo invita a intentarlo. */}
      {maxCompanions > 0 && (
        <div>
          <label htmlFor="reg-companions" className="mb-1 block text-xs font-medium text-[#666]">¿Cuántos vienen contigo?</label>
          <select
            id="reg-companions"
            value={companions}
            onChange={e => setCompanions(Number(e.target.value))}
            className={inputClass}
          >
            {Array.from({ length: maxCompanions + 1 }, (_, i) => (
              <option key={i} value={i}>{i === 0 ? 'Vengo solo' : `${i}`}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2 text-xs text-[#cc3333]">{error}</p>
      )}

      <button
        type="submit"
        disabled={sending}
        className={`${botonClassName ?? 'inv-btn inv-btn-elevado'} mt-2 block w-full px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {sending ? 'Registrando...' : 'Confirmar mi lugar'}
      </button>
    </form>
  )
}
