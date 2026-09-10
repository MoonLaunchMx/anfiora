import type { EventBudget, EventSupplier } from '@/lib/types'

// Un proveedor puede traer varias partidas (el hotel: habitaciones, banquete,
// salon, mobiliario) y cada partida tiene SU contrato: lo que se acordo por
// ese concepto, escrito por el planner al contratar. El contratado del
// proveedor es la suma. Aqui ya no se reparte el contrato: el reparto
// proporcional inventaba montos que nadie tecleo (issue #68).

type Reparto = {
  contractedByItem: Record<string, number>
  paidByItem: Record<string, number>
}

type PartidaLigada = Pick<EventBudget, 'id' | 'event_supplier_id' | 'budget_amount' | 'contract_amount'>

// Los pagos siguen siendo del proveedor: no se captura a que partida va cada
// anticipo. Se muestran por partida en proporcion a lo CONTRATADO de cada
// una, que ahora si es un numero real; si ninguna trae contrato, en partes
// iguales.
function repartirPago(total: number, partidas: PartidaLigada[]): Record<string, number> {
  const salida: Record<string, number> = {}
  if (partidas.length === 0) return salida
  const contrato = (b: PartidaLigada) => Math.max(0, Number(b.contract_amount) || 0)
  const base = partidas.reduce((suma, b) => suma + contrato(b), 0)
  partidas.forEach(b => {
    salida[b.id] = base > 0 ? total * (contrato(b) / base) : total / partidas.length
  })
  return salida
}

export function repartirEntrePartidas(
  budgets: PartidaLigada[],
  pagadoPorProveedor: Record<string, number>,
): Reparto {
  const contractedByItem: Record<string, number> = {}
  const paidByItem: Record<string, number> = {}
  const porProveedor: Record<string, PartidaLigada[]> = {}

  budgets.forEach(b => {
    contractedByItem[b.id] = b.event_supplier_id ? (Number(b.contract_amount) || 0) : 0
    paidByItem[b.id] = 0
    if (b.event_supplier_id) (porProveedor[b.event_supplier_id] ??= []).push(b)
  })

  Object.entries(porProveedor).forEach(([proveedorId, partidas]) => {
    Object.assign(paidByItem, repartirPago(pagadoPorProveedor[proveedorId] || 0, partidas))
  })

  return { contractedByItem, paidByItem }
}

// Una sola liga: la partida dice de quien es. El proveedor ya no apunta a
// ninguna partida desde su lado.
export function partidasDelProveedor<T extends Pick<EventBudget, 'event_supplier_id'>>(
  item: Pick<EventSupplier, 'id'>,
  budgets: T[],
): T[] {
  return budgets.filter(b => b.event_supplier_id === item.id)
}

// La meta contra la que se compara el contrato: la suma de lo estimado en
// sus partidas. null si no tiene ninguna.
export function metaDelProveedor(
  item: Pick<EventSupplier, 'id'>,
  budgets: Pick<EventBudget, 'event_supplier_id' | 'budget_amount'>[],
): number | null {
  const partidas = partidasDelProveedor(item, budgets)
  if (partidas.length === 0) return null
  return partidas.reduce((suma, b) => suma + (Number(b.budget_amount) || 0), 0)
}

// Lo contratado con el proveedor: la suma de sus partidas. null cuando no
// tiene partidas o ninguna trae contrato todavia -- la ficha lo dice y pide
// ponerlo en el presupuesto.
export function contratadoDelProveedor(
  item: Pick<EventSupplier, 'id'>,
  budgets: Pick<EventBudget, 'event_supplier_id' | 'contract_amount'>[],
): number | null {
  const conContrato = partidasDelProveedor(item, budgets).filter(b => b.contract_amount != null)
  if (conContrato.length === 0) return null
  return conContrato.reduce((suma, b) => suma + (Number(b.contract_amount) || 0), 0)
}
