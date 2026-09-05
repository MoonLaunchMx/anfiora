'use client'

import { useState } from 'react'
import { Modal } from '@/app/components/ui/Modal'
import { useConfirm } from '@/app/components/ui/ConfirmModal'
import { supabase } from '@/lib/supabase'
import {
  Currency, formatCurrency, SupplierPayment,
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PaymentMethod,
  PAID_BY_OPTIONS, PAID_BY_LABELS, PaidBy,
} from '@/lib/types'

type Props = {
  eventSupplierId: string
  proveedor: string
  currency: Currency
  contratado: number | null
  pagadoHastaAhora: number
  pago?: SupplierPayment | null
  onGuardado: (pago: SupplierPayment) => void
  onCerrar: () => void
}

const INPUT = 'w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#48C9B0]'

export default function PagoModal({
  eventSupplierId, proveedor, currency, contratado, pagadoHastaAhora, pago, onGuardado, onCerrar,
}: Props) {
  const askConfirm = useConfirm()
  const editando = Boolean(pago)

  const [monto, setMonto]           = useState(pago ? pago.amount.toString() : '')
  const [fecha, setFecha]           = useState(pago?.payment_date ?? new Date().toISOString().slice(0, 10))
  const [metodo, setMetodo]         = useState<PaymentMethod>(pago?.payment_method ?? 'transferencia')
  const [responsable, setResponsable] = useState<PaidBy>(pago?.paid_by ?? 'pareja')
  const [referencia, setReferencia] = useState(pago?.reference ?? '')
  const [guardando, setGuardando]   = useState(false)
  const [error, setError]           = useState('')

  const cantidad = parseFloat(monto)
  const valido = !isNaN(cantidad) && cantidad > 0

  const guardar = async () => {
    if (!valido) { setError('Escribe cuánto le pagaste.'); return }

    // Mismo aviso que el formulario completo: pagar de mas casi siempre es un
    // monto acordado que cambio, no un error, asi que se avisa y se deja pasar.
    const yaContado = pago?.amount ?? 0
    if (contratado && contratado > 0 && pagadoHastaAhora - yaContado + cantidad > contratado) {
      const excedente = pagadoHastaAhora - yaContado + cantidad - contratado
      const ok = await askConfirm({
        title: 'Este pago rebasa lo contratado',
        message: `Vas a pagar ${formatCurrency(excedente, currency)} de más a ${proveedor}. Registra el pago si el monto acordado cambió.`,
        confirmLabel: 'Registrar de todos modos',
        tone: 'default',
      })
      if (!ok) return
    }

    setGuardando(true)
    setError('')
    try {
      const campos = {
        amount: cantidad,
        payment_date: fecha,
        payment_method: metodo,
        paid_by: responsable,
        reference: referencia.trim() || null,
      }

      const { data, error: err } = pago
        ? await supabase.from('supplier_payments').update(campos).eq('id', pago.id).select().single()
        : await supabase.from('supplier_payments').insert({ event_supplier_id: eventSupplierId, ...campos }).select().single()

      if (err) throw err
      if (!data) throw new Error('No se guardó el pago.')
      if (data) onGuardado(data as SupplierPayment)
      onCerrar()
    } catch (err: any) {
      console.error('Error guardando pago:', err?.message ?? err, err)
      setError(err?.message ?? 'No se pudo guardar el pago. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const falta = contratado ? Math.max(0, contratado - pagadoHastaAhora) : null

  return (
    <Modal open onClose={onCerrar} size="md">
      <Modal.Header
        title={editando ? 'Editar el pago' : 'Registrar un pago'}
        subtitle={falta !== null ? `${proveedor} · faltan ${formatCurrency(falta, currency)}` : proveedor}
      />
      <Modal.Body>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">
              Cuánto le pagaste
            </label>
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              value={monto}
              onChange={e => { setMonto(e.target.value); setError('') }}
              placeholder="0.00"
              className={INPUT}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">Cuándo</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">Cómo</label>
              <select value={metodo} onChange={e => setMetodo(e.target.value as PaymentMethod)} className={INPUT}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">Quién pagó</label>
            <select value={responsable} onChange={e => setResponsable(e.target.value as PaidBy)} className={INPUT}>
              {PAID_BY_OPTIONS.map(p => <option key={p} value={p}>{PAID_BY_LABELS[p]}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">
              Referencia <span className="font-normal normal-case tracking-normal text-[#bbb]">(opcional)</span>
            </label>
            <input
              type="text"
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              placeholder="Folio, banco o una nota"
              className={INPUT}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2 text-xs text-[#cc3333]">{error}</p>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          onClick={onCerrar}
          className="rounded-lg border border-[#e0e0e0] bg-white px-4 py-2 text-sm font-medium text-[#666] transition hover:bg-[#f5f5f5]"
        >
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={guardando || !valido}
          className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar pago'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}
