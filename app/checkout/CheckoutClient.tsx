'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Lock, CreditCard, ShieldCheck, Loader2 } from 'lucide-react'
import {
  ANFITRION_PLANS,
  ANFITRION_ILIMITADO,
  ORGANIZADOR_PLANS,
  formatMXN,
} from '@/lib/pricing'

type Tipo = 'anfitrion' | 'organizador'
type Billing = 'mensual' | 'anual'

interface Summary {
  name: string
  tagline: string
  bullets: string[]
  isTrial: boolean
  recurringLabel: string
  cadence: string
  strike: string | null
  dueTodayLabel: string
  payText: string
}

function resolve(tipo: Tipo, plan: string): Summary | null {
  if (tipo === 'anfitrion') {
    if (plan === 'ilimitado') {
      return {
        name: 'Anfiora Sin Límites',
        tagline: 'Invitados ilimitados en tu evento',
        bullets: ['Invitados ilimitados', 'Exportar a Excel y PDF', 'Equipo de tu evento', 'Agente IA WhatsApp disponible'],
        isTrial: false,
        recurringLabel: formatMXN(ANFITRION_ILIMITADO.price),
        cadence: 'Pago único por tu evento',
        strike: null,
        dueTodayLabel: formatMXN(ANFITRION_ILIMITADO.price),
        payText: `Pagar ${formatMXN(ANFITRION_ILIMITADO.price)}`,
      }
    }
    const p = ANFITRION_PLANS.find(x => x.id === plan)
    if (!p || p.price === 0) return null
    return {
      name: `Anfiora ${p.name}`,
      tagline: `Hasta ${p.guestLimit} invitados · equipo de ${p.collaborators}`,
      bullets: p.bullets,
      isTrial: false,
      recurringLabel: formatMXN(p.price),
      cadence: 'Pago único por tu evento',
      strike: null,
      dueTodayLabel: formatMXN(p.price),
      payText: `Pagar ${formatMXN(p.price)}`,
    }
  }
  const p = ORGANIZADOR_PLANS.find(x => x.id === plan)
  if (!p) return null
  const founder = p.founderPrice
  return {
    name: `Anfiora ${p.name}`,
    tagline: `${p.activeEvents} eventos activos · ${p.seats} ${p.seats === 1 ? 'usuario' : 'usuarios'}`,
    bullets: p.bullets,
    isTrial: true,
    recurringLabel: formatMXN(founder),
    cadence: '/mes · facturado anual',
    strike: formatMXN(p.listMonthly),
    dueTodayLabel: '$0',
    payText: 'Iniciar prueba',
  }
}

function Field({ label, placeholder, type = 'text' }: { label: string; placeholder: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-[#555]">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm text-[#0a0a0a] outline-none transition placeholder:text-[#bbb] focus:border-[#48C9B0] focus:ring-2 focus:ring-[#48C9B0]/20"
      />
    </label>
  )
}

export default function CheckoutClient({ tipo, plan, billing }: { tipo: Tipo; plan: string; billing: Billing }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const summary = resolve(tipo, plan)

  if (!summary) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#f8f8f8] px-5 text-center">
        <p className="text-lg font-bold text-[#0a0a0a]">Plan no válido</p>
        <p className="mt-1.5 text-sm text-[#666]">No pudimos identificar el plan que elegiste.</p>
        <Link href="/precios" className="mt-5 rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]">
          Volver a precios
        </Link>
      </main>
    )
  }

  const pay = () => {
    setLoading(true)
    const params = new URLSearchParams({ tipo, plan })
    if (tipo === 'organizador') params.set('billing', billing)
    setTimeout(() => router.push(`/checkout/exito?${params.toString()}`), 1100)
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-[#f0c98a] bg-[#fffbf0] px-5 py-2 text-center text-[12.5px] text-[#8a6d1f]">
        Modo prueba · pago simulado · Stripe aún no está conectado
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 lg:min-h-[calc(100vh-37px)] lg:grid-cols-2">
        {/* Resumen del pedido */}
        <div className="border-b border-[#eee] bg-[#fafafa] px-6 py-8 sm:px-10 lg:border-b-0 lg:border-r">
          <Link href="/precios" className="mb-8 inline-flex items-center gap-1 text-[13px] text-[#666] transition hover:text-[#0a0a0a]">
            <ChevronLeft className="h-4 w-4" /> Volver
          </Link>

          <div className="text-[13px] text-[#888]">{summary.isTrial ? 'Suscríbete a' : 'Paga'}</div>
          <div className="mt-0.5 text-xl font-bold text-[#0a0a0a]">{summary.name}</div>
          <div className="mt-0.5 text-[13px] text-[#888]">{summary.tagline}</div>

          <div className="mt-7 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#0a0a0a]">{summary.recurringLabel}</span>
            {summary.strike && <span className="text-sm text-[#bbb] line-through">{summary.strike}</span>}
            <span className="text-[13px] text-[#888]">{summary.cadence}</span>
          </div>

          {summary.isTrial && (
            <div className="mt-4 rounded-lg border border-[#a0e0c0] bg-[#f0fff6] px-3.5 py-2.5 text-[12.5px] text-[#2a7a50]">
              Prueba de 14 días — hoy no se te cobra. Cancela cuando quieras.
            </div>
          )}

          <div className="mt-7 border-t border-[#eee] pt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-[#0a0a0a]">Total a pagar hoy</span>
              <span className="font-extrabold text-[#0a0a0a]">{summary.dueTodayLabel}</span>
            </div>
          </div>

          <ul className="mt-6 flex flex-col gap-2">
            {summary.bullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-[#666]">
                <ShieldCheck className="mt-[1px] h-[15px] w-[15px] shrink-0 text-[#48C9B0]" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Formulario de pago (esqueleto) */}
        <div className="px-6 py-8 sm:px-10">
          <div className="flex flex-col gap-4">
            <Field label="Correo" placeholder="tu@correo.com" type="email" />

            <div>
              <span className="mb-1.5 block text-[12.5px] font-medium text-[#555]">Información de la tarjeta</span>
              <div className="overflow-hidden rounded-lg border border-[#e0e0e0]">
                <div className="flex items-center gap-2 border-b border-[#eee] px-3 py-2.5">
                  <CreditCard className="h-4 w-4 text-[#bbb]" />
                  <input
                    placeholder="1234 1234 1234 1234"
                    className="w-full bg-transparent text-sm text-[#0a0a0a] outline-none placeholder:text-[#bbb]"
                  />
                </div>
                <div className="flex">
                  <input
                    placeholder="MM / AA"
                    className="w-1/2 border-r border-[#eee] bg-transparent px-3 py-2.5 text-sm text-[#0a0a0a] outline-none placeholder:text-[#bbb]"
                  />
                  <input
                    placeholder="CVC"
                    className="w-1/2 bg-transparent px-3 py-2.5 text-sm text-[#0a0a0a] outline-none placeholder:text-[#bbb]"
                  />
                </div>
              </div>
            </div>

            <Field label="Nombre en la tarjeta" placeholder="Como aparece en la tarjeta" />

            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-[#555]">País</span>
              <select
                defaultValue="MX"
                className="w-full appearance-none rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm text-[#0a0a0a] outline-none transition focus:border-[#48C9B0] focus:ring-2 focus:ring-[#48C9B0]/20"
              >
                <option value="MX">México</option>
                <option value="US">Estados Unidos</option>
                <option value="CO">Colombia</option>
                <option value="AR">Argentina</option>
                <option value="ES">España</option>
              </select>
            </label>

            <button
              onClick={pay}
              disabled={loading}
              className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Procesando…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" /> {summary.payText}
                </>
              )}
            </button>

            <p className="text-center text-[11px] text-[#bbb]">
              Pantalla de prueba. Los campos no procesan datos reales y no se realiza ningún cargo.
            </p>

            <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-[#bbb]">
              <Lock className="h-3 w-3" /> Pago seguro — Powered by Stripe
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
