'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Search, Plus, List, Columns3, Disc3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Event, EventBudget, EventSupplier, Supplier,
  SupplierStatus, Currency, formatCurrency,
} from '@/lib/types'
import { Categoria, activas, cargarCategorias, nombrePorId } from '@/lib/rolodex/categorias-store'
import StatsCollapse, { useStatsToggle, StatsToggleButton } from '@/app/components/ui/StatsCollapse'
import AltaProveedor, { EnEstaBoda, ProveedorNuevo } from './AltaProveedor'
import { EntradaDelRolodex } from '@/lib/rolodex/duplicados'
import FichaModal from './FichaModal'
import SupplierReviewModal from './SupplierReviewModal'
import SupplierListView from './SupplierListView'
import SupplierKanbanView from './SupplierKanbanView'
import SupplierFicheroView from './SupplierFicheroView'
import { usePermiso } from '@/lib/event-access-context'
import { Puede } from '@/lib/permisos/Puede'

type SupplierWithDetails = EventSupplier & { supplier: Supplier }
type ViewMode = 'lista' | 'kanban' | 'fichero'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// 'mar 2026' a partir de 'YYYY-MM-DD', partiendo la cadena en vez de construir
// un Date: '2026-03-01' se parsea como UTC y en Mexico regresaria febrero.
function mesYAno(fecha: string | null): string {
  if (!fecha) return ''
  const [ano, mes] = fecha.split('-')
  const i = Number(mes) - 1
  return MESES[i] ? `${MESES[i]} ${ano}` : ano
}

export default function ProveedoresPage() {
  const { id } = useParams()
  const eventId = id as string
  const permiso = usePermiso('proveedores')

  const [event, setEvent]     = useState<Event | null>(null)
  const [items, setItems]     = useState<SupplierWithDetails[]>([])
  const [budgets, setBudgets] = useState<EventBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [duenoCatalogo, setDuenoCatalogo] = useState<string | null>(null)
  const [catalogoBase, setCatalogoBase] = useState<EntradaDelRolodex[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('fichero')
  const [modalOpen, setModalOpen]       = useState(false)
  const [selectedItem, setSelectedItem] = useState<SupplierWithDetails | null>(null)
  const [reviewItem, setReviewItem]     = useState<SupplierWithDetails | null>(null)

  const statsToggle = useStatsToggle(eventId, 'proveedores')

  useEffect(() => { if (eventId) loadAll() }, [eventId])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [eventRes, suppliersRes, budgetsRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('event_suppliers').select('*, supplier:suppliers(*)').eq('event_id', eventId).order('created_at', { ascending: false }),
        supabase.from('event_budgets').select('*').eq('event_id', eventId).order('created_at', { ascending: true }),
      ])
      if (eventRes.data)     setEvent(eventRes.data as Event)
      if (suppliersRes.data) setItems(suppliersRes.data as SupplierWithDetails[])
      if (budgetsRes.data)   setBudgets(budgetsRes.data as EventBudget[])

      // El catalogo (fichas y categorias) es del despacho, no de quien mira:
      // siempre cuelga del dueno del evento. Ver la nota en presupuesto/page.tsx.
      const dueno = (eventRes.data as Event | null)?.user_id ?? null
      setDuenoCatalogo(dueno)
      const [cats] = await Promise.all([
        dueno ? cargarCategorias(dueno) : Promise.resolve([]),
        cargarCatalogo(dueno),
      ])
      setCategorias(cats)
    } catch (err: any) {
      console.error('Error cargando proveedores:', err?.message ?? err, err)
    } finally {
      setLoading(false)
    }
  }

  // El Rolodex entero del dueno del evento: es lo que el alta necesita para
  // avisar de un duplicado antes de crearlo. Hasta hoy el catalogo solo se
  // escribia, nunca se leia.
  const cargarCatalogo = async (dueno: string | null) => {
    if (!dueno) { setCatalogoBase([]); return }

    const { data: fichas, error } = await supabase
      .from('suppliers')
      .select('id, name, category_id, country, state_region, city, phone, email')
      .eq('user_id', dueno)
      .is('archived_at', null)

    if (error) { console.error('Error cargando el Rolodex:', error?.message ?? error, error); setCatalogoBase([]); return }
    if (!fichas || fichas.length === 0) { setCatalogoBase([]); return }

    const ids = fichas.map(f => f.id)
    const { data: usos } = await supabase
      .from('event_suppliers')
      .select('supplier_id, event_id')
      .in('supplier_id', ids)

    // Los nombres de las bodas van en consulta aparte: incrustar events en la
    // anterior la vuelve un inner join y las bodas que el colaborador no puede
    // leer se llevarian la fila entera, falseando el conteo de veces.
    const idsBodas = [...new Set((usos ?? []).map(u => u.event_id))]
    const { data: bodas } = idsBodas.length
      ? await supabase.from('events').select('id, name, event_date').in('id', idsBodas)
      : { data: [] as { id: string; name: string; event_date: string | null }[] }

    const porBoda = new Map((bodas ?? []).map(b => [b.id, b]))

    setCatalogoBase(fichas.map(f => {
      const mios = (usos ?? []).filter(u => u.supplier_id === f.id)
      const conFecha = mios
        .map(u => porBoda.get(u.event_id))
        .filter((b): b is { id: string; name: string; event_date: string | null } => !!b)
        .sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? ''))
      const ultima = conFecha[0]

      return {
        // El nombre de la categoria lo pone el memo de abajo: aqui todavia no
        // hay categorias cargadas, van en paralelo.
        id:          f.id,
        nombre:      f.name,
        categoria:   null,
        categoriaId: f.category_id,
        pais:        f.country,
        estado:      f.state_region,
        ciudad:      f.city,
        telefono:    f.phone,
        correo:      f.email,
        veces:       mios.length,
        ultima:      ultima ? [ultima.name, mesYAno(ultima.event_date)].filter(Boolean).join(' · ') : null,
        enEstaBoda:  false,
      }
    }))
  }

  // enEstaBoda se deriva de los items en vez de guardarse, para que quitar o
  // agregar un proveedor lo refleje solo.
  const catalogo = useMemo(
    () => catalogoBase.map(e => ({
      ...e,
      categoria:  e.categoriaId ? nombrePorId(categorias, e.categoriaId) || null : null,
      enEstaBoda: items.some(i => i.supplier_id === e.id),
    })),
    [catalogoBase, items, categorias],
  )

  const vincularALaBoda = async (supplierId: string, enEstaBoda: EnEstaBoda) => {
    const { data: nuevo, error } = await supabase
      .from('event_suppliers')
      .insert({
        event_id:        eventId,
        supplier_id:     supplierId,
        status:          enEstaBoda.quoted_amount ? 'cotizado' : 'nuevo',
        quoted_amount:   enEstaBoda.quoted_amount,
        event_budget_id: enEstaBoda.event_budget_id,
      })
      .select('*, supplier:suppliers(*)')
      .single()

    if (error) {
      console.error('Error agregando a la boda:', error?.message ?? error, error)
      if (error.code === '23505') throw new Error('Ese proveedor ya está en esta boda')
      throw error
    }
    if (nuevo) setItems(prev => [nuevo as SupplierWithDetails, ...prev])
  }

  const handleUsarExistente = async (supplierId: string, enEstaBoda: EnEstaBoda) => {
    if (!permiso.editar) return
    await vincularALaBoda(supplierId, enEstaBoda)
  }

  const handleCrearNuevo = async (data: ProveedorNuevo) => {
    // La ficha pertenece al despacho, no a quien la teclea. Si naciera con el
    // id de la sesion, un colaborador crearia proveedores que el dueno del
    // evento no puede ver: el join devolveria supplier null y la tarjeta se
    // rompe en la pantalla del dueno.
    if (!permiso.editar) return
    if (!duenoCatalogo) throw new Error('El evento aún no carga, intenta de nuevo')

    const concepto = data.event_budget_id ? budgets.find(b => b.id === data.event_budget_id) : null

    const { data: ficha, error: supErr } = await supabase
      .from('suppliers')
      .insert({
        user_id:            duenoCatalogo,
        name:               data.name,
        category_id:        data.category_id,
        subcategory:        concepto?.subcategory || data.subcategory,
        contact_name:       data.contact_name,
        phone:              data.phone,
        phone_country_code: data.phone_country_code,
        email:              data.email,
        website:            data.website,
        instagram:          data.instagram,
        facebook:           data.facebook,
        country:            data.country,
        city:               data.city,
        state_region:       data.state_region,
        service_radius_km:  data.service_radius_km,
        tags:               data.tags,
        general_notes:      data.general_notes,
      })
      .select()
      .single()

    if (supErr) { console.error('Error creando supplier:', supErr?.message ?? supErr, supErr); throw supErr }

    await vincularALaBoda(ficha.id, data)

    setCatalogoBase(prev => [...prev, {
      id:          ficha.id,
      nombre:      ficha.name,
      categoria:   null,
      categoriaId: ficha.category_id,
      pais:        ficha.country,
      estado:      ficha.state_region,
      ciudad:      ficha.city,
      telefono:    ficha.phone,
      correo:      ficha.email,
      veces:       0,
      ultima:      null,
      enEstaBoda:  false,
    }])
  }

  const handleAbrirEnEstaBoda = (supplierId: string) => {
    const item = items.find(i => i.supplier_id === supplierId)
    setModalOpen(false)
    if (item) setSelectedItem(item)
  }

  const handleSavedItem   = (updated: SupplierWithDetails) =>
    setItems(prev => prev.map(it => it.id === updated.id ? updated : it))
  const handleDeletedItem = (deletedId: string) =>
    setItems(prev => prev.filter(it => it.id !== deletedId))

  // Review se maneja desde page para evitar stacking context de Framer Motion
  const handleReviewNeeded = (item: SupplierWithDetails) => {
    setSelectedItem(null)
    setReviewItem(item)
  }

  const handleStatusChange = async (itemId: string, newStatus: SupplierStatus) => {
    if (!permiso.editar) return
    const prev = items.find(i => i.id === itemId)
    setItems(p => p.map(it => it.id === itemId ? { ...it, status: newStatus } : it))
    const { error } = await supabase.from('event_suppliers').update({ status: newStatus }).eq('id', itemId)
    if (error) { console.error('Error actualizando status:', error?.message ?? error, error); loadAll() }

    // Review al arrastrar en kanban a estado final
    const wasAlreadyFinal = prev?.status === 'contratado' || prev?.status === 'descartado'
    const isNowFinal      = newStatus === 'contratado' || newStatus === 'descartado'
    if (!wasAlreadyFinal && isNowFinal && prev && !prev.rating && !prev.review_text) {
      setReviewItem({ ...prev, status: newStatus })
    }
  }

  const filtered = items.filter(item => {
    const s = item.supplier
    if (search.trim()) {
      const q = search.toLowerCase()
      const categoryName = nombrePorId(categorias, s.category_id)
      const match = s.name.toLowerCase().includes(q) ||
                    (s.subcategory || '').toLowerCase().includes(q) ||
                    categoryName.toLowerCase().includes(q)
      if (!match) return false
    }
    if (filterCategory && s.category_id !== filterCategory) return false
    return true
  })

  const categoriasDelFiltro = (() => {
    const lista = activas(categorias)
    const vistas = new Set(lista.map(c => c.id))
    items.forEach(it => {
      const catId = it.supplier?.category_id
      if (!catId || vistas.has(catId)) return
      const cat = categorias.find(c => c.id === catId)
      if (cat) { lista.push(cat); vistas.add(catId) }
    })
    return lista
  })()

  const totalNuevos      = items.filter(i => i.status === 'nuevo').length
  const totalCotizando   = items.filter(i => i.status === 'cotizado').length
  const totalContratados = items.filter(i => i.status === 'contratado').length
  const totalInvestment  = items
    .filter(i => i.status === 'contratado')
    .reduce((sum, i) => sum + (i.contract_amount || 0), 0)

  if (loading || !event) {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        <div className="h-16 animate-pulse rounded-xl bg-[#f5f5f5]" />
        <div className="h-24 animate-pulse rounded-xl bg-[#f5f5f5]" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-40 animate-pulse rounded-xl bg-[#f5f5f5]" />)}
        </div>
      </div>
    )
  }

  const currency: Currency = event.currency || 'MXN'

  // La resena solo se pregunta despues del evento; si hay rango, manda el ultimo dia.
  const ultimoDia = event.event_end_date || event.event_date
  const bodaPaso = ultimoDia ? new Date(`${ultimoDia}T23:59:59`) < new Date() : false

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff' }}>

      {/* ── HEADER FIJO ── */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #e8e8e8' }} className="px-4 pt-4 pb-0 sm:px-6 sm:pt-5">

        {/* Título + toggle stats mobile */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#1D1E20]">Proveedores</h1>
            <p className="mt-0.5 text-xs text-[#888]">Cotizaciones, contratos y pagos en un solo lugar.</p>
          </div>
          <div className="lg:hidden shrink-0 pt-1">
            <StatsToggleButton visible={statsToggle.visible} onClick={statsToggle.toggle} />
          </div>
        </div>

        {/* Stats */}
        <StatsCollapse visible={statsToggle.visible}>
          <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <StatCard label="Nuevos"      value={totalNuevos.toString()} />
            <StatCard label="Cotizando"   value={totalCotizando.toString()} />
            <StatCard label="Contratados" value={totalContratados.toString()} color="emerald" />
            <StatCard label="Inversión"   value={formatCurrency(totalInvestment, currency)} small />
          </div>
        </StatsCollapse>

        {/* ── TOOLBAR ── */}
        <div className="mb-3 flex items-center gap-2 pb-3">

          {/* Vistas con texto */}
          <div className="hidden shrink-0 overflow-hidden rounded-lg border border-[#e0e0e0] lg:flex">
            <ViewButton active={viewMode === 'lista'} onClick={() => setViewMode('lista')} className="hidden lg:flex">
              <List size={13} />
              <span>Lista</span>
            </ViewButton>
            <ViewButton active={viewMode === 'kanban'} onClick={() => setViewMode('kanban')} className="hidden lg:flex">
              <Columns3 size={13} />
              <span>Kanban</span>
            </ViewButton>
            <ViewButton active={viewMode === 'fichero'} onClick={() => setViewMode('fichero')}>
              <Disc3 size={13} />
              <span>Fichero</span>
            </ViewButton>
          </div>

          {/* Buscador */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar proveedor..."
              className="w-full rounded-lg border border-[#e0e0e0] bg-white py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-[#48C9B0]"
            />
          </div>

          {/* Filtro categoría — solo desktop */}
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="hidden shrink-0 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs outline-none transition focus:border-[#48C9B0] lg:block"
          >
            <option value="">Todas las categorías</option>
            {categoriasDelFiltro.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* CTA */}
          <Puede modulo="proveedores" accion="editar">
            <button
              onClick={() => setModalOpen(true)}
              className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
            >
              <Plus size={14} />
              <span>Proveedor</span>
            </button>
          </Puede>
        </div>
      </div>

      {/* ── CONTENIDO SCROLLABLE ── */}
      <div
        style={{ flex: 1, overflowY: viewMode === 'fichero' ? 'hidden' : 'auto' }}
        className={viewMode === 'fichero' ? 'min-h-0' : 'px-4 pb-6 pt-4 sm:px-6'}
      >
        {filtered.length === 0 && items.length === 0 ? (
          <EmptyState onAdd={() => setModalOpen(true)} puedeEditar={permiso.editar} />
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[30dvh] items-center justify-center rounded-xl border border-dashed border-[#e0e0e0] bg-[#fafafa]">
            <p className="text-sm text-[#888]">Sin resultados con los filtros actuales</p>
          </div>
        ) : (
          <>
            {viewMode === 'lista' && (
              <div className="hidden lg:block">
                <SupplierListView
                  items={filtered}
                  budgets={budgets}
                  currency={currency}
                  categorias={categorias}
                  onSelect={setSelectedItem}
                />
              </div>
            )}
            {viewMode === 'kanban' && (
              <div className="hidden lg:block">
                <SupplierKanbanView
                  items={filtered}
                  budgets={budgets}
                  currency={currency}
                  categorias={categorias}
                  onSelect={setSelectedItem}
                  onStatusChange={handleStatusChange}
                  puedeEditar={permiso.editar}
                />
              </div>
            )}
            {viewMode === 'fichero' && (
              <SupplierFicheroView
                items={filtered}
                budgets={budgets}
                currency={currency}
                categorias={categorias}
                bodaPaso={bodaPaso}
                onSelect={setSelectedItem}
                onStatusChange={handleStatusChange}
                onSaved={handleSavedItem}
                onQuitada={handleDeletedItem}
              />
            )}
          </>
        )}
      </div>

      {/* ── MODALES ── */}
      <AltaProveedor
        isOpen={modalOpen && permiso.editar}
        onClose={() => setModalOpen(false)}
        currency={currency}
        budgets={budgets}
        categorias={categorias}
        duenoCatalogo={duenoCatalogo ?? ''}
        catalogo={catalogo}
        eventoNombre={event.name}
        onUsarExistente={handleUsarExistente}
        onCrearNuevo={handleCrearNuevo}
        onAbrirEnEstaBoda={handleAbrirEnEstaBoda}
      />

      {selectedItem && (
        <FichaModal
          item={selectedItem}
          budgets={budgets}
          currency={currency}
          categorias={categorias}
          bodaPaso={bodaPaso}
          onClose={() => setSelectedItem(null)}
          onStatusChange={handleStatusChange}
          onSaved={handleSavedItem}
          onQuitada={handleDeletedItem}
        />
      )}

      {/* Review fuera del DetailModal — evita stacking context de Framer Motion */}
      {reviewItem && permiso.editar && (
        <SupplierReviewModal
          eventSupplierId={reviewItem.id}
          supplierName={reviewItem.supplier.name}
          initialRating={reviewItem.rating}
          initialReview={reviewItem.review_text}
          initialMood={reviewItem.mood}
          initialSpeed={reviewItem.response_speed}
          onSaved={updates => {
            setItems(prev => prev.map(it => it.id === reviewItem.id ? { ...it, ...updates } : it))
            setReviewItem(null)
          }}
          onSkip={() => setReviewItem(null)}
        />
      )}
    </div>
  )
}

// ── COMPONENTES AUXILIARES ─────────────────────────────────────────────────

function ViewButton({ active, onClick, children, className = '' }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-l border-[#e0e0e0] px-3 py-1.5 text-xs font-medium transition first:border-l-0 ${
        active ? 'bg-[#1D1E20] text-white' : 'bg-white text-[#888] hover:bg-[#f5f5f5] hover:text-[#1D1E20]'
      } ${className}`}
    >
      {children}
    </button>
  )
}

function StatCard({ label, value, color, small }: {
  label: string
  value: string
  color?: 'emerald'
  small?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">{label}</p>
      <p className={`mt-1.5 tabular-nums font-bold ${small ? 'text-lg' : 'text-2xl'} ${
        color === 'emerald' ? 'text-[#1D9E75]' : 'text-[#1D1E20]'
      }`}>
        {value}
      </p>
    </div>
  )
}

function EmptyState({ onAdd, puedeEditar }: { onAdd: () => void; puedeEditar: boolean }) {
  return (
    <div className="flex min-h-[40dvh] flex-col items-center justify-center rounded-xl border border-dashed border-[#e0e0e0] bg-[#fafafa] p-6 text-center">
      <p className="text-sm font-semibold text-[#1D1E20]">Sin proveedores aún</p>
      <p className="mt-1 max-w-xs text-xs text-[#888]">
        {puedeEditar
          ? 'Empieza agregando los proveedores con los que estás en contacto.'
          : 'Cuando se agreguen proveedores a esta boda, los verás aquí.'}
      </p>
      {puedeEditar && (
        <button
          onClick={onAdd}
          className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3aa896]"
        >
          <Plus size={14} />
          Agregar proveedor
        </button>
      )}
    </div>
  )
}