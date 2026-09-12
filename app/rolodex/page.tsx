'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Filter, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Cargando } from '@/app/components/ui/Cargando'
import { Categoria, cargarCategorias, nombrePorId } from '@/lib/rolodex/categorias-store'
import { hoyISO } from '@/lib/rolodex/expediente'
import type { EventoCrudo, PagoCrudo, PartidaCruda } from '@/lib/rolodex/expediente'
import {
  armarDirectorio, aplicarFiltrosDirectorio, ordenarDirectorio, ordenInicial,
  filtrosDirectorioVacios, contarFiltrosDirectorio, resumenDirectorio, ciudadesDe, categoriasDe,
} from '@/lib/rolodex/directorio'
import type {
  ColumnaDirectorio, FilaDirectorio, FiltrosDirectorio, ProveedorCrudo, ReviewDirectorio, VinculoDirectorio,
} from '@/lib/rolodex/directorio'
import { TablaDirectorio, ListaDirectorio } from './TablaDirectorio'

export const dynamic = 'force-dynamic'

type Estado =
  | { fase: 'cargando' }
  | { fase: 'error' }
  | { fase: 'listo'; filas: FilaDirectorio[]; categorias: Categoria[] }

export default function DirectorioPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState<FiltrosDirectorio>(filtrosDirectorioVacios)
  const [orden, setOrden] = useState<ColumnaDirectorio>('ultima')
  const [ascendente, setAscendente] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const hoy = useMemo(() => hoyISO(), [])

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
      if (ids.length === 0) {
        setEstado({ fase: 'listo', filas: [], categorias })
        return
      }

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

      const filas = armarDirectorio({
        proveedores,
        vinculos,
        eventos: (eventosRes.data ?? []) as EventoCrudo[],
        partidas: (partidasRes.data ?? []) as PartidaCruda[],
        pagos: (pagosRes.data ?? []) as PagoCrudo[],
        reviews: (reviewsRes.data ?? []) as ReviewDirectorio[],
        hoy,
      })
      setEstado({ fase: 'listo', filas, categorias })
    }
    cargar().catch(() => { if (vivo) setEstado({ fase: 'error' }) })
    return () => { vivo = false }
  }, [hoy])

  useEffect(() => {
    if (!menuAbierto) return
    const fuera = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [menuAbierto])

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

  const resumen = resumenDirectorio(estado.filas)
  const filtrosActivos = contarFiltrosDirectorio(filtros)
  const filtrando = filtrosActivos > 0 || busqueda.trim().length > 0
  const ciudades = ciudadesDe(estado.filas)
  const idsDeCategoria = new Set(categoriasDe(estado.filas))
  const categoriasDelFiltro = categorias
    .filter(c => idsDeCategoria.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const alternar = (grupo: 'categoria' | 'ciudad', valor: string) => {
    setFiltros(prev => {
      const next: FiltrosDirectorio = { categoria: new Set(prev.categoria), ciudad: new Set(prev.ciudad) }
      next[grupo].has(valor) ? next[grupo].delete(valor) : next[grupo].add(valor)
      return next
    })
  }

  const limpiar = () => { setFiltros(filtrosDirectorioVacios()); setBusqueda('') }

  const ordenarPor = (columna: ColumnaDirectorio) => {
    if (columna === orden) { setAscendente(v => !v); return }
    setOrden(columna)
    setAscendente(ordenInicial(columna))
  }

  const abrir = (fila: FilaDirectorio) => router.push(`/rolodex/${fila.id}`)

  return (
    <div className="flex flex-col gap-4">

      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-[#1D1E20] sm:text-2xl">Rolodex</h1>
        <p className="mt-0.5 text-xs text-[#999] sm:text-[12.5px]">
          {resumen.total === 0
            ? 'Todavía no tienes proveedores'
            : `${resumen.total} ${resumen.total === 1 ? 'proveedor' : 'proveedores'} · ${resumen.conEvento} ${resumen.conEvento === 1 ? 'ha estado' : 'han estado'} en un evento${resumen.sinEvento > 0 ? ` · ${resumen.sinEvento} sin evento todavía` : ''}`}
        </p>
      </div>

      {estado.filas.length === 0 ? (
        <div className="flex min-h-[40dvh] flex-col items-center justify-center rounded-2xl border border-dashed border-[#e0e0e0] bg-white p-6 text-center">
          <p className="text-sm font-semibold text-[#1D1E20]">Tu Rolodex está vacío</p>
          <p className="mt-1 max-w-sm text-xs text-[#888]">
            Los proveedores que agregues dentro de un evento aparecen aquí, con su historia en todos tus eventos.
          </p>
          <a href="/dashboard" className="mt-4 rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896]">
            Ir a mis eventos
          </a>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
              <input
                id="rolodex-busqueda"
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, ciudad o etiqueta..."
                className="w-full rounded-lg border border-[#e0e0e0] bg-white py-2 pl-8 pr-3 text-xs outline-none transition focus:border-[#48C9B0]"
              />
            </div>

            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setMenuAbierto(v => !v)}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-xs text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
              >
                <Filter size={13} />
                <span>Filtros{filtrosActivos > 0 ? ` (${filtrosActivos})` : ''}</span>
              </button>
              {menuAbierto && (
                <div className="absolute left-0 top-full z-50 mt-1 max-h-[70dvh] w-64 overflow-y-auto rounded-xl border border-[#e8e8e8] bg-white p-2 shadow-lg sm:left-auto sm:right-0">
                  <GrupoFiltro
                    titulo="Categoría"
                    opciones={categoriasDelFiltro.map(c => ({ value: c.id, label: c.name }))}
                    seleccion={filtros.categoria}
                    onToggle={v => alternar('categoria', v)}
                  />
                  <GrupoFiltro
                    titulo="Ciudad"
                    opciones={ciudades.map(c => ({ value: c, label: c }))}
                    seleccion={filtros.ciudad}
                    onToggle={v => alternar('ciudad', v)}
                  />
                  {filtrosActivos > 0 && (
                    <button
                      onClick={() => setFiltros(filtrosDirectorioVacios())}
                      className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-[#888] transition hover:bg-[#f8f8f8] hover:text-[#1D1E20]"
                    >
                      Quitar todos los filtros
                    </button>
                  )}
                </div>
              )}
            </div>

            {filtrando && (
              <button onClick={limpiar} className="shrink-0 px-1.5 py-1 text-xs font-semibold text-[#1a9e88] transition hover:underline">
                Limpiar
              </button>
            )}

            <span className="ml-auto shrink-0 text-xs text-[#999]">
              {filtrando
                ? <><b className="font-bold text-[#1D1E20]">{visibles.length}</b> de {resumen.total}</>
                : <><b className="font-bold text-[#1D1E20]">{resumen.total}</b> {resumen.total === 1 ? 'proveedor' : 'proveedores'}</>}
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white">
            {visibles.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[#999]">
                Ningún proveedor coincide. Prueba con otra palabra o quita un filtro.
              </p>
            ) : (
              <>
                <div className="hidden lg:block">
                  <TablaDirectorio
                    filas={visibles}
                    orden={orden}
                    ascendente={ascendente}
                    nombreCategoria={nombreCategoria}
                    onOrdenar={ordenarPor}
                    onAbrir={abrir}
                  />
                </div>
                <div className="lg:hidden">
                  <ListaDirectorio filas={visibles} nombreCategoria={nombreCategoria} onAbrir={abrir} />
                </div>
              </>
            )}
            <div className="border-t-2 border-[#e0e0e0] bg-[#f8f8f8] px-4 py-2.5 text-[11px] font-semibold text-[#999]">
              <span className="text-[10px] uppercase tracking-[.09em] text-[#666]">Tu Rolodex</span>
              <span className="ml-2">
                {resumen.total} {resumen.total === 1 ? 'proveedor' : 'proveedores'} · {resumen.conEvento} en algún evento · {resumen.contratados} {resumen.contratados === 1 ? 'contratado' : 'contratados'} alguna vez
              </span>
            </div>
          </div>
        </>
      )}
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
          <span className="truncate text-xs text-[#1D1E20]">{o.label}</span>
        </label>
      ))}
    </div>
  )
}
