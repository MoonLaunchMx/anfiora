'use client'

import { useState } from 'react'
import { Ban } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import { PieDeReview, ProblemasDeReview } from './PieDeReview'
import EscalaCinco from '@/app/components/ui/EscalaCinco'
import { anclasDe, EJES_PROPUESTA, NOMBRE_EJE, DESCRIPCION_EJE_PROPUESTA } from '@/lib/reviews/ejes'
import type { Eje } from '@/lib/reviews/ejes'
import { validarReview } from '@/lib/reviews/validacion'
import type { BorradorReview } from '@/lib/reviews/validacion'
import { useGuardarReview } from '@/lib/reviews/useGuardarReview'
import { MOTIVOS_DESCARTE, MOTIVO_DESCARTE_LABEL, MAX_COMENTARIOS } from '@/lib/types'
import type { MotivoDescarte, SupplierReview } from '@/lib/types'

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

export default function ReviewDescarteModal({
  eventSupplierId, supplierId, eventId, duenoId, createdBy, supplierName,
  reviewExistente, onSaved, onSkip,
}: Props) {
  const { permiso, saving, guardar } = useGuardarReview({ eventSupplierId, supplierId, eventId, duenoId, createdBy })

  const [motivo, setMotivo]           = useState<MotivoDescarte | null>(reviewExistente?.motivo_descarte ?? null)
  const [valores, setValores]         = useState<Record<Eje, number | null>>({
    precio_valor: reviewExistente?.precio_valor ?? null,
    calidad: reviewExistente?.calidad ?? null,
    comunicacion: reviewExistente?.comunicacion ?? null,
    servicio_trato: null, manejo_imprevistos: null,
  })
  // Una review guardada con los tres ejes en null es un "No tengo opinion".
  const [sinOpinion, setSinOpinion]   = useState(
    !!reviewExistente && reviewExistente.precio_valor == null && reviewExistente.calidad == null && reviewExistente.comunicacion == null,
  )
  const [comentarios, setComentarios] = useState(reviewExistente?.comentarios ?? '')
  const [problemas, setProblemas]     = useState<string[]>([])

  const handleSave = async () => {
    if (!permiso.editar) return
    const borrador: BorradorReview = {
      review_type: 'descarte' as const,
      precio_valor: valores.precio_valor, calidad: valores.calidad,
      comunicacion: valores.comunicacion,
      servicio_trato: null, manejo_imprevistos: null,
      razones_seleccion: null, motivo_descarte: motivo,
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
      <Modal.Header title="¿Por qué se cayó?" subtitle={`${supplierName} sale del trato`}>
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-[var(--error-border)] bg-[var(--error-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--error-text)]">
          <Ban size={10} strokeWidth={2.5} />
          Descartado
        </span>
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Pregunta 1 — ¿Por qué lo descartamos?
            </label>
            <div className="flex flex-wrap gap-2">
              {MOTIVOS_DESCARTE.map(m => {
                const seleccionado = motivo === m
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={!permiso.editar}
                    aria-pressed={seleccionado}
                    onClick={() => setMotivo(seleccionado ? null : m)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      seleccionado
                        ? 'border-[var(--text)] bg-[var(--text)] text-white'
                        : 'border-[var(--border)] bg-white text-[var(--text-sec)] hover:bg-[var(--hover)]'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {MOTIVO_DESCARTE_LABEL[m]}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Pregunta 2 — Califica la propuesta{' '}
              <span className="font-normal normal-case tracking-normal text-[var(--text-dim)]">(opcional)</span>
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
                  deshabilitado={!permiso.editar || sinOpinion}
                />
              ))}
            </div>
            <button
              type="button"
              disabled={!permiso.editar}
              onClick={() => {
                const apagando = !sinOpinion
                setSinOpinion(apagando)
                if (apagando) setValores(prev => ({ ...prev, precio_valor: null, calidad: null, comunicacion: null }))
              }}
              className="mt-3 border-b border-[var(--border)] pb-0.5 text-xs text-[var(--text-sec)] hover:border-[var(--text-muted)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sinOpinion ? 'Prefiero calificarlo' : 'No tengo opinión'}
            </button>
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
              placeholder="Por qué no funcionó, o qué tendría que cambiar para considerarlo"
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#48C9B0] disabled:opacity-60"
            />
            <p className="mt-1 text-right text-xs text-[var(--text-muted)]">{comentarios.length} / {MAX_COMENTARIOS}</p>
          </div>

          <ProblemasDeReview problemas={problemas} />
        </div>
      </Modal.Body>
      <PieDeReview onSkip={onSkip} onSave={handleSave} saving={saving} puedeEditar={permiso.editar} />
    </Modal>
  )
}
