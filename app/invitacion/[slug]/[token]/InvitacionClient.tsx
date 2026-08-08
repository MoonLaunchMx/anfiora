'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { isInviteOpen, type RsvpSubmission } from '@/lib/invite'
import type { InviteDoc } from '@/lib/invite/schema'
import { botonClass } from '@/lib/invite/theme-css'
import type { DressCode } from '@/lib/dresscode'
import type { RegistryPaymentMethod, Currency } from '@/lib/types'
import { montoAPagar, plazoPago } from '@/lib/puerta'
import type { ContactoPlanner } from '@/lib/invite/post-confirmacion'
import type { InviteCtx, InviteGuest, InviteCompanion } from '@/app/components/invitacion/types'
import InvitacionRenderer from '@/app/components/invitacion/InvitacionRenderer'
import PreviewBoundary from '@/app/components/invitacion/PreviewBoundary'
import RegistroForm from '@/app/components/invitacion/RegistroForm'
import PagoPendiente from '@/app/components/invitacion/PagoPendiente'
import { PuertaExito } from '@/app/components/invitacion/sections/RsvpSection'

type ApiData = {
  event: InviteCtx['event']
  guest: InviteGuest | null
  companions: InviteCompanion[]
  doc: InviteDoc
  dressCode: DressCode | null
  itinerary: { start_time: string; title: string; location: string | null }[]
  tokens: { playlist: string | null; registry: string | null }
  mode: 'personal' | 'compartida'
  puerta: { seatsLeft: number | null; maxCompanions: number; agotado: boolean } | null
  ticketPrice: number | null
  currency: Currency
  paymentMethods: RegistryPaymentMethod[]
  contacto: ContactoPlanner | null
  amountDue: number | null
  paidAt: string | null
  guestCreatedAt: string | null
}

type Estado = 'ok' | 'no_existe' | 'cerrada'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function InvitacionClient({ token }: { token: string }) {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [estado, setEstado] = useState<Estado>('ok')
  const [registrado, setRegistrado] = useState(false)
  // Monto recien congelado tras registrarse por la liga publica (evento con
  // precio). Vive solo en esta sesion: el endpoint de registro no devuelve el
  // monto ni el token al navegador anonimo, asi que se recalcula en cliente.
  const [montoRegistrado, setMontoRegistrado] = useState<number | null>(null)
  // Cabezas y plazo de pago del mismo registro recien hecho, para el desglose
  // y el "paga antes de" de PagoPendiente. Se congelan junto con el monto.
  const [partySizeRegistrado, setPartySizeRegistrado] = useState<number | null>(null)
  const [deadlineRegistrado, setDeadlineRegistrado] = useState<Date | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await fetch(`/api/invitacion/${token}`)
        if (!res.ok) {
          // 403 = el anfitrion cerro la puerta. No es lo mismo que un link malo.
          if (active) { setEstado(res.status === 403 ? 'cerrada' : 'no_existe'); setLoading(false) }
          return
        }
        const json = (await res.json()) as ApiData
        if (active) { setData(json); setLoading(false) }
      } catch {
        if (active) { setEstado('no_existe'); setLoading(false) }
      }
    }
    load()
    return () => { active = false }
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#FBF7F0]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  if (estado !== 'ok' || !data) {
    const cerrada = estado === 'cerrada'
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#FBF7F0] px-6 text-center">
        <Heart size={28} className="mb-3 text-[#d4a853]" />
        <h1 className="text-lg font-semibold text-[#1D1E20]">
          {cerrada ? 'Los registros están cerrados' : 'Invitación no disponible'}
        </h1>
        <p className="mt-1 max-w-xs text-sm text-[#888]">
          {cerrada
            ? 'El anfitrión cerró los registros de este evento. Si crees que es un error, escríbele.'
            : 'Revisa el link que te compartieron.'}
        </p>
      </div>
    )
  }

  const handleSubmit = async (payload: RsvpSubmission) => {
    const res = await fetch(`/api/invitacion/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('rsvp_failed')
    const result = await res.json() as { guest: { rsvp_status: string; allergies: string[] }; companions: InviteCompanion[] }
    setData(prev => prev && prev.guest ? {
      ...prev,
      guest: { ...prev.guest, rsvp_status: result.guest.rsvp_status, allergies: result.guest.allergies },
      companions: result.companions,
    } : prev)
  }

  const compartida = data.mode === 'compartida'

  // El telefono ya viene resuelto y en digitos desde la API (numero de atencion
  // del evento, o el celular de la cuenta como respaldo solo si hay precio). Sin
  // numero, wa.me abre igual el selector de contacto — mismo patron que ya usan
  // mesa de regalos, comida y playlist para compartir sin destinatario fijo.
  const waMensaje = `¡Hola! Ya transferí para "${data.event.name}". Aquí va mi comprobante:`
  const waHref = `https://wa.me/${data.contacto?.telefono || ''}?text=${encodeURIComponent(waMensaje)}`

  // Reporta el partySize (1 + acompanantes) que acaba de registrarse: el
  // endpoint no devuelve el monto al navegador anonimo, asi que se congela
  // aqui con la misma funcion pura que uso el servidor (montoAPagar). El
  // plazo de pago tambien se congela AHORA (desde = este instante): no se
  // recalcula en cada render, o el "paga antes de" se iria corriendo.
  const handleRegistrado = (partySize: number) => {
    const tienePrecio = Number(data.ticketPrice) > 0
    setMontoRegistrado(tienePrecio ? montoAPagar(data.ticketPrice, partySize) : null)
    setPartySizeRegistrado(tienePrecio ? partySize : null)
    setDeadlineRegistrado(tienePrecio ? plazoPago(new Date(), data.event.event_date, data.event.event_time) : null)
    setRegistrado(true)
  }

  // Plazo del link personal (durable): 24h desde que se creo la fila del
  // invitado, topado al inicio del evento. Solo aplica con precio y con
  // guestCreatedAt (viene del endpoint solo para el link personal).
  const deadlinePersonal = data.guestCreatedAt && Number(data.ticketPrice) > 0
    ? plazoPago(new Date(data.guestCreatedAt), data.event.event_date, data.event.event_time)
    : null

  const ctx: InviteCtx = {
    event: data.event,
    guest: data.guest,
    companions: data.companions,
    dressCode: data.dressCode,
    itinerary: data.itinerary,
    tokens: data.tokens,
    mode: compartida ? 'compartida' : 'public',
    onSubmit: compartida ? undefined : handleSubmit,
    puerta: compartida && data.puerta
      ? {
          token,
          // El selector no ofrece mas acompanantes de los que caben: si quedan
          // 2 lugares, como maximo 1 acompanante (el que se registra + 1 = 2).
          maxCompanions: data.puerta.seatsLeft == null
            ? data.puerta.maxCompanions
            : Math.max(0, Math.min(data.puerta.maxCompanions, data.puerta.seatsLeft - 1)),
          agotado: data.puerta.agotado,
          registrado,
          // Registrarse ES confirmar: no se rebota a ningun lado, el mismo slot
          // pasa a "ya estas dentro" (o "pendiente de pago") y la invitacion
          // sigue visible.
          onRegistrado: handleRegistrado,
          montoRegistrado,
          partySizeRegistrado,
          deadlineRegistrado,
        }
      : undefined,
    deadlinePassed: !isInviteOpen(data.doc.meta, todayISO()),
    botonClassName: botonClass(data.doc.theme),
    ticketPrice: data.ticketPrice,
    currency: data.currency,
    paymentMethods: data.paymentMethods,
    waHref,
    amountDue: data.amountDue,
    paidAt: data.paidAt,
    deadline: deadlinePersonal,
    contacto: data.contacto,
  }

  // El registro vive en el slot del bloque RSVP, donde el anfitrion lo puso.
  // Si borro ese bloque, cae al final: un link publico vivo que no registra a
  // nadie y no avisa es peor que la excepcion fea.
  const hayBloqueRsvp = data.doc.sections.some(s => s.type === 'rsvp')
  const alFinal = compartida && data.puerta && !hayBloqueRsvp
  const agotado = data.puerta?.agotado === true

  return (
    <div className="min-h-[100dvh] bg-[#FBF7F0]">
      <PreviewBoundary>
        <InvitacionRenderer doc={data.doc} ctx={ctx} />

        {alFinal && (
          <section className="px-6 pb-16 pt-4">
            {registrado ? (
              montoRegistrado != null ? (
                <PagoPendiente
                  amount={montoRegistrado}
                  currency={data.currency}
                  methods={data.paymentMethods}
                  waHref={waHref}
                  partySize={partySizeRegistrado ?? 1}
                  deadline={deadlineRegistrado}
                />
              ) : (
                <PuertaExito contacto={data.contacto} eventName={data.event.name} />
              )
            ) : agotado ? (
              <div className="mx-auto max-w-sm rounded-xl border border-[#e8e8e8] bg-white/70 px-5 py-6 text-center">
                <h2 className="text-base font-semibold text-[#1D1E20]">Ya no quedan lugares</h2>
                <p className="mt-1 text-sm text-[#888]">Este evento llegó a su cupo. Escríbele al anfitrión por si se libera alguno.</p>
              </div>
            ) : ctx.deadlinePassed ? (
              <div className="mx-auto max-w-sm rounded-xl border border-[#e8e8e8] bg-white/70 px-5 py-6 text-center">
                <h2 className="text-base font-semibold text-[#1D1E20]">Los registros ya cerraron</h2>
                <p className="mt-1 text-sm text-[#888]">La fecha límite para confirmar ya pasó. Escríbele al anfitrión si todavía quieres ir.</p>
              </div>
            ) : (
              <>
                <h2 className="mb-4 text-center text-lg font-semibold text-[#1D1E20]">Confirma tu asistencia</h2>
                <RegistroForm
                  token={token}
                  maxCompanions={data.puerta!.maxCompanions}
                  botonClassName={ctx.botonClassName}
                  ticketPrice={data.ticketPrice}
                  currency={data.currency}
                  onRegistrado={handleRegistrado}
                />
              </>
            )}
          </section>
        )}
      </PreviewBoundary>
    </div>
  )
}
