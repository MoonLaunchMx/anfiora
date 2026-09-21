'use client'

import { metaDelProveedor, partidasDelProveedor, contratadoDelProveedor } from '@/lib/presupuesto/derivados'
import {
  Currency, formatCurrency,
  EventSupplier, Supplier, EventBudget,
  SUPPLIER_STATUS_LABELS, SUPPLIER_STATUS_COLORS,
} from '@/lib/types'
import { Categoria, nombrePorId } from '@/lib/rolodex/categorias-store'
import Estrellas from '@/app/components/ui/Estrellas'
import { formatDisplay } from '@/lib/phone'
import { telefonoCrudoDe } from '@/lib/rolodex/contactos'
import { formatFechaCorta } from '@/lib/rolodex/fecha-corta'
import { ColumnaListaKey } from '@/lib/rolodex/columnas-lista'

type SupplierWithDetails = EventSupplier & { supplier: Supplier }

type Props = {
  items: SupplierWithDetails[]
  budgets: EventBudget[]
  currency: Currency
  categorias: Categoria[]
  visibleCols: Set<ColumnaListaKey>
  desempenoPorProveedor: Record<string, number | null>
  paidByItem: Record<string, number>
  onSelect: (item: SupplierWithDetails) => void
}

export default function SupplierListView({ items, budgets, currency, categorias, visibleCols, desempenoPorProveedor, paidByItem, onSelect }: Props) {
  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-white pb-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#e8e8e8]">
              {visibleCols.has('proveedor')  && <th className="px-4 py-3 text-left font-semibold text-[#888]">Proveedor</th>}
              {visibleCols.has('categoria')  && <th className="px-4 py-3 text-left font-semibold text-[#888]">Categoría</th>}
              {visibleCols.has('estatus')    && <th className="px-4 py-3 text-left font-semibold text-[#888]">Estatus</th>}
              {visibleCols.has('desempeno')  && <th className="px-4 py-3 text-left font-semibold text-[#888]">Desempeño</th>}
              {visibleCols.has('contacto')   && <th className="px-4 py-3 text-left font-semibold text-[#888]">Contacto</th>}
              {visibleCols.has('telefono')   && <th className="px-4 py-3 text-left font-semibold text-[#888]">Teléfono</th>}
              {visibleCols.has('ciudad')     && <th className="px-4 py-3 text-left font-semibold text-[#888]">Ciudad</th>}
              {visibleCols.has('cotizado')   && <th className="px-4 py-3 text-right font-semibold text-[#888]">Cotizado</th>}
              {visibleCols.has('contratado') && <th className="px-4 py-3 text-right font-semibold text-[#888]">Contratado</th>}
              {visibleCols.has('pagado')     && <th className="px-4 py-3 text-right font-semibold text-[#888]">Pagado</th>}
              {visibleCols.has('partida')    && <th className="px-4 py-3 text-left font-semibold text-[#888]">Partida</th>}
              {visibleCols.has('notas')      && <th className="px-4 py-3 text-left font-semibold text-[#888]">Notas</th>}
              {visibleCols.has('agregado')   && <th className="px-4 py-3 text-left font-semibold text-[#888]">Agregado</th>}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <Fila
                key={item.id}
                item={item}
                visibleCols={visibleCols}
                budgets={budgets}
                currency={currency}
                categorias={categorias}
                desempenoPorProveedor={desempenoPorProveedor}
                paidByItem={paidByItem}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Fila({ item, visibleCols, budgets, currency, categorias, desempenoPorProveedor, paidByItem, onSelect }: {
  item: SupplierWithDetails
  visibleCols: Set<ColumnaListaKey>
  budgets: EventBudget[]
  currency: Currency
  categorias: Categoria[]
  desempenoPorProveedor: Record<string, number | null>
  paidByItem: Record<string, number>
  onSelect: (item: SupplierWithDetails) => void
}) {
  const s = item.supplier
  const partidas = partidasDelProveedor(item, budgets)
  const meta = metaDelProveedor(item, budgets)
  const contratado = contratadoDelProveedor(item, budgets)
  const exceeds = meta !== null && contratado !== null && contratado > meta

  const telCrudo = telefonoCrudoDe(s)
  const telVisible = telCrudo ? formatDisplay(telCrudo) : null
  const pagado = paidByItem[item.id] ?? 0

  return (
    <tr
      onClick={() => onSelect(item)}
      className="cursor-pointer border-b border-[#f0f0f0] transition hover:bg-[#fafafa]"
    >
      {visibleCols.has('proveedor') && (
        <td className="px-4 py-3 font-medium text-[#1D1E20]">{s.name}</td>
      )}
      {visibleCols.has('categoria') && (
        <td className="px-4 py-3 text-[#888]">{nombrePorId(categorias, s.category_id)}</td>
      )}
      {visibleCols.has('estatus') && (
        <td className="px-4 py-3">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SUPPLIER_STATUS_COLORS[item.status]}`}>
            {SUPPLIER_STATUS_LABELS[item.status]}
          </span>
        </td>
      )}
      {visibleCols.has('desempeno') && (
        <td className="px-4 py-3">
          <Estrellas score={desempenoPorProveedor[item.supplier_id] ?? null} tamano={11} />
        </td>
      )}
      {visibleCols.has('contacto') && (
        <td className="px-4 py-3 text-[#888]">{s.contact_name || <span className="text-[#ccc]">—</span>}</td>
      )}
      {visibleCols.has('telefono') && (
        <td className="px-4 py-3 tabular-nums text-[#888]">{telVisible || <span className="text-[#ccc]">—</span>}</td>
      )}
      {visibleCols.has('ciudad') && (
        <td className="px-4 py-3 text-[#888]">{s.city || <span className="text-[#ccc]">—</span>}</td>
      )}
      {visibleCols.has('cotizado') && (
        <td className="px-4 py-3 text-right tabular-nums text-[#888]">
          {item.quoted_amount ? formatCurrency(item.quoted_amount, currency) : <span className="text-[#ccc]">—</span>}
        </td>
      )}
      {visibleCols.has('contratado') && (
        <td className={`px-4 py-3 text-right tabular-nums font-medium ${exceeds ? 'text-amber-600' : 'text-[#1D1E20]'}`}>
          {contratado != null ? formatCurrency(contratado, currency) : <span className="text-[#ccc]">—</span>}
        </td>
      )}
      {visibleCols.has('pagado') && (
        <td className="px-4 py-3 text-right tabular-nums text-[#1D9E75]">
          {pagado > 0 ? formatCurrency(pagado, currency) : <span className="text-[#ccc]">—</span>}
        </td>
      )}
      {visibleCols.has('partida') && (
        <td className="px-4 py-3 text-[#888]">
          {partidas.length > 0
            ? partidas.map(p => p.subcategory || nombrePorId(categorias, p.category_id)).join(' · ')
            : <span className="text-[#ccc]">—</span>}
        </td>
      )}
      {visibleCols.has('notas') && (
        <td className="max-w-[220px] truncate px-4 py-3 text-[#888]">
          {item.event_notes || <span className="text-[#ccc]">—</span>}
        </td>
      )}
      {visibleCols.has('agregado') && (
        <td className="px-4 py-3 tabular-nums text-[#888]">{formatFechaCorta(item.created_at)}</td>
      )}
    </tr>
  )
}
