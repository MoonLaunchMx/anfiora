import type { MotivoDescarte, SupplierStatus } from '@/lib/types'

// Que numero mostrar en la esquina de dinero de la tarjeta Kanban. Un
// descartado no tiene nada de dinero que valga la pena ver ahi -- lo unico
// que importa es por que se cayo.
export type DineroTarjeta =
  | { tipo: 'descarte'; motivo: MotivoDescarte | null }
  | { tipo: 'contratado'; contratado: number; pagado: number }
  | { tipo: 'cotizado'; cotizado: number }
  | { tipo: 'ninguno' }

type ItemParaDinero = {
  status: SupplierStatus
  quoted_amount: number | null
}

// `contratado` viene de la suma de sus partidas (contratadoDelProveedor):
// el proveedor ya no guarda un monto de contrato propio.
export function dineroDeTarjeta(item: ItemParaDinero, contratado: number | null, pagado: number, motivo: MotivoDescarte | null): DineroTarjeta {
  if (item.status === 'descartado') return { tipo: 'descarte', motivo }
  if (contratado != null) return { tipo: 'contratado', contratado, pagado }
  if (item.quoted_amount != null) return { tipo: 'cotizado', cotizado: item.quoted_amount }
  return { tipo: 'ninguno' }
}
