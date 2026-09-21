'use client'

import { Modal } from '@/app/components/ui/Modal'
import EscalaCinco from '@/app/components/ui/EscalaCinco'
import Estrellas from '@/app/components/ui/Estrellas'
import { anclasDe, EJES_DESEMPENO, NOMBRE_EJE, ANCLAS_RECOMENDACION_CLIENTE } from '@/lib/reviews/ejes'
import { calcularScores } from '@/lib/reviews/scores'
import { formatCurrency } from '@/lib/types'
import type { Currency, SupplierReview } from '@/lib/types'

type Props = {
  review: SupplierReview
  supplierName: string
  currency: Currency
  onClose: () => void
}

const EJES_OPCIONALES = EJES_DESEMPENO.filter(e => e !== 'manejo_imprevistos')

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[#999]">{titulo}</p>
      {children}
    </section>
  )
}

// Solo de lectura, a proposito: la opinion del cliente no se corrige desde
// aqui. El planner solo necesita poder leerla -- antes el renglon mostraba las
// estrellas y no habia forma de ver que habian contestado.
export default function ReviewClienteModal({ review, supplierName, currency, onClose }: Props) {
  const contestados = EJES_OPCIONALES.filter(eje => review[eje] != null)
  const cuando = review.created_at
    ? new Date(review.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header
        title="Lo que contestó tu cliente"
        subtitle={cuando ? `${supplierName} · ${cuando}` : supplierName}
        right={<Estrellas score={calcularScores([review]).clientes} tamano={13} />}
      />
      <Modal.Body>
        <div className="space-y-6">
          <Bloque titulo="¿Lo recomendarían?">
            <EscalaCinco
              anclas={ANCLAS_RECOMENDACION_CLIENTE}
              valor={review.recontratacion}
              onChange={() => {}}
              deshabilitado
            />
          </Bloque>

          <Bloque titulo="Cómo lo calificaron">
            {contestados.length === 0 ? (
              <p className="text-xs text-[#999]">Solo contestaron la recomendación. El detalle era opcional.</p>
            ) : (
              <div className="space-y-4">
                {contestados.map(eje => (
                  <EscalaCinco
                    key={eje}
                    nombre={NOMBRE_EJE[eje]}
                    anclas={anclasDe('desempeno_cliente', eje)}
                    valor={review[eje]}
                    onChange={() => {}}
                    deshabilitado
                  />
                ))}
              </div>
            )}
          </Bloque>

          <Bloque titulo="Imprevistos">
            {review.manejo_imprevistos == null ? (
              <p className="text-xs text-[#999]">No reportaron ningún imprevisto.</p>
            ) : (
              <EscalaCinco
                nombre="Cómo lo resolvió"
                anclas={anclasDe('desempeno_cliente', 'manejo_imprevistos')}
                valor={review.manejo_imprevistos}
                onChange={() => {}}
                deshabilitado
              />
            )}
          </Bloque>

          <Bloque titulo="Cobros extra">
            {review.cobros_extra == null ? (
              <p className="text-xs text-[#999]">No lo contestaron.</p>
            ) : (
              <p className="text-sm text-[#1D1E20]">
                {review.cobros_extra ? 'Sí les cobró algo extra' : 'No hubo cobros extra'}
                {review.cobros_extra && review.monto_cobros_extra
                  ? ` · ${formatCurrency(review.monto_cobros_extra, currency)}`
                  : ''}
              </p>
            )}
          </Bloque>

          <Bloque titulo="Comentarios">
            {review.comentarios
              ? <p className="whitespace-pre-wrap text-sm text-[#555]">{review.comentarios}</p>
              : <p className="text-xs text-[#999]">Sin comentarios.</p>}
          </Bloque>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-lg bg-[#48C9B0] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3aa896]"
        >
          Cerrar
        </button>
      </Modal.Footer>
    </Modal>
  )
}
