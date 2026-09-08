'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Search, Plus, List, Columns2, Columns3, Disc3, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Event, EventBudget, EventSupplier, Supplier, MotivoDescarte,
  SupplierStatus, SUPPLIER_STATUSES, SUPPLIER_STATUS_LABELS, Currency, formatCurrency,
} from '@/lib/types'
import { Categoria, activas, agregarCategoria, cargarCategorias, nombrePorId } from '@/lib/rolodex/categorias-store'
import {
  COLUMNAS_LISTA, COLUMNA_SIEMPRE_VISIBLE, ColumnaListaKey, columnasPorDefecto, columnasValidasDesdeJSON,
} from '@/lib/rolodex/columnas-lista'
import {
  FiltrosProveedores, FiltroDesempeno, FILTROS_DESEMPENO,
  filtrosVacios, contarFiltrosActivos, aplicarFiltrosProveedores,
} from '@/lib/rolodex/filtros'
import StatsCollapse, { useStatsToggle, StatsToggleButton } from '@/app/components/ui/StatsCollapse'
import AltaProveedor, { EnEstaBoda, ProveedorNuevo } from './AltaProveedor'
import { EntradaDelRolodex } from '@/lib/rolodex/duplicados'
import { calcularScores } from '@/lib/reviews/scores'
import type { ReviewParaScore } from '@/lib/reviews/scores'
import { useGuardarCambioDeEstado } from '@/lib/rolodex/usar-bloqueo-retroceso'
import FichaModal from './FichaModal'
import ReviewContratacionModal from './ReviewContratacionModal'
import ReviewDescarteModal from './ReviewDescarteModal'
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

const colStorageKey = (eventId: string) => `anfiora_proveedores_${eventId}_columnas`

function cargarColumnas(eventId: string): Set<ColumnaListaKey> {
  if (typeof window === 'undefined') return columnasPorDefecto()
  try {
    const raw = localStorage.getItem(colStorageKey(eventId))
    // Un JSON.parse que no truena no es lo mismo que una forma valida (ver el
    // comentario de columnasValidasDesdeJSON): se valida la forma antes de
    // confiar en lo guardado, o un valor corrupto deja la Lista sin columnas.
    const validas = raw ? columnasValidasDesdeJSON(JSON.parse(raw)) : null
    if (validas) return validas
  } catch {}
  return columnasPorDefecto()
}

type FiltrosSerializados = { categoria: string[]; estatus: string[]; ciudad: string[]; desempeno: string[] }

const filtroStorageKey = (eventId: string) => `anfiora_proveedores_${eventId}_filtros`

function serializarFiltros(f: FiltrosProveedores): FiltrosSerializados {
  return { categoria: [...f.categoria], estatus: [...f.estatus], ciudad: [...f.ciudad], desempeno: [...f.desempeno] }
}

function cargarFiltros(eventId: string): FiltrosProveedores {
  if (typeof window === 'undefined') return filtrosVacios()
  try {
    const raw = localStorage.getItem(filtroStorageKey(eventId))
    if (raw) {
      const s = JSON.parse(raw) as FiltrosSerializados
      return {
        categoria: new Set(s.categoria ?? []),
        estatus:   new Set((s.estatus ?? []) as SupplierStatus[]),
        ciudad:    new Set(s.ciudad ?? []),
        desempeno: new Set((s.desempeno ?? []) as FiltroDesempeno[]),
      }
    }
  } catch {}
  return filtrosVacios()
}

function conFiltroActualizado(prev: FiltrosProveedores, mutar: (next: FiltrosProveedores) => void): FiltrosProveedores {
  const next: FiltrosProveedores = {
    categoria: new Set(prev.categoria),
    estatus:   new Set(prev.estatus),
    ciudad:    new Set(prev.ciudad),
    desempeno: new Set(prev.desempeno),
  }
  mutar(next)
  return next
}

export default function ProveedoresPage() {
  const { id } = useParams()
  const eventId = id as string
  const permiso = usePermiso('proveedores')
  const bloqueaCambioDeEstado = useGuardarCambioDeEstado()

  const [event, setEvent]     = useState<Event | null>(null)
  const [items, setItems]     = useState<SupplierWithDetails[]>([])
  const [budgets, setBudgets] = useState<EventBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [duenoCatalogo, setDuenoCatalogo] = useState<string | null>(null)
  const [catalogoBase, setCatalogoBase] = useState<EntradaDelRolodex[]>([])
  // Desempeno por proveedor (id de suppliers, no de event_suppliers): se carga
  // una sola vez aqui y baja a Fichero y Kanban, para que ninguna tarjeta pida
  // sus propias reviews.
  const [desempenoPorProveedor, setDesempenoPorProveedor] = useState<Record<string, number | null>>({})
  // Pagado y motivo de descarte por proveedor DE ESTA boda (event_supplier.id,
  // no supplier_id): a diferencia del desempeno, que es la reputacion del
  // proveedor en todas sus bodas, esto es especifico de esta.
  const [paidByItem, setPaidByItem] = useState<Record<string, number>>({})
  // Cuantos pagos tiene cada proveedor: la pestaña Pagos de la ficha lo pinta
  // desde el primer frame en vez de esperar su propia consulta.
  const [conteoPagosPorItem, setConteoPagosPorItem] = useState<Record<string, number>>({})
  const [motivoDescartePorItem, setMotivoDescartePorItem] = useState<Record<string, MotivoDescarte | null>>({})
  const [viewMode, setViewMode] = useState<ViewMode>('fichero')
  const [modalOpen, setModalOpen]       = useState(false)
  const [selectedItem, setSelectedItem] = useState<SupplierWithDetails | null>(null)
  const [enfocar, setEnfocar]           = useState<SupplierWithDetails | null>(null)
  const [reviewItem, setReviewItem]     = useState<SupplierWithDetails | null>(null)
  const [userId, setUserId]             = useState<string | null>(null)
  // Id del proveedor recien calificado desde el aviso automatico de review:
  // se avisa a la ficha que este viendo (Fichero o FichaModal) para que, si
  // es la misma, se quede abierta en la pestana Review. Nunca se decide por
  // posicion en una lista, siempre por este id.
  const [revisionParaId, setRevisionParaId] = useState<string | null>(null)

  const [visibleCols, setVisibleCols] = useState<Set<ColumnaListaKey>>(() => cargarColumnas(eventId))
  const [showColMenu, setShowColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

  const [filtros, setFiltros] = useState<FiltrosProveedores>(() => cargarFiltros(eventId))
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const filterMenuRef = useRef<HTMLDivElement>(null)

  const statsToggle = useStatsToggle(eventId, 'proveedores')

  useEffect(() => { if (eventId) loadAll() }, [eventId])
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  useEffect(() => {
    const alClicarFuera = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false)
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setShowFilterMenu(false)
    }
    document.addEventListener('mousedown', alClicarFuera)
    return () => document.removeEventListener('mousedown', alClicarFuera)
  }, [])

  const toggleCol = (key: ColumnaListaKey) => {
    setVisibleCols(prev => {
      if (key === COLUMNA_SIEMPRE_VISIBLE && prev.has(key)) return prev
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      try { localStorage.setItem(colStorageKey(eventId), JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

  const guardarFiltros = (f: FiltrosProveedores): FiltrosProveedores => {
    try { localStorage.setItem(filtroStorageKey(eventId), JSON.stringify(serializarFiltros(f))) } catch {}
    return f
  }
  const toggleCategoriaFiltro = (id: string) =>
    setFiltros(prev => guardarFiltros(conFiltroActualizado(prev, n => { n.categoria.has(id) ? n.categoria.delete(id) : n.categoria.add(id) })))
  const toggleEstatusFiltro = (s: SupplierStatus) =>
    setFiltros(prev => guardarFiltros(conFiltroActualizado(prev, n => { n.estatus.has(s) ? n.estatus.delete(s) : n.estatus.add(s) })))
  const toggleCiudadFiltro = (c: string) =>
    setFiltros(prev => guardarFiltros(conFiltroActualizado(prev, n => { n.ciudad.has(c) ? n.ciudad.delete(c) : n.ciudad.add(c) })))
  const toggleDesempenoFiltro = (d: FiltroDesempeno) =>
    setFiltros(prev => guardarFiltros(conFiltroActualizado(prev, n => { n.desempeno.has(d) ? n.desempeno.delete(d) : n.desempeno.add(d) })))
  const quitarTodosLosFiltros = () => setFiltros(guardarFiltros(filtrosVacios()))

  const filtrosActivos = contarFiltrosActivos(filtros)

  // Se recalcula cada vez que la lista de proveedores cambia de referencia
  // (alta, baja, cambio de estado): así Lista y Kanban no quedan con el pagado
  // o el motivo de descarte de una versión vieja del proveedor.
  useEffect(() => { cargarDineroYReviews(items.map(i => i.id)) }, [items])

  const cargarDineroYReviews = async (ids: string[]) => {
    if (ids.length === 0) { setPaidByItem({}); setConteoPagosPorItem({}); setMotivoDescartePorItem({}); return }

    const [{ data: pagos, error: errPagos }, { data: descartes, error: errDescartes }] = await Promise.all([
      supabase.from('supplier_payments').select('event_supplier_id, amount').in('event_supplier_id', ids),
      supabase.from('supplier_reviews').select('event_supplier_id, motivo_descarte').eq('review_type', 'descarte').in('event_supplier_id', ids),
    ])
    if (errPagos) console.error('Error cargando pagos de proveedores:', errPagos.message ?? errPagos, errPagos)
    if (errDescartes) console.error('Error cargando motivos de descarte:', errDescartes.message ?? errDescartes, errDescartes)

    const pagosPorItem: Record<string, number> = {}
    const conteoPorItem: Record<string, number> = {}
    for (const p of (pagos ?? []) as { event_supplier_id: string; amount: number }[]) {
      pagosPorItem[p.event_supplier_id] = (pagosPorItem[p.event_supplier_id] ?? 0) + (p.amount || 0)
      conteoPorItem[p.event_supplier_id] = (conteoPorItem[p.event_supplier_id] ?? 0) + 1
    }
    setPaidByItem(pagosPorItem)
    setConteoPagosPorItem(conteoPorItem)

    const motivos: Record<string, MotivoDescarte | null> = {}
    for (const r of (descartes ?? []) as { event_supplier_id: string; motivo_descarte: MotivoDescarte | null }[]) {
      motivos[r.event_supplier_id] = r.motivo_descarte
    }
    setMotivoDescartePorItem(motivos)
  }

  // Desempeno (ids de suppliers): se separa de cargarCatalogo para poder
  // refrescarlo solo, sin releer todo el catalogo, cuando se guarda una
  // review de desempeno. Se mergea sobre lo que ya habia en vez de reemplazar
  // todo el mapa: un refresco parcial (solo los proveedores de esta boda) no
  // debe borrar el desempeno de fichas del Rolodex que no estan en `ids`.
  const cargarDesempeno = async (ids: string[]) => {
    if (ids.length === 0) return
    const { data: reviewRows, error: errReviews } = await supabase
      .from('supplier_reviews')
      .select('supplier_id, review_type, autor, precio_valor, calidad, comunicacion, servicio_trato, manejo_imprevistos')
      .in('supplier_id', ids)
      .eq('review_type', 'post_evento')
      .eq('autor', 'planner')
    if (errReviews) { console.error('Error leyendo las reviews del Rolodex:', errReviews?.message ?? errReviews, errReviews); return }

    const reviewsPorFicha = new Map<string, ReviewParaScore[]>()
    for (const r of (reviewRows ?? []) as (ReviewParaScore & { supplier_id: string })[]) {
      const lista = reviewsPorFicha.get(r.supplier_id) ?? []
      lista.push(r)
      reviewsPorFicha.set(r.supplier_id, lista)
    }
    const desempeno: Record<string, number | null> = {}
    for (const id of ids) desempeno[id] = calcularScores(reviewsPorFicha.get(id) ?? []).desempeno
    setDesempenoPorProveedor(prev => ({ ...prev, ...desempeno }))
  }

  // Se llama tras guardar cualquiera de las cuatro cosas que Lista, Kanban y
  // Fichero muestran pero no viven en `items`: la review de contratacion, la
  // de descarte, la de desempeno post-evento, y un pago. Sin esto esas vistas
  // se quedan con el valor de antes hasta recargar la pagina.
  const refrescarDerivados = () => {
    cargarDineroYReviews(items.map(i => i.id))
    cargarDesempeno(items.map(i => i.supplier_id))
  }

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
    if (!dueno) { setCatalogoBase([]); setDesempenoPorProveedor({}); return }

    const { data: fichas, error } = await supabase
      .from('suppliers')
      .select('id, name, category_id, country, state_region, city, phone, email, tags')
      .eq('user_id', dueno)
      .is('archived_at', null)

    if (error) { console.error('Error cargando el Rolodex:', error?.message ?? error, error); setCatalogoBase([]); setDesempenoPorProveedor({}); return }
    if (!fichas || fichas.length === 0) { setCatalogoBase([]); setDesempenoPorProveedor({}); return }

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

    // El desempeno de cada ficha (para el fichero y el kanban) se calcula aqui
    // una sola vez para todo el catalogo, no tarjeta por tarjeta.
    await cargarDesempeno(ids)

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
        etiquetas:   Array.isArray(f.tags) ? f.tags : [],
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

  const vincularALaBoda = async (supplierId: string, enEstaBoda: EnEstaBoda): Promise<SupplierWithDetails> => {
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
    const item = nuevo as SupplierWithDetails
    setItems(prev => [item, ...prev])
    return item
  }

  // Tras guardar en la alta, aterrizar en la ficha de lo que se acaba de agregar
  // en vez de dejar al usuario en la lista sin mas señal que la fila nueva. En
  // Fichero se sigue el mismo camino que un tap de tarjeta (panel en escritorio,
  // FichaModal en movil, resuelto adentro de SupplierFicheroView); en Lista y
  // Kanban un tap siempre abre FichaModal, asi que se abre directo aqui.
  const abrirFichaTrasAlta = (item: SupplierWithDetails) => {
    if (viewMode === 'fichero') setEnfocar(item)
    else setSelectedItem(item)
  }

  const handleUsarExistente = async (supplierId: string, enEstaBoda: EnEstaBoda) => {
    if (!permiso.editar) return
    const item = await vincularALaBoda(supplierId, enEstaBoda)
    abrirFichaTrasAlta(item)
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

    const item = await vincularALaBoda(ficha.id, data)

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
      etiquetas:   Array.isArray(ficha.tags) ? ficha.tags : [],
      veces:       0,
      ultima:      null,
      enEstaBoda:  false,
    }])

    abrirFichaTrasAlta(item)
  }

  const handleAbrirEnEstaBoda = (supplierId: string) => {
    const item = items.find(i => i.supplier_id === supplierId)
    setModalOpen(false)
    if (item) setSelectedItem(item)
  }

  // Actualizar `items` no alcanza: `selectedItem` es otro estado, y sin este
  // segundo set se queda con la version vieja del proveedor -- por id, nunca
  // por posicion, o un refresco despues de guardar deja el FichaModal viendo
  // a alguien mas.
  const handleSavedItem = (updated: SupplierWithDetails) => {
    setItems(prev => prev.map(it => it.id === updated.id ? updated : it))
    setSelectedItem(prev => prev && prev.id === updated.id ? updated : prev)
  }
  const handleDeletedItem = (deletedId: string) => {
    setItems(prev => prev.filter(it => it.id !== deletedId))
    setSelectedItem(prev => prev && prev.id === deletedId ? null : prev)
  }

  const handleStatusChange = async (itemId: string, newStatus: SupplierStatus) => {
    if (!permiso.editar) return
    const actual = items.find(i => i.id === itemId)
    if (!actual) return
    const detenido = await bloqueaCambioDeEstado(
      itemId, newStatus, actual,
      destino => handleStatusChange(itemId, destino),
    )
    if (detenido) return
    const prev = actual
    setItems(p => p.map(it => it.id === itemId ? { ...it, status: newStatus } : it))
    setSelectedItem(p => p && p.id === itemId ? { ...p, status: newStatus } : p)
    // Sin .select() un UPDATE filtrado por RLS no da error: devuelve cero filas.
    // La pantalla se quedaria con el estado nuevo y, peor, se guardaria una review
    // de una transicion que nunca ocurrio. Mismo cuidado que en FichaDelEvento.
    const { data: guardado, error } = await supabase
      .from('event_suppliers').update({ status: newStatus }).eq('id', itemId).select().maybeSingle()
    if (error || !guardado) {
      console.error('Error actualizando status:', error?.message ?? error, error)
      loadAll()
      return
    }

    // Review al llegar a un estado final (arrastrar en kanban o mover desde la
    // ficha). Tambien de descartado a contratado, y al reves: lo que evita
    // repetirla no es el estado de origen sino que ya exista una review de
    // ese tipo para este proveedor.
    const isNowFinal = newStatus === 'contratado' || newStatus === 'descartado'
    if (isNowFinal && prev) {
      const reviewType = newStatus === 'contratado' ? 'contratacion' : 'descarte'
      const { count, error: reviewError } = await supabase
        .from('supplier_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('event_supplier_id', itemId)
        .eq('review_type', reviewType)
      if (reviewError) {
        console.error('Error verificando si ya existe review:', reviewError.message ?? reviewError, reviewError)
      } else if (!count) {
        setReviewItem({ ...prev, status: newStatus })
      }
    }
  }

  const buscados = items.filter(item => {
    if (!search.trim()) return true
    const s = item.supplier
    const q = search.toLowerCase()
    const categoryName = nombrePorId(categorias, s.category_id)
    return s.name.toLowerCase().includes(q) ||
           (s.subcategory || '').toLowerCase().includes(q) ||
           categoryName.toLowerCase().includes(q)
  })

  const filtered = aplicarFiltrosProveedores(buscados, filtros, item => ({
    categoriaId: item.supplier.category_id,
    estatus:     item.status,
    ciudad:      item.supplier.city,
    desempeno:   desempenoPorProveedor[item.supplier_id] ?? null,
  }))

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

  const ciudadesDelFiltro = (() => {
    const set = new Set<string>()
    items.forEach(it => { if (it.supplier?.city) set.add(it.supplier.city) })
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
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
              className="w-full rounded-lg border border-[#e0e0e0] bg-white py-2 pl-8 pr-3 text-xs outline-none transition focus:border-[#48C9B0]"
            />
          </div>

          {/* Filtros */}
          <div className="relative ml-auto shrink-0" ref={filterMenuRef}>
            <button
              onClick={() => setShowFilterMenu(v => !v)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#e0e0e0] px-3 py-2 text-xs text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
            >
              <Filter size={13} />
              <span>Filtros{filtrosActivos > 0 ? ` (${filtrosActivos})` : ''}</span>
            </button>
            {showFilterMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 max-h-[70dvh] w-64 overflow-y-auto rounded-xl border border-[#e8e8e8] bg-white p-2 shadow-lg">
                <GrupoFiltro
                  titulo="Categoría"
                  opciones={categoriasDelFiltro.map(c => ({ value: c.id, label: c.name }))}
                  seleccion={filtros.categoria}
                  onToggle={toggleCategoriaFiltro}
                />
                <GrupoFiltro
                  titulo="Estatus"
                  opciones={SUPPLIER_STATUSES.map(s => ({ value: s, label: SUPPLIER_STATUS_LABELS[s] }))}
                  seleccion={filtros.estatus}
                  onToggle={toggleEstatusFiltro}
                />
                <GrupoFiltro
                  titulo="Ciudad"
                  opciones={ciudadesDelFiltro.map(c => ({ value: c, label: c }))}
                  seleccion={filtros.ciudad}
                  onToggle={toggleCiudadFiltro}
                />
                <GrupoFiltro
                  titulo="Desempeño"
                  opciones={FILTROS_DESEMPENO.map(d => ({ value: d.key, label: d.label }))}
                  seleccion={filtros.desempeno}
                  onToggle={toggleDesempenoFiltro}
                />
                {filtrosActivos > 0 && (
                  <button
                    onClick={quitarTodosLosFiltros}
                    className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-[#888] transition hover:bg-[#f8f8f8] hover:text-[#1D1E20]"
                  >
                    Quitar todos los filtros
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Columnas — solo vista Lista */}
          {viewMode === 'lista' && (
            <div className="relative hidden shrink-0 lg:block" ref={colMenuRef}>
              <button
                onClick={() => setShowColMenu(v => !v)}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#e0e0e0] px-3 py-2 text-xs text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
              >
                <Columns2 size={13} />
                <span>Columnas</span>
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
          )}

          {/* CTA */}
          <Puede modulo="proveedores" accion="editar">
            <button
              onClick={() => setModalOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
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
                  visibleCols={visibleCols}
                  desempenoPorProveedor={desempenoPorProveedor}
                  paidByItem={paidByItem}
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
                  desempenoPorProveedor={desempenoPorProveedor}
                  paidByItem={paidByItem}
                  motivoDescartePorItem={motivoDescartePorItem}
                  onSelect={setSelectedItem}
                  onStatusChange={handleStatusChange}
                  puedeEditar={permiso.editar}
                />
              </div>
            )}
            {viewMode === 'fichero' && (
              <SupplierFicheroView
                items={filtered}
                todosLosItems={items}
                budgets={budgets}
                currency={currency}
                categorias={categorias}
                desempenoPorProveedor={desempenoPorProveedor}
                conteoPagosPorItem={conteoPagosPorItem}
                onSelect={setSelectedItem}
                onStatusChange={handleStatusChange}
                onSaved={handleSavedItem}
                onQuitada={handleDeletedItem}
                onDerivadosCambiaron={refrescarDerivados}
                enfocar={enfocar}
                onEnfocado={() => setEnfocar(null)}
                abrirRevisionParaId={revisionParaId}
                onRevisionAbierta={() => setRevisionParaId(null)}
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
        onCategoriaCreada={categoria => setCategorias(prev => agregarCategoria(prev, categoria))}
      />

      {selectedItem && (
        <FichaModal
          item={selectedItem}
          budgets={budgets}
          currency={currency}
          categorias={categorias}
          conteoPagosInicial={conteoPagosPorItem[selectedItem.id] ?? 0}
          onClose={() => setSelectedItem(null)}
          onStatusChange={handleStatusChange}
          onSaved={handleSavedItem}
          onQuitada={handleDeletedItem}
          onDerivadosCambiaron={refrescarDerivados}
          abrirRevisionParaId={revisionParaId}
          onRevisionAbierta={() => setRevisionParaId(null)}
        />
      )}

      {/* Review fuera del DetailModal — evita stacking context de Framer Motion */}
      {reviewItem && permiso.editar && userId && duenoCatalogo && (
        reviewItem.status === 'contratado' ? (
          <ReviewContratacionModal
            eventSupplierId={reviewItem.id}
            supplierId={reviewItem.supplier_id}
            eventId={eventId}
            duenoId={duenoCatalogo}
            createdBy={userId}
            supplierName={reviewItem.supplier.name}
            eventName={event.name}
            onSaved={() => { refrescarDerivados(); setRevisionParaId(reviewItem.id); setReviewItem(null) }}
            onSkip={() => setReviewItem(null)}
          />
        ) : (
          <ReviewDescarteModal
            eventSupplierId={reviewItem.id}
            supplierId={reviewItem.supplier_id}
            eventId={eventId}
            duenoId={duenoCatalogo}
            createdBy={userId}
            supplierName={reviewItem.supplier.name}
            eventName={event.name}
            onSaved={() => { refrescarDerivados(); setRevisionParaId(reviewItem.id); setReviewItem(null) }}
            onSkip={() => setReviewItem(null)}
          />
        )
      )}
    </div>
  )
}

// ── COMPONENTES AUXILIARES ─────────────────────────────────────────────────

function GrupoFiltro<T extends string>({ titulo, opciones, seleccion, onToggle }: {
  titulo: string
  opciones: { value: T; label: string }[]
  seleccion: Set<T>
  onToggle: (value: T) => void
}) {
  if (opciones.length === 0) return null
  return (
    <div className="mb-1.5">
      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">{titulo}</p>
      {opciones.map(o => (
        <label key={o.value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-[#f8f8f8]">
          <input
            type="checkbox"
            checked={seleccion.has(o.value)}
            onChange={() => onToggle(o.value)}
            className="accent-[#48C9B0]"
          />
          <span className="text-xs text-[#1D1E20]">{o.label}</span>
        </label>
      ))}
    </div>
  )
}

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