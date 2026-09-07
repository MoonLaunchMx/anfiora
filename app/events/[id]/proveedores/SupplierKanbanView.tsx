'use client'

import { ComponentType, useState } from 'react'
import {
  DndContext, DragEndEvent, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
} from '@dnd-kit/core'
import { Globe, Mail, Star } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { FiFacebook, FiInstagram } from 'react-icons/fi'
import {
  Currency, formatCurrency, MotivoDescarte, MOTIVO_DESCARTE_LABEL,
  EventSupplier, Supplier, EventBudget, SupplierStatus,
  SUPPLIER_STATUSES, SUPPLIER_STATUS_LABELS, SUPPLIER_STATUS_COLORS,
} from '@/lib/types'
import { Categoria, nombrePorId } from '@/lib/rolodex/categorias-store'
import { contactosDe, Contacto, ContactoTipo } from '@/lib/rolodex/contactos'
import { dineroDeTarjeta } from '@/lib/rolodex/tarjeta-kanban'

type SupplierWithDetails = EventSupplier & { supplier: Supplier }

type Props = {
  items: SupplierWithDetails[]
  budgets: EventBudget[]
  currency: Currency
  categorias: Categoria[]
  desempenoPorProveedor: Record<string, number | null>
  paidByItem: Record<string, number>
  motivoDescartePorItem: Record<string, MotivoDescarte | null>
  onSelect: (item: SupplierWithDetails) => void
  onStatusChange: (itemId: string, newStatus: SupplierStatus) => void
  puedeEditar: boolean
}

const VISIBLE_STATUSES: SupplierStatus[] = ['nuevo', 'cotizado', 'contratado']

export default function SupplierKanbanView({
  items, budgets, currency, categorias, desempenoPorProveedor, paidByItem, motivoDescartePorItem,
  onSelect, onStatusChange, puedeEditar,
}: Props) {
  const [showDescartados, setShowDescartados] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const newStatus = over.id as string
    if (!SUPPLIER_STATUSES.includes(newStatus as SupplierStatus)) return
    const draggedItem = items.find(i => i.id === active.id as string)
    if (!draggedItem || draggedItem.status === newStatus) return

    onStatusChange(active.id as string, newStatus as SupplierStatus)
  }

  const itemsByStatus: Record<SupplierStatus, SupplierWithDetails[]> = {
    nuevo: [], cotizado: [], contratado: [], descartado: [],
  }
  items.forEach(item => {
    if (itemsByStatus[item.status]) itemsByStatus[item.status].push(item)
  })

  const descartadosCount = itemsByStatus['descartado'].length

  return (
    <DndContext sensors={puedeEditar ? sensors : []} onDragEnd={handleDragEnd}>
      {/* Sin overflow propio a proposito: cualquier overflow aqui convertiria el
          tablero en su propio contenedor de scroll y el encabezado sticky de
          cada columna dejaria de pegarse al scroll de la pagina. */}
      <div className="flex gap-3 pb-6" style={{ alignItems: 'flex-start' }}>

        {/* Columnas principales */}
        {VISIBLE_STATUSES.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            items={itemsByStatus[status]}
            budgets={budgets}
            currency={currency}
            categorias={categorias}
            desempenoPorProveedor={desempenoPorProveedor}
            paidByItem={paidByItem}
            motivoDescartePorItem={motivoDescartePorItem}
            onSelect={onSelect}
            puedeEditar={puedeEditar}
          />
        ))}

        {/* Descartados — barra vertical colapsada, expande como columna */}
        <div className="flex shrink-0 flex-col" style={{ alignSelf: 'flex-start' }}>
          {!showDescartados ? (
            <button
              onClick={() => setShowDescartados(true)}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#e0e0e0] bg-[#fafafa] px-3 py-4 text-[#bbb] transition hover:border-[#888] hover:text-[#888]"
              style={{ width: 36, minHeight: 120 }}
            >
              <span
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  transform: 'rotate(180deg)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                Descartados
              </span>
              {descartadosCount > 0 && (
                <span className="rounded-full bg-[#e8e8e8] px-1.5 py-0.5 text-[9px] font-bold text-[#888]">
                  {descartadosCount}
                </span>
              )}
            </button>
          ) : (
            <div className="w-[220px]">
              <button
                onClick={() => setShowDescartados(false)}
                className="mb-2 flex w-full items-center justify-between rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#888] transition hover:text-[#1D1E20]"
              >
                <span>Descartados</span>
                <span className="font-normal text-[#bbb]">({descartadosCount}) ✕</span>
              </button>
              <KanbanColumn
                status="descartado"
                items={itemsByStatus['descartado']}
                budgets={budgets}
                currency={currency}
                categorias={categorias}
                desempenoPorProveedor={desempenoPorProveedor}
                paidByItem={paidByItem}
                motivoDescartePorItem={motivoDescartePorItem}
                onSelect={onSelect}
                puedeEditar={puedeEditar}
                dimmed
              />
            </div>
          )}
        </div>

      </div>
    </DndContext>
  )
}

// ── COLUMNA ───────────────────────────────────────────────────────────────

function KanbanColumn({
  status, items, budgets, currency, categorias, desempenoPorProveedor, paidByItem, motivoDescartePorItem, onSelect, puedeEditar, dimmed = false,
}: {
  status: SupplierStatus
  items: SupplierWithDetails[]
  budgets: EventBudget[]
  currency: Currency
  categorias: Categoria[]
  desempenoPorProveedor: Record<string, number | null>
  paidByItem: Record<string, number>
  motivoDescartePorItem: Record<string, MotivoDescarte | null>
  onSelect: (item: SupplierWithDetails) => void
  puedeEditar: boolean
  dimmed?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className={`flex shrink-0 flex-col rounded-xl border p-3 transition lg:w-auto lg:flex-1 ${
        dimmed
          ? 'w-[220px] border-dashed border-[#e0e0e0] bg-[#fafafa] opacity-70'
          : isOver
            ? 'w-[240px] border-[#48C9B0] bg-[#f0fdfb]'
            : 'w-[240px] border-[#e8e8e8] bg-[#fafafa]'
      }`}
    >
      {/* Header pegado: la columna es larga y el planner necesita saber en cual
          esta mientras la recorre. Los margenes negativos lo hacen tapar las
          tarjetas que pasan por debajo, hasta el borde de la columna. */}
      <div
        className={`sticky top-0 z-10 -mx-3 -mt-3 mb-3 flex items-center justify-between rounded-t-xl px-3 pb-2 pt-3 ${
          isOver && !dimmed ? 'bg-[#f0fdfb]' : 'bg-[#fafafa]'
        }`}
      >
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SUPPLIER_STATUS_COLORS[status]}`}>
          {SUPPLIER_STATUS_LABELS[status]}
        </span>
        <span className="text-[10px] font-bold text-[#888]">{items.length}</span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2">
        {items.map(item => (
          <KanbanCard
            key={item.id}
            item={item}
            budgets={budgets}
            currency={currency}
            categorias={categorias}
            desempeno={desempenoPorProveedor[item.supplier_id] ?? null}
            pagado={paidByItem[item.id] ?? 0}
            motivoDescarte={motivoDescartePorItem[item.id] ?? null}
            onSelect={onSelect}
            puedeEditar={puedeEditar}
          />
        ))}
        {items.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#e0e0e0] py-8 text-center">
            <p className="text-[10px] text-[#ccc]">{puedeEditar ? 'Arrastra aquí' : 'Sin proveedores'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── CARD KANBAN ───────────────────────────────────────────────────────────

const ICONO_CONTACTO: Record<ContactoTipo, ComponentType<{ size?: number; className?: string }>> = {
  whatsapp:  FaWhatsapp,
  correo:    Mail,
  instagram: FiInstagram,
  facebook:  FiFacebook,
  sitio:     Globe,
}

const TITULO_CONTACTO: Record<ContactoTipo, string> = {
  whatsapp:  'Abrir WhatsApp',
  correo:    'Enviar correo',
  instagram: 'Abrir Instagram',
  facebook:  'Abrir Facebook',
  sitio:     'Abrir sitio web',
}

function BotonesContacto({ contactos }: { contactos: Contacto[] }) {
  if (contactos.length === 0) return null
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-[#f0f0f0] pt-2.5">
      {contactos.map(contacto => {
        const Icono = ICONO_CONTACTO[contacto.tipo]
        return (
          <a
            key={contacto.tipo}
            href={contacto.href}
            target="_blank"
            rel="noopener noreferrer"
            title={TITULO_CONTACTO[contacto.tipo]}
            onClick={e => e.stopPropagation()}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-[#e0e0e0] bg-white text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
          >
            <Icono size={12} />
          </a>
        )
      })}
    </div>
  )
}

function KanbanCard({
  item, budgets, currency, categorias, desempeno, pagado, motivoDescarte, onSelect, puedeEditar,
}: {
  item: SupplierWithDetails
  budgets: EventBudget[]
  currency: Currency
  categorias: Categoria[]
  desempeno: number | null
  pagado: number
  motivoDescarte: MotivoDescarte | null
  onSelect: (item: SupplierWithDetails) => void
  puedeEditar: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id })

  const dinero = dineroDeTarjeta(item, pagado, motivoDescarte)
  const contactos = contactosDe(item.supplier)

  const linkedBudget = budgets.find(b => b.id === item.event_budget_id)
  const meta = linkedBudget?.budget_amount ?? null
  // La meta se compara contra lo que la tarjeta esta mostrando: contratado si
  // ya lo tiene, cotizado mientras solo hay cotizacion. Un cotizado tambien
  // puede pasarse del presupuesto, no solo un contratado.
  const exceeds = meta !== null && (
    (dinero.tipo === 'contratado' && dinero.contratado > meta) ||
    (dinero.tipo === 'cotizado' && dinero.cotizado > meta)
  )

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(puedeEditar ? attributes : {})}
      {...(puedeEditar ? listeners : {})}
      onClick={() => onSelect(item)}
      className={`rounded-lg border border-[#e8e8e8] bg-white p-3 transition ${
        puedeEditar ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${
        isDragging ? 'opacity-50 shadow-lg' : 'hover:border-[#48C9B0] hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-[#1D1E20]">{item.supplier.name}</p>
          <p className="mt-0.5 truncate text-[10px] text-[#888]">
            {[nombrePorId(categorias, item.supplier.category_id), item.supplier.city].filter(Boolean).join(' · ')}
          </p>
        </div>
        {desempeno != null && (
          <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold tabular-nums text-[#1D1E20]">
            <Star size={11} className="fill-[#d4a853] text-[#d4a853]" />
            {desempeno.toFixed(1)}
          </span>
        )}
      </div>

      {dinero.tipo === 'descarte' && (
        <p className="mt-2.5 border-t border-[#f0f0f0] pt-2.5 text-[11px] text-[#A63B27]">
          {dinero.motivo ? MOTIVO_DESCARTE_LABEL[dinero.motivo] : 'Sin motivo registrado'}
        </p>
      )}

      {dinero.tipo === 'contratado' && (
        <div className="mt-2.5 flex gap-4 border-t border-[#f0f0f0] pt-2.5">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#aaa]">Contratado</p>
            <p className={`text-[13px] font-bold tabular-nums ${exceeds ? 'text-amber-600' : 'text-[#1D1E20]'}`}>
              {formatCurrency(dinero.contratado, currency)}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#aaa]">Pagado</p>
            <p className="text-[13px] font-bold tabular-nums text-[#1D9E75]">
              {formatCurrency(dinero.pagado, currency)}
            </p>
          </div>
        </div>
      )}

      {dinero.tipo === 'cotizado' && (
        <div className="mt-2.5 border-t border-[#f0f0f0] pt-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[#aaa]">Cotizado</p>
          <p className={`text-[13px] font-bold tabular-nums ${exceeds ? 'text-amber-600' : 'text-[#1D1E20]'}`}>
            {formatCurrency(dinero.cotizado, currency)}
            {meta !== null && (
              <span className="ml-1 font-normal text-[#bbb]">/ {formatCurrency(meta, currency)}</span>
            )}
          </p>
        </div>
      )}

      <BotonesContacto contactos={contactos} />
    </div>
  )
}
