'use client'

import { useState } from 'react'
import { Copy, Check, CreditCard, Clock } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { formatCurrency, type RegistryPaymentMethod, type Currency } from '@/lib/types'
import { payTypeMeta } from '@/app/events/[id]/mesa-regalos/PaymentMethodModal'

type Props = {
  amount: number
  currency?: Currency
  methods: RegistryPaymentMethod[]
  waHref: string
  partySize: number
  deadline: Date | null
}

// La tarjeta que ve el invitado en cuanto aparta su lugar en un evento con
// precio: no esta "dentro" hasta que el anfitrion confirme el pago (lo hace
// desde la lista, fuera de esta pantalla). Reusa el render con Copiar de
// app/mesa/[token]/page.tsx: mismo dato bancario, mismo gesto.
export default function PagoPendiente({ amount, currency = 'MXN', methods, waHref, partySize, deadline }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // El desglose se deriva del TOTAL congelado (amount = amount_due), nunca del
  // precio vivo del evento: si el anfitrion sube el precio despues de que este
  // invitado se registro, el precio por cabeza mostrado aqui sigue cuadrando
  // con lo que en verdad debe (partySize x perHead === amount, siempre).
  const perHead = partySize > 0 ? amount / partySize : amount

  const copyValue = async (m: RegistryPaymentMethod) => {
    await navigator.clipboard.writeText(m.value)
    setCopiedId(m.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="mx-auto max-w-sm rounded-xl border border-[#f0d896] bg-[#fdf7ea] px-5 py-6 text-center">
      <h2 className="text-base font-semibold text-[#8a6d1f]">Ya casi, falta tu pago</h2>
      <p className="mt-1 text-sm text-[#a68a3a]">Apartamos tu lugar. Transfiere para confirmarlo.</p>

      <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-[#eee4d6] bg-white px-3 py-2 text-xs text-[#666]">
        <span>{partySize} {partySize === 1 ? 'persona' : 'personas'} × {formatCurrency(perHead, currency)}</span>
        <span className="text-[#c9b98a]">=</span>
        <strong className="text-sm text-[#1D1E20]">{formatCurrency(amount, currency)}</strong>
      </div>

      {deadline && (
        <p className="mt-2 flex items-center justify-center gap-1 text-[11px] font-medium text-[#d4a853]">
          <Clock size={12} />
          Paga antes de {deadline.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
        </p>
      )}

      {methods.length > 0 ? (
        <div className="mt-4 space-y-2 text-left">
          {methods.map(m => {
            const meta = payTypeMeta(m.type)
            const title = m.type === 'other' && m.label ? m.label : meta.label
            const sub = [m.bank, m.holder].filter(Boolean).join(' · ')
            return (
              <div key={m.id} className="rounded-lg border border-[#eee4d6] bg-white p-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1D1E20]">
                  <span className="text-[#d4a853]">{meta.icon}</span>
                  {title}
                  {sub && <span className="ml-1 font-normal text-[#999]">{sub}</span>}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="break-all text-xs font-medium tabular-nums text-[#1D1E20]">{m.value}</span>
                  <button
                    type="button"
                    onClick={() => copyValue(m)}
                    className="flex shrink-0 items-center gap-1 rounded-md border border-[#e0e0e0] px-2 py-1 text-[10px] font-medium text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
                  >
                    {copiedId === m.id ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="mt-4 text-xs text-[#a68a3a]">
          El anfitrión todavía no agrega una cuenta. Escríbele por WhatsApp para coordinar.
        </p>
      )}

      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95"
      >
        <FaWhatsapp size={16} /> Ya pagué — enviar comprobante
      </a>

      <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-[#c9b98a]">
        <CreditCard size={12} /> Pagar con tarjeta · Próximamente
      </p>
    </div>
  )
}
