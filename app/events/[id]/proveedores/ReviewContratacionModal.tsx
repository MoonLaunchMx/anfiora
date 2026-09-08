'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import EscalaCinco from '@/app/components/ui/EscalaCinco'
import { anclasDe, EJES_PROPUESTA, NOMBRE_EJE, DESCRIPCION_EJE_PROPUESTA } from '@/lib/reviews/ejes'
import type { Eje } from '@/lib/reviews/ejes'
import { validarReview } from '@/lib/reviews/validacion'
import type { BorradorReview } from '@/lib/reviews/validacion'
import { useGuardarReview } from '@/lib/reviews/useGuardarReview'
import {
  RAZONES_SELECCION, RAZON_SELECCION_LABEL, MAX_RAZONES_SELECCION, MAX_COMENTARIOS,
} from '@/lib/types'
import type { RazonSeleccion, SupplierReview } from '@/lib/types'

interface Props {
  eventSupplierId: string
  supplierId: string
  eventId: string
  duenoId: string
  createdBy: string
  supplierName: string
  eventName: string
  reviewExistente?: SupplierReview | null
  onSaved: () => void
  onSkip: () => void
}

export default function ReviewContratacionModal({
  eventSupplierId, supplierId, eventId, duenoId, createdBy, supplierName,
  reviewExistente, onSaved, onSkip,
}: Props) {
  const { permiso, saving, guardar } = useGuardarReview({ eventSupplierId, supplierId, eventId, duenoId, createdBy })

  const [valores, setValores] = useState<Record<Eje, number | null>>({
    precio_valor: reviewExistente?.precio_valor ?? null,
    calidad: reviewExistente?.calidad ?? null,
    comunicacion: reviewExistente?.comunicacion ?? null,
    servicio_trato: null, manejo_imprevistos: null,
  })
  const [razones, setRazones]         = useState<RazonSeleccion[]>(reviewExistente?.razones_seleccion ?? [])
  const [comentarios, setComentarios] = useState(reviewExistente?.comentarios ?? '')
  const [problemas, setProblemas]     = useState<string[]>([])

  const toggleRazon = (r: RazonSeleccion) => {
    setRazones(prev => {
      if (prev.includes(r)) return prev.filter(x => x !== r)
      if (prev.length >= MAX_RAZONES_SELECCION) return prev
      return [...prev, r]
    })
  }

  const handleSave = async () => {
    if (!permiso.editar) return
    const borrador: BorradorReview = {
      review_type: 'contratacion' as const,
      precio_valor: valores.precio_valor, calidad: valores.calidad,
      comunicacion: valores.comunicacion,
      servicio_trato: null, manejo_imprevistos: null,
      razones_seleccion: razones, motivo_descarte: null,
      recontratacion: null, cobros_extra: null,
      comentarios: comentarios.trim() || null,
    }
    const problemas = validarReview(borrador)
    if (problemas.length > 0) { setProblemas(problemas); return }

    const error = await guardar(borrador)
    if (error) { setProblemas([error]); return }
    onSaved()
  }

  return (
    <Modal open onClose={onSkip} size="md">
      <Modal.Header title="¿Por qué se quedó?" subtitle={`Cerraste con ${supplierName}`}>
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-[var(--success-border)] bg-[var(--success-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--success-text)]">
          <Check size={10} strokeWidth={2.5} />
          Contratado
        </span>
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-6">
          <div>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Pregunta 1 — Califica la propuesta
            </label>
            <div className="space-y-4">
              {EJES_PROPUESTA.map(eje => (
                <EscalaCinco
                  key={eje}
                  nombre={NOMBRE_EJE[eje]}
                  anclas={anclasDe('propuesta', eje)}
                  descripcion={DESCRIPCION_EJE_PROPUESTA[eje]}
                  valor={valores[eje]}
                  onChange={v => setValores(prev => ({ ...prev, [eje]: typeof v === 'number' ? v : null }))}
                  deshabilitado={!permiso.editar}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Pregunta 2 — ¿Por qué elegimos a este proveedor?
            </label>
            <div className="flex flex-wrap gap-2">
              {RAZONES_SELECCION.map(r => {
                const seleccionada = razones.includes(r)
                const bloqueada = !seleccionada && razones.length >= MAX_RAZONES_SELECCION
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={!permiso.editar || bloqueada}
                    aria-pressed={seleccionada}
                    onClick={() => toggleRazon(r)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      seleccionada
                        ? 'border-[var(--text)] bg-[var(--text)] text-white'
                        : 'border-[var(--border)] bg-white text-[var(--text-sec)] hover:bg-[var(--hover)]'
                    } ${bloqueada ? 'opacity-40' : ''} disabled:cursor-not-allowed`}
                  >
                    {RAZON_SELECCION_LABEL[r]}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-sec)]">{razones.length} de {MAX_RAZONES_SELECCION}</p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Pregunta 3 — Comentarios adicionales{' '}
              <span className="font-normal normal-case tracking-normal text-[var(--text-dim)]">(opcional)</span>
            </label>
            <textarea
              value={comentarios}
              onChange={e => setComentarios(e.target.value)}
              maxLength={MAX_COMENTARIOS}
              rows={3}
              disabled={!permiso.editar}
              placeholder="Cualquier cosa que valga la pena recordar de este proveedor"
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#48C9B0] disabled:opacity-60"
            />
            <p className="mt-1 text-right text-xs text-[var(--text-muted)]">{comentarios.length} / {MAX_COMENTARIOS}</p>
          </div>

          {problemas.length > 0 && (
            <div className="space-y-1 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2">
              {problemas.map(p => (
                <p key={p} className="text-xs text-[var(--error-text)]">{p}</p>
              ))}
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          onClick={onSkip}
          disabled={saving}
          className="ml-auto px-4 py-2 text-sm text-[var(--text-sec)] hover:text-[var(--text)] disabled:opacity-50"
        >
          Después
        </button>
        {permiso.editar && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[#48C9B0] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3aa896] disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar review'}
          </button>
        )}
      </Modal.Footer>
    </Modal>
  )
}
