'use client'

import { useState, useEffect } from 'react'
import PhoneInput from '@/app/components/ui/PhoneInput'
import { localeCountry, DEFAULT_COUNTRY, type CountryCode } from '@/lib/phone'
import { montoAPagar } from '@/lib/puerta'
import { formatCurrency, type Currency } from '@/lib/types'
import { reportError } from '@/lib/observabilidad/report'

type Props = {
  token: string
  maxCompanions: number
  botonClassName?: string
  ticketPrice?: number | null
  currency?: Currency
  // Reporta cuantas cabezas (1 + acompanantes) quedaron registradas: quien
  // llama arma el monto congelado con montoAPagar, porque el endpoint no
  // devuelve el monto al navegador anonimo (ni el token).
  onRegistrado: (partySize: number) => void
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

export default function RegistroForm({ token, maxCompanions, botonClassName, ticketPrice, currency = 'MXN', onRegistrado }: Props) {
  const [name, setName] = useState('')
  // PhoneInput emite E.164 ya normalizado, o '' mientras el numero no sea
  // marcable. La puerta es publica y llega gente de cualquier pais: sin selector
  // de lada, un numero extranjero se rechazaba (o peor, se guardaba como mexicano).
  const [phone, setPhone] = useState('')
  // Arranca en Mexico para que servidor y cliente rendericen igual, y adopta el
  // pais del navegador ya montado. En una boda en Espana los invitados son
  // espanoles: obligarlos a corregir "+52" antes de teclear es pedirles que
  // adivinen que el campo asume otro pais.
  const [pais, setPais] = useState<CountryCode>(DEFAULT_COUNTRY)
  const [companions, setCompanions] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const detectado = localeCountry(typeof navigator !== 'undefined' ? navigator.language : null)
    if (detectado) setPais(detectado)
  }, [])

  const partySize = 1 + companions
  const hasPrice = Number(ticketPrice) > 0
  const total = hasPrice ? montoAPagar(ticketPrice, partySize) : 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    // Se avisa aqui y no despues del viaje al servidor: el 400 generico no podia
    // decir cual de los dos campos estaba mal, y el invitado reintentaba a ciegas.
    if (!phone) {
      setError('Revisa tu WhatsApp: elige tu país y escribe el número completo.')
      return
    }
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
      onRegistrado(partySize)
    } catch (err) {
      reportError(err, { zona: 'invitacion-publica' })
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
        <label className="mb-1 block text-xs font-medium text-[#666]">Tu WhatsApp</label>
        <PhoneInput
          value={phone}
          onChange={setPhone}
          defaultCountry={pais}
          placeholder="Número de WhatsApp"
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

      {hasPrice && (
        <div className="flex items-center justify-center gap-1.5 rounded-lg border border-[#f0d896] bg-[#fdf7ea] px-3 py-2.5 text-xs text-[#8a6d1f]">
          <span>{partySize} {partySize === 1 ? 'persona' : 'personas'} × {formatCurrency(Number(ticketPrice), currency)}</span>
          <span className="text-[#c9b98a]">=</span>
          <strong className="text-sm text-[#1D1E20]">{formatCurrency(total, currency)}</strong>
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
        {sending ? (hasPrice ? 'Apartando...' : 'Registrando...') : (hasPrice ? 'Apartar mi lugar' : 'Confirmar mi lugar')}
      </button>
    </form>
  )
}
