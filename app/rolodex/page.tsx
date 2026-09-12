'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Columns2, Filter, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Cargando } from '@/app/components/ui/Cargando'
import StatsCollapse, { useStatsToggle, StatsToggleButton } from '@/app/components/ui/StatsCollapse'
import { Categoria, cargarCategorias, nombrePorId } from '@/lib/rolodex/categorias-store'
import { hoyISO } from '@/lib/rolodex/expediente'
import type { EventoCrudo, PagoCrudo, PartidaCruda } from '@/lib/rolodex/expediente'
import {
  armarDirectorio, aplicarFiltrosDirectorio, ordenarDirectorio, ordenInicial,
  filtrosDirectorioVacios, contarFiltrosDirectorio, estadisticasDirectorio,
  ciudadesDe, categoriasDe,
} from '@/lib/rolodex/directorio'
import type {
  FilaDirectorio, FiltrosDirectorio, ProveedorCrudo, ReviewDirectorio, VinculoDirectorio,
} from '@/lib/rolodex/directorio'
import {
  COLUMNAS_DIRECTORIO, COLUMNA_DIRECTORIO_SIEMPRE,
  cargarColumnasDirectorio, guardarColumnasDirectorio, columnasDirectorioPorDefecto,
} from '@/lib/rolodex/columnas-directorio'
import type { ColumnaDirectorioKey } from '@/lib/rolodex/columnas-directorio'
import { TablaDirectorio, ListaDirectorio } from './TablaDirectorio'

export const dynamic = 'force-dynamic'

type Estado =
  | { fase: 'cargando' }
  | { fase: 'error' }
  | { fase: 'listo'; filas: FilaDirectorio[]; categorias: Categoria[] }

type Menu = 'filtros' | 'columnas' | null

export default function DirectorioPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState<FiltrosDirectorio>(filtrosDirectorioVacios)
  const [columnas, setColumnas] = useState<Set<ColumnaDirectorioKey>>(columnasDirectorioPorDefecto)
  const [orden, setOrden] = useState<ColumnaDirectorioKey>('ultima')
  const [ascendente, setAscendente] = useState(false)
  const [menu, setMenu] = useState<Menu>(null)
  const barraRef = useRef<HTMLDivElement>(null)
  const hoy = useMemo(() => hoyISO(), [])
  // El Rolodex es de la cuenta, no de un evento: 'rolodex' hace de id para la
  // preferencia guardada. El plegado solo ocurre en movil, que es donde las
  // fichas estorban; en escritorio las cifras van junto al titulo y no pesan.
  const plegable = useStatsToggle('rolodex', 'directorio')

  useEffect(() => { setColumnas(cargarColumnasDirectorio()) }, [])

  useEffect(() => {
    let vivo = true
    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }

      const [proveedoresRes, categorias] = await Promise.all([
        supabase
          .from('suppliers')
          .select('id, name, category_id, city, state_region, tags')
          .eq('user_id', user.id)
          .is('archived_at', null)
          .order('name'),
        cargarCategorias(user.id),
      ])
      if (!vivo) return
      if (proveedoresRes.error) { setEstado({ fase: 'error' }); return }

      const proveedores = (proveedoresRes.data ?? []) as ProveedorCrudo[]
      const ids = proveedores.map(p => p.id)
      if (ids.length === 0) { setEstado({ fase: 'listo', filas: [], categorias }); return }

      const [vinculosRes, reviewsRes] = await Promise.all([
        supabase.from('event_suppliers').select('id, supplier_id, event_id, status, quoted_amount').in('supplier_id', ids),
        supabase.from('supplier_reviews')
          .select('supplier_id, event_supplier_id, review_type, autor, precio_valor, calidad, comunicacion, servicio_trato, manejo_imprevistos, razones_seleccion, motivo_descarte, comentarios')
          .in('supplier_id', ids),
      ])
      if (!vivo) return
      if (vinculosRes.error || reviewsRes.error) { setEstado({ fase: 'error' }); return }

      const vinculos = (vinculosRes.data ?? []) as VinculoDirectorio[]
      const vinculoIds = vinculos.map(v => v.id)
      const eventoIds = [...new Set(vinculos.map(v => v.event_id))]

      const [eventosRes, partidasRes, pagosRes] = await Promise.all([
        eventoIds.length
          ? supabase.from('events').select('id, name, event_date, event_end_date, venue, currency').in('id', eventoIds)
          : Promise.resolve({ data: [], error: null }),
        vinculoIds.length
          ? supabase.from('event_budgets').select('event_supplier_id, contract_amount').in('event_supplier_id', vinculoIds)
          : Promise.resolve({ data: [], error: null }),
        vinculoIds.length
          ? supabase.from('supplier_payments').select('event_supplier_id, amount').in('event_supplier_id', vinculoIds)
          : Promise.resolve({ data: [], error: null }),
      ])
      if (!vivo) return
      if (eventosRes.error || partidasRes.error || pagosRes.error) { setEstado({ fase: 'error' }); return }

      setEstado({
        fase: 'listo',
        categorias,
        filas: armarDirectorio({
          proveedores,
          vinculos,
          eventos: (eventosRes.data ?? []) as EventoCrudo[],
          partidas: (partidasRes.data ?? []) as PartidaCruda[],
          pagos: (pagosRes.data ?? []) as PagoCrudo[],
          reviews: (reviewsRes.data ?? []) as ReviewDirectorio[],
          hoy,
        }),
      })
    }
    cargar().catch(() => { if (vivo) setEstado({ fase: 'error' }) })
    return () => { vivo = false }
  }, [hoy])

  useEffect(() => {
    if (!menu) return
    const fuera = (e: MouseEvent) => {
      if (barraRef.current && !barraRef.current.contains(e.target as Node)) setMenu(null)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [menu])

  const categorias = estado.fase === 'listo' ? estado.categorias : []
  const nombreCategoria = (id: string | null) => nombrePorId(categorias, id)

  const visibles = useMemo(() => {
    if (estado.fase !== 'listo') return []
    return ordenarDirectorio(aplicarFiltrosDirectorio(estado.filas, filtros, busqueda), orden, ascendente, nombreCategoria)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, filtros, busqueda, orden, ascendente, categorias])

  if (estado.fase === 'cargando') {
    return <div className="flex h-[50dvh]"><Cargando /></div>
  }

  if (estado.fase === 'error') {
    return (
      <div className="rounded-2xl border border-[#e8e8e8] bg-white px-6 py-10 text-center">
        <p className="text-sm font-medium text-[#666]">No se pudo cargar tu Rolodex.</p>
        <a href="/dashboard" className="mt-3 inline-block text-xs font-semibold text-[#1a9e88] hover:underline">Ir al dashboard</a>
      </div>
    )
  }

  const stats = estadisticasDirectorio(estado.filas)
  const filtrosActivos = contarFiltrosDirectorio(filtros)
  const filtrando = filtrosActivos > 0 || busqueda.trim().length > 0
  const ciudades = ciudadesDe(estado.filas)
  const idsUsadas = new Set(categoriasDe(estado.filas))
  const categoriasDelFiltro = categorias.filter(c => idsUsadas.has(c.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const alternarFiltro = (grupo: 'categoria' | 'ciudad', valor: string) => {
    setFiltros(prev => {
      const next: FiltrosDirectorio = { categoria: new Set(prev.categoria), ciudad: new Set(prev.ciudad) }
      next[grupo].has(valor) ? next[grupo].delete(valor) : next[grupo].add(valor)
      return next
    })
  }

  const alternarColumna = (key: ColumnaDirectorioKey) => {
    setColumnas(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      next.add(COLUMNA_DIRECTORIO_SIEMPRE)
      guardarColumnasDirectorio(next)
      return next
    })
  }

  const quitarFiltros = () => setFiltros(filtrosDirectorioVacios())
  const limpiarTodo = () => { quitarFiltros(); setBusqueda('') }

  const ordenarPor = (columna: ColumnaDirectorioKey) => {
    if (columna === orden) { setAscendente(v => !v); return }
    setOrden(columna)
    setAscendente(ordenInicial(columna))
  }

  const abrir = (fila: FilaDirectorio) => router.push(`/rolodex/${fila.id}`)

  const pastillas = [
    ...[...filtros.categoria].map(v => ({ grupo: 'categoria' as const, etiqueta: 'Categoría', valor: v, texto: nombreCategoria(v) })),
    ...[...filtros.ciudad].map(v => ({ grupo: 'ciudad' as const, etiqueta: 'Ciudad', valor: v, texto: v })),
  ]

  return (
    <div className="flex flex-col gap-4">

      {estado.filas.length === 0 ? (
        <>
        <Titulo />
        <div className="flex min-h-[40dvh] flex-col items-center justify-center rounded-2xl border border-dashed border-[#e0e0e0] bg-white p-6 text-center">
          <p className="text-sm font-semibold text-[#1D1E20]">Tu Rolodex está vacío</p>
          <p className="mt-1 max-w-sm text-xs text-[#888]">
            Los proveedores que agregues dentro de un evento aparecen aquí, con su historia en todos tus eventos.
          </p>
          <a href="/dashboard" className="mt-4 rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896]">
            Ir a mis eventos
          </a>
        </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <Titulo>
              <div className="mt-1 lg:hidden">
                <StatsToggleButton visible={plegable.visible} onClick={plegable.toggle} />
              </div>
            </Titulo>
            <StatsCollapse visible={plegable.visible}>
              <div className="grid grid-cols-2 gap-2.5 lg:flex lg:gap-7">
                <Ficha etiqueta="Proveedores" valor={String(stats.total)} pie={stats.sinEvento > 0 ? `${stats.sinEvento} sin evento todavía` : 'todos con evento'} />
                <Ficha etiqueta="Contratados" valor={String(stats.contratados)} pie={`de ${stats.conEvento} que has usado`} />
                <Ficha
                  etiqueta="Tasa de cierre"
                  valor={stats.tasa != null ? `${stats.tasa}%` : 'Sin datos'}
                  pie={stats.tasa != null ? `${stats.tasaContratados} de ${stats.tasaCotizados} cotizaciones` : 'todavía no pides cotizaciones'}
                  verde={stats.tasa != null}
                  apagado={stats.tasa == null}
                />
                <Ficha
                  etiqueta="Ahorro negociado"
                  valor={stats.ahorro != null ? `${stats.ahorro > 0 ? '+' : ''}${stats.ahorro}%` : 'Sin datos'}
                  pie={stats.ahorro != null ? `promedio de ${stats.ahorroN} ${stats.ahorroN === 1 ? 'contrato' : 'contratos'}` : 'falta cotizado y contratado'}
                  verde={stats.ahorro != null && stats.ahorro <= 0}
                  apagado={stats.ahorro == null}
                />
              </div>
            </StatsCollapse>
          </div>

          <div ref={barraRef} className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
              <input
                id="rolodex-busqueda"
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, ciudad o etiqueta..."
                className="w-full rounded-lg border border-[#e0e0e0] bg-white py-2.5 pl-9 pr-3 text-[13px] outline-none transition focus:border-[#48C9B0]"
              />
            </div>

            <div className="relative shrink-0">
              <BotonBarra activo={filtrosActivos > 0} onClick={() => setMenu(m => m === 'filtros' ? null : 'filtros')}>
                <Filter size={14} />
                Filtros{filtrosActivos > 0 ? ` (${filtrosActivos})` : ''}
              </BotonBarra>
              {menu === 'filtros' && (
                <MenuFlotante>
                  <GrupoFiltro
                    titulo="Categoría"
                    opciones={categoriasDelFiltro.map(c => ({ value: c.id, label: c.name }))}
                    seleccion={filtros.categoria}
                    onToggle={v => alternarFiltro('categoria', v)}
                  />
                  <GrupoFiltro
                    titulo="Ciudad"
                    opciones={ciudades.map(c => ({ value: c, label: c }))}
                    seleccion={filtros.ciudad}
                    onToggle={v => alternarFiltro('ciudad', v)}
                  />
                  {filtrosActivos > 0 && (
                    <button
                      onClick={quitarFiltros}
                      className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-[#888] transition hover:bg-[#f8f8f8] hover:text-[#1D1E20]"
                    >
                      Quitar todos los filtros
                    </button>
                  )}
                </MenuFlotante>
              )}
            </div>

            <div className="relative shrink-0">
              <BotonBarra activo={columnas.size !== columnasDirectorioPorDefecto().size} onClick={() => setMenu(m => m === 'columnas' ? null : 'columnas')}>
                <Columns2 size={14} />
                <span className="hidden sm:inline">Columnas</span>
              </BotonBarra>
              {menu === 'columnas' && (
                <MenuFlotante>
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Mostrar columnas</p>
                  {COLUMNAS_DIRECTORIO.map(col => {
                    const fija = col.key === COLUMNA_DIRECTORIO_SIEMPRE
                    return (
                      <label
                        key={col.key}
                        className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] ${fija ? 'text-[#999]' : 'cursor-pointer text-[#1D1E20] transition hover:bg-[#f8f8f8]'}`}
                      >
                        <input
                          type="checkbox"
                          checked={fija || columnas.has(col.key)}
                          disabled={fija}
                          onChange={() => alternarColumna(col.key)}
                          className="h-3.5 w-3.5 shrink-0 accent-[#48C9B0]"
                        />
                        <span className="truncate">{col.label}</span>
                        {fija && <span className="ml-auto text-[10px] text-[#bbb]">siempre</span>}
                      </label>
                    )
                  })}
                </MenuFlotante>
              )}
            </div>

            <span className="ml-auto shrink-0 text-[13px] text-[#999]">
              {filtrando
                ? <><b className="font-bold text-[#1D1E20]">{visibles.length}</b> de {stats.total}</>
                : <><b className="font-bold text-[#1D1E20]">{stats.total}</b> {stats.total === 1 ? 'proveedor' : 'proveedores'}</>}
            </span>
          </div>

          {pastillas.length > 0 && (
            <div className="-mt-1 flex flex-wrap items-center gap-2">
              {pastillas.map(p => (
                <span key={`${p.grupo}:${p.valor}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D1E20] px-2.5 py-1 text-[13px] font-medium text-white">
                  <span className="text-white/55">{p.etiqueta}:</span> {p.texto}
                  <button
                    onClick={() => alternarFiltro(p.grupo, p.valor)}
                    aria-label={`Quitar el filtro ${p.etiqueta} ${p.texto}`}
                    className="rounded text-white/60 transition hover:text-white"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
              {pastillas.length >= 2 && (
                <button onClick={quitarFiltros} className="text-[13px] font-medium text-[#888] underline transition hover:text-[#1D1E20]">
                  Limpiar
                </button>
              )}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white">
            {visibles.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-[#999]">Ningún proveedor coincide con lo que estás buscando.</p>
                <button
                  onClick={limpiarTodo}
                  className="mt-3 rounded-lg border border-[#e0e0e0] bg-white px-3.5 py-2 text-xs font-semibold text-[#666] transition hover:border-[#48C9B0] hover:text-[#1a9e88]"
                >
                  Quitar filtros y búsqueda
                </button>
              </div>
            ) : (
              <>
                <div className="hidden max-h-[calc(100dvh-300px)] min-h-[220px] overflow-y-auto lg:block">
                  <TablaDirectorio
                    filas={visibles}
                    columnas={columnas}
                    orden={orden}
                    ascendente={ascendente}
                    filtrando={filtrando}
                    nombreCategoria={nombreCategoria}
                    onOrdenar={ordenarPor}
                    onAbrir={abrir}
                  />
                </div>
                <div className="lg:hidden">
                  <ListaDirectorio filas={visibles} filtrando={filtrando} nombreCategoria={nombreCategoria} onAbrir={abrir} />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Titulo({ children }: { children?: React.ReactNode }) {
  return (
    <div className="shrink-0">
      <h1 className="text-2xl font-extrabold tracking-tight text-[#1D1E20]">Rolodex</h1>
      <p className="mt-0.5 text-[13px] text-[#999]">Todos tus proveedores, con su historia en cada evento</p>
      {children}
    </div>
  )
}

// En escritorio las cifras van desnudas junto al titulo: sin caja, sin borde y
// sin fondo, para no robarle alto a la tabla. En movil, donde van debajo y se
// pliegan, si llevan tarjeta para que se lean como bloques aparte.
function Ficha({ etiqueta, valor, pie, verde, apagado }: {
  etiqueta: string
  valor: string
  pie: string
  verde?: boolean
  apagado?: boolean
}) {
  return (
    <div className="flex flex-col gap-px rounded-2xl border border-[#e8e8e8] bg-white px-4 py-3.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
      <span className="text-[10.5px] font-bold uppercase tracking-[.1em] text-[#999] lg:whitespace-nowrap">{etiqueta}</span>
      <span className={`font-extrabold leading-[1.15] tracking-tight tabular-nums ${apagado ? 'text-[19px] text-[#c4c4c4] lg:text-base' : `text-[30px] lg:text-[26px] ${verde ? 'text-[#1D9E75]' : 'text-[#1D1E20]'}`}`}>
        {valor}
      </span>
      <span className="text-[11.5px] text-[#999] lg:whitespace-nowrap">{pie}</span>
    </div>
  )
}

function BotonBarra({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2.5 text-[13px] transition ${
        activo
          ? 'border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]'
          : 'border-[#e0e0e0] bg-white text-[#666] hover:border-[#48C9B0] hover:text-[#1a9e88]'
      }`}
    >
      {children}
    </button>
  )
}

function MenuFlotante({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute right-0 top-full z-50 mt-1 max-h-[60dvh] w-60 overflow-y-auto rounded-xl border border-[#e8e8e8] bg-white p-2 shadow-lg">
      {children}
    </div>
  )
}

function GrupoFiltro({ titulo, opciones, seleccion, onToggle }: {
  titulo: string
  opciones: { value: string; label: string }[]
  seleccion: Set<string>
  onToggle: (value: string) => void
}) {
  if (opciones.length === 0) return null
  return (
    <div className="mb-1.5 last:mb-0">
      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">{titulo}</p>
      {opciones.map(o => (
        <label key={o.value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-[#f8f8f8]">
          <input
            type="checkbox"
            checked={seleccion.has(o.value)}
            onChange={() => onToggle(o.value)}
            className="h-3.5 w-3.5 shrink-0 accent-[#48C9B0]"
          />
          <span className="truncate text-[13px] text-[#1D1E20]">{o.label}</span>
        </label>
      ))}
    </div>
  )
}
