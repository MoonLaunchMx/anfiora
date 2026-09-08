import type { EventBudget, EventSupplier } from '@/lib/types'

// Un proveedor puede traer varias partidas (el hotel: habitaciones, banquete,
// salon, mobiliario) pero tiene UN solo contrato. Sumar el contrato completo a
// cada partida lo contaba N veces y la categoria salia excedida (issue #68).
// Aqui se reparte una sola vez, en proporcion a lo presupuestado en cada
// partida; si ninguna trae presupuesto, en partes iguales.

type Reparto = {
  contractedByItem: Record<string, number>
  paidByItem: Record<string, number>
}

function repartir(total: number, partidas: EventBudget[]): Record<string, number> {
  const base = partidas.reduce((suma, b) => suma + Math.max(0, Number(b.budget_amount) || 0), 0)
  const salida: Record<string, number> = {}
  if (partidas.length === 0) return salida
  if (base <= 0) {
    partidas.forEach(b => { salida[b.id] = total / partidas.length })
    return salida
  }
  partidas.forEach(b => {
    salida[b.id] = total * (Math.max(0, Number(b.budget_amount) || 0) / base)
  })
  return salida
}

export function repartirEntrePartidas(
  budgets: EventBudget[],
  contratoPorProveedor: Record<string, number>,
  pagadoPorProveedor: Record<string, number>,
): Reparto {
  const porProveedor: Record<string, EventBudget[]> = {}
  budgets.forEach(b => {
    if (!b.event_supplier_id) return
    ;(porProveedor[b.event_supplier_id] ??= []).push(b)
  })

  const contractedByItem: Record<string, number> = {}
  const paidByItem: Record<string, number> = {}
  budgets.forEach(b => { contractedByItem[b.id] = 0; paidByItem[b.id] = 0 })

  Object.entries(porProveedor).forEach(([proveedorId, partidas]) => {
    Object.assign(contractedByItem, repartir(contratoPorProveedor[proveedorId] || 0, partidas))
    Object.assign(paidByItem, repartir(pagadoPorProveedor[proveedorId] || 0, partidas))
  })

  return { contractedByItem, paidByItem }
}

// Las partidas de un proveedor: las que apuntan a el. Si ninguna lo hace,
// la que el proveedor apunta desde su lado (event_budget_id).
export function partidasDelProveedor(
  item: Pick<EventSupplier, 'id' | 'event_budget_id'>,
  budgets: EventBudget[],
): EventBudget[] {
  const ligadas = budgets.filter(b => b.event_supplier_id === item.id)
  if (ligadas.length > 0) return ligadas
  const propia = budgets.find(b => b.id === item.event_budget_id)
  return propia ? [propia] : []
}

// La meta contra la que se compara el contrato: la suma de sus partidas.
export function metaDelProveedor(
  item: Pick<EventSupplier, 'id' | 'event_budget_id'>,
  budgets: EventBudget[],
): number | null {
  const partidas = partidasDelProveedor(item, budgets)
  if (partidas.length === 0) return null
  return partidas.reduce((suma, b) => suma + (Number(b.budget_amount) || 0), 0)
}
