'use client'

import { useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import EscalaCinco from '@/app/components/ui/EscalaCinco'
import { anclasDe, EJES_DESEMPENO, NOMBRE_EJE, ANCLAS_RECONTRATACION } from '@/lib/reviews/ejes'
import type { Eje } from '@/lib/reviews/ejes'
import { validarReview } from '@/lib/reviews/validacion'
import type { BorradorReview } from '@/lib/reviews/validacion'
import { useGuardarReview } from '@/lib/reviews/useGuardarReview'
import { MAX_COMENTARIOS, SupplierReview } from '@/lib/types'

interface Props {
  eventSupplierId: string
  supplierId: string
  eventId: string
  duenoId: string
  createdBy: string
  supplierName: string
  eventName: string
  // Cuando ya existe una review de este tipo, la precarga para corregirla en
  // vez de partir en blanco: el upsert de useGuardarReview ya actualiza en
  // vez de duplicar, aqui solo falta no perder lo que se habia contestado.
  reviewExistente?: SupplierReview | null
  onSaved: () => void
  onSkip: () => void
}

const aNumero = (v: number | 'na' | null) => (v === 'na' ? null : v)

// null en la base es ambiguo: puede ser "nunca se calificó" o "se marcó No
// aplicó" (el guardado convierte ambos a null). Solo manejo_imprevistos
// admite No aplicó, asi que es la unica lectura razonable para ese eje; los
// demas son obligatorios y en una review guardada no deberian llegar null.
function valoresIniciales(review?: SupplierReview | null): Record<Eje, number | 'na' | null> {
  const vacio: Record<Eje, number | 'na' | null> = {
    precio_valor: null, calidad: null, comunicacion: null,
    servicio_trato: null, manejo_imprevistos: null,
  }
  if (!review) return vacio
  for (const eje of EJES_DESEMPENO) {
    const valor = review[eje]
    vacio[eje] = valor !== null ? valor : (eje === 'manejo_imprevistos' ? 'na' : null)
  }
  return vacio
}

export default function ReviewDesempenoModal({
  eventSupplierId, supplierId, eventId, duenoId, createdBy, supplierName, eventName,
  reviewExistente, onSaved, onSkip,
}: Props) {
  const { permiso, saving, guardar } = useGuardarReview({ eventSupplierId, supplierId, eventId, duenoId, createdBy })

  const [valores, setValores] = useState<Record<Eje, number | 'na' | null>>(() => valoresIniciales(reviewExistente))
  const [recontratacion, setRecontratacion] = useState<number | null>(reviewExistente?.recontratacion ?? null)
  const [cobrosExtra, setCobrosExtra]       = useState<boolean | null>(reviewExistente?.cobros_extra ?? null)
  const [montoExtra, setMontoExtra]         = useState(reviewExistente?.monto_cobros_extra != null ? String(reviewExistente.monto_cobros_extra) : '')
  const [comentarios, setComentarios]       = useState(reviewExistente?.comentarios ?? '')
  const [problemas, setProblemas]           = useState<string[]>([])

  const handleSave = async () => {
    if (!permiso.editar) return
    const borrador: BorradorReview = {
      review_type: 'post_evento' as const,
      precio_valor: aNumero(valores.precio_valor),
      calidad: aNumero(valores.calidad),
      comunicacion: aNumero(valores.comunicacion),
      servicio_trato: aNumero(valores.servicio_trato),
      manejo_imprevistos: aNumero(valores.manejo_imprevistos),
      razones_seleccion: null, motivo_descarte: null,
      recontratacion, cobros_extra: cobrosExtra,
      comentarios: comentarios.trim() || null,
    }
    const problemas = validarReview(borrador)
    if (problemas.length > 0) { setProblemas(problemas); return }

    const error = await guardar(borrador, {
      monto_cobros_extra: cobrosExtra ? Number(montoExtra) || null : null,
    })
    if (error) { setProblemas([error]); return }
    onSaved()
  }

  return (
    <Modal open onClose={onSkip} size="md">
      <Modal.Header title="¿Cómo te fue con él?" subtitle={`${supplierName} · ${eventName}`}>
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-[#e8d4a6] bg-[var(--accent-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent-dim)]">
          <CalendarCheck size={10} strokeWidth={2.5} />
          Post evento
        </span>
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-6">
          <div>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Pregunta 1 — Califica el desempeño
            </label>
            <div className="space-y-4">
              {EJES_DESEMPENO.map(eje => (
                <EscalaCinco
                  key={eje}
                  nombre={NOMBRE_EJE[eje]}
                  anclas={anclasDe('desempeno', eje)}
                  valor={valores[eje]}
                  onChange={v => setValores(prev => ({ ...prev, [eje]: v }))}
                  noAplico={eje === 'manejo_imprevistos'}
                  etiquetaNoAplico="No aplicó"
                  deshabilitado={!permiso.editar}
                />
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-[#e8d4a6] bg-[var(--accent-bg)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium">¿Hubo cobros extra no acordados?</span>
                <div className="flex gap-2">
                  {[true, false].map(v => (
                    <button
                      key={String(v)}
                      type="button"
                      disabled={!permiso.editar}
                      aria-pressed={cobrosExtra === v}
                      onClick={() => setCobrosExtra(v)}
                      className={`rounded-lg border px-4 py-1.5 text-xs font-semibold transition-colors ${
                        cobrosExtra === v
                          ? 'border-[var(--text)] bg-[var(--text)] text-white'
                          : 'border-[var(--border)] bg-white text-[var(--text-sec)] hover:bg-[var(--hover)]'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {v ? 'Sí' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
              {cobrosExtra === true && (
                <div className="mt-3 flex items-center gap-2">
                  <label htmlFor="monto-extra" className="text-xs text-[var(--text-sec)]">Monto</label>
                  <input
                    id="monto-extra"
                    type="text"
                    inputMode="decimal"
                    value={montoExtra}
                    onChange={e => setMontoExtra(e.target.value)}
                    disabled={!permiso.editar}
                    placeholder="0.00"
                    className="w-32 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm tabular-nums outline-none focus:border-[#48C9B0] disabled:opacity-60"
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Pregunta 2 — ¿Lo volverías a contratar?
            </label>
            <EscalaCinco
              nombre="Probabilidad de recontratación"
              anclas={ANCLAS_RECONTRATACION}
              valor={recontratacion}
              onChange={v => setRecontratacion(typeof v === 'number' ? v : null)}
              deshabilitado={!permiso.editar}
            />
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
              placeholder="Lo que le dirías a alguien de tu equipo que lo va a coordinar"
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
