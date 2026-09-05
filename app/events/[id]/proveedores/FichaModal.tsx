'use client'

import { Modal } from '@/app/components/ui/Modal'
import { Currency, EventBudget, EventSupplier, Supplier, SupplierStatus } from '@/lib/types'
import { Categoria } from '@/lib/rolodex/categorias-store'
import FichaDelEvento from './FichaDelEvento'

type SupplierWithDetails = EventSupplier & { supplier: Supplier }

type Props = {
  item: SupplierWithDetails
  budgets: EventBudget[]
  currency: Currency
  categorias: Categoria[]
  bodaPaso: boolean
  onClose: () => void
  onStatusChange: (itemId: string, nuevo: SupplierStatus) => void
  onSaved: (item: SupplierWithDetails) => void
  onQuitada: (itemId: string) => void
}

// La misma ficha del fichero, metida en una ventana: fuera de la vista Fichero
// no hay panel donde vivir, pero el contenido no cambia.
export default function FichaModal({ onClose, ...ficha }: Props) {
  return (
    <Modal open onClose={onClose} size="2xl">
      <div className="flex h-[78dvh] max-h-[740px] flex-col overflow-hidden">
        <FichaDelEvento
          {...ficha}
          onCerrar={onClose}
          onQuitada={id => { ficha.onQuitada(id); onClose() }}
        />
      </div>
    </Modal>
  )
}
