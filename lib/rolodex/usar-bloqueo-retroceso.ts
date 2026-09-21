'use client'

import { supabase } from '@/lib/supabase'
import { useConfirm } from '@/app/components/ui/ConfirmModal'
import { SUPPLIER_STATUS_LABELS } from '@/lib/types'
import type { ArchivoAdjunto, SupplierStatus } from '@/lib/types'
import { bloqueoDe, tieneCotizacionRegistrada } from './bloqueo-retroceso'

type ProveedorConEvidencia = {
  quote_files: ArchivoAdjunto[]
  quoted_amount: number | null
}

// El unico punto de entrada para mover el estado de un proveedor hacia atras.
// La ficha se abre desde Proveedores (fichero, kanban, modal) y desde
// Presupuesto (el item vinculado): son dos paginas con su propio estado local
// y su propia forma de aplicar el cambio, pero ninguna de las dos puede saltarse
// esta pregunta -- por eso vive aqui y no copiado en cada una.
export function useGuardarCambioDeEstado() {
  const askConfirm = useConfirm()

  // Regresa true cuando el movimiento debe detenerse ahi mismo (bloqueado, o
  // el usuario ya recibio y respondio su dialogo). El llamador solo debe
  // seguir aplicando newStatus cuando esto regresa false.
  return async function bloqueaCambioDeEstado(
    itemId: string,
    newStatus: SupplierStatus,
    actual: ProveedorConEvidencia,
    aplicarAlternativa: (destino: SupplierStatus) => void | Promise<void>,
  ): Promise<boolean> {
    if (newStatus !== 'nuevo' && newStatus !== 'cotizado') return false

    const { count, error } = await supabase
      .from('supplier_payments')
      .select('id', { count: 'exact', head: true })
      .eq('event_supplier_id', itemId)

    // Fallar cerrado: si no se pudo comprobar si hay pagos, no se deja pasar
    // el retroceso como si no los hubiera. Lo contrario ya costo un bug real
    // en /admin (un UPDATE filtrado por RLS que reporto exito sin haber escrito).
    if (error) {
      console.error('Error revisando pagos antes de mover:', error.message ?? error, error)
      await askConfirm({
        title: `No se puede mover a ${SUPPLIER_STATUS_LABELS[newStatus]}`,
        message: 'No se pudo comprobar si ya tiene pagos registrados. Intenta de nuevo en un momento.',
        confirmLabel: 'Entendido',
        soloAviso: true,
      })
      return true
    }

    const bloqueo = bloqueoDe(newStatus, {
      tieneCotizacion: tieneCotizacionRegistrada(actual.quote_files, actual.quoted_amount),
      tienePagos: !!count,
    })
    if (!bloqueo) return false

    if (bloqueo.alternativa) {
      const ok = await askConfirm({
        title: `No se puede mover a ${SUPPLIER_STATUS_LABELS[newStatus]}`,
        message: `${bloqueo.motivo} ¿Lo dejamos en ${SUPPLIER_STATUS_LABELS[bloqueo.alternativa]}?`,
        confirmLabel: `Dejar en ${SUPPLIER_STATUS_LABELS[bloqueo.alternativa]}`,
        tone: 'default',
      })
      if (ok) await aplicarAlternativa(bloqueo.alternativa)
    } else {
      await askConfirm({
        title: `No se puede mover a ${SUPPLIER_STATUS_LABELS[newStatus]}`,
        message: bloqueo.motivo,
        confirmLabel: 'Entendido',
        soloAviso: true,
      })
    }
    return true
  }
}
