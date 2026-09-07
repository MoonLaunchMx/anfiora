'use client'

import { useEffect, useRef, useState } from 'react'
import { Columns3, Layers } from 'lucide-react'
import {
  Currency, formatCurrency,
  EventSupplier, Supplier, EventBudget, SupplierStatus,
  SUPPLIER_STATUS_LABELS, SUPPLIER_STATUS_COLORS,
} from '@/lib/types'
import { Categoria, nombrePorId } from '@/lib/rolodex/categorias-store'
import Estrellas from '@/app/components/ui/Estrellas'
import { formatDisplay } from '@/lib/phone'
import { telefonoCrudoDe } from '@/lib/rolodex/contactos'
import {
  COLUMNAS_LISTA, COLUMNA_SIEMPRE_VISIBLE, ColumnaListaKey, columnasPorDefecto, agruparPorEstado,
} from '@/lib/rolodex/columnas-lista'

type SupplierWithDetails = EventSupplier & { supplier: Supplier }

type Props = {
  eventId: string
  items: SupplierWithDetails[]
  budgets: EventBudget[]
  currency: Currency
  categorias: Categoria[]
  desempenoPorProveedor: Record<string, number | null>
  paidByItem: Record<string, number>
  onSelect: (item: SupplierWithDetails) => void
}

const storageKey = (eventId: string) => `anfiora_proveedores_${eventId}_columnas`

function cargarColumnas(eventId: string): Set<ColumnaListaKey> {
  if (typeof window === 'undefined') return columnasPorDefecto()
  try {
    const raw = localStorage.getItem(storageKey(eventId))
    if (raw) return new Set(JSON.parse(raw) as ColumnaListaKey[])
  } catch {}
  return columnasPorDefecto()
}

export default function SupplierListView({ eventId, items, budgets, currency, categorias, desempenoPorProveedor, paidByItem, onSelect }: Props) {
  const [visibleCols, setVisibleCols] = useState<Set<ColumnaListaKey>>(() => cargarColumnas(eventId))
  const [showColMenu, setShowColMenu] = useState(false)
  const [agrupar, setAgrupar] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const alClicarFuera = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false)
    }
    document.addEventListener('mousedown', alClicarFuera)
    return () => document.removeEventListener('mousedown', alClicarFuera)
  }, [])

  const toggleCol = (key: ColumnaListaKey) => {
    setVisibleCols(prev => {
      if (key === COLUMNA_SIEMPRE_VISIBLE && prev.has(key)) return prev
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      try { localStorage.setItem(storageKey(eventId), JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

  const grupos: { estado: SupplierStatus | null; items: SupplierWithDetails[] }[] = agrupar
    ? agruparPorEstado(items)
    : [{ estado: null, items }]

  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-white pb-2">
      <div className="flex items-center justify-between gap-2 border-b border-[#e8e8e8] px-4 py-2.5">
        <button
          type="button"
          onClick={() => setAgrupar(v => !v)}
          aria-pressed={agrupar}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            agrupar
              ? 'border-[#48C9B0] bg-[#f0fdfb] text-[#1D9E75]'
              : 'border-[#e0e0e0] text-[#666] hover:border-[#48C9B0] hover:text-[#48C9B0]'
          }`}
        >
          <Layers size={13} />
          Agrupar por estado
        </button>

        <div className="relative" ref={colMenuRef}>
          <button
            onClick={() => setShowColMenu(v => !v)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
          >
            <Columns3 size={13} />Columnas
          </button>
          {showColMenu && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[170px] rounded-xl border border-[#e8e8e8] bg-white p-2 shadow-lg">
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Mostrar columnas</p>
              {COLUMNAS_LISTA.map(col => (
                <label key={col.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-[#f8f8f8]">
                  <input
                    type="checkbox"
                    checked={visibleCols.has(col.key)}
                    onChange={() => toggleCol(col.key)}
                    disabled={col.key === COLUMNA_SIEMPRE_VISIBLE}
                    className="accent-[#48C9B0]"
                  />
                  <span className="text-xs text-[#1D1E20]">{col.label}</span>
                  {col.key === COLUMNA_SIEMPRE_VISIBLE && <span className="ml-auto text-[10px] text-[#ccc]">siempre</span>}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {grupos.map(grupo => (
              <GrupoDeFilas
                key={grupo.estado ?? 'todos'}
                grupo={grupo}
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

function GrupoDeFilas({ grupo, visibleCols, budgets, currency, categorias, desempenoPorProveedor, paidByItem, onSelect }: {
  grupo: { estado: SupplierStatus | null; items: SupplierWithDetails[] }
  visibleCols: Set<ColumnaListaKey>
  budgets: EventBudget[]
  currency: Currency
  categorias: Categoria[]
  desempenoPorProveedor: Record<string, number | null>
  paidByItem: Record<string, number>
  onSelect: (item: SupplierWithDetails) => void
}) {
  return (
    <>
      {grupo.estado && (
        <tr>
          <td colSpan={visibleCols.size} className="bg-[#fafafa] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#888]">
            {SUPPLIER_STATUS_LABELS[grupo.estado]}
            <span className="font-normal normal-case text-[#bbb]"> · {grupo.items.length}</span>
          </td>
        </tr>
      )}
      {grupo.items.map(item => (
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
    </>
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
  const linkedBudget = budgets.find(b => b.id === item.event_budget_id)
  const meta = linkedBudget?.budget_amount ?? null
  const exceeds = meta !== null && item.contract_amount !== null && item.contract_amount > meta

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
          {item.contract_amount ? formatCurrency(item.contract_amount, currency) : <span className="text-[#ccc]">—</span>}
        </td>
      )}
      {visibleCols.has('pagado') && (
        <td className="px-4 py-3 text-right tabular-nums text-[#1D9E75]">
          {pagado > 0 ? formatCurrency(pagado, currency) : <span className="text-[#ccc]">—</span>}
        </td>
      )}
      {visibleCols.has('partida') && (
        <td className="px-4 py-3 text-[#888]">
          {linkedBudget
            ? linkedBudget.subcategory || nombrePorId(categorias, linkedBudget.category_id)
            : <span className="text-[#ccc]">—</span>}
        </td>
      )}
      {visibleCols.has('notas') && (
        <td className="max-w-[220px] truncate px-4 py-3 text-[#888]">
          {item.event_notes || <span className="text-[#ccc]">—</span>}
        </td>
      )}
    </tr>
  )
}
