'use client'

import { ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/types'
import Estrellas from '@/app/components/ui/Estrellas'
import { EstatusProveedor } from '@/app/events/[id]/proveedores/EstatusProveedor'
import { mesYAno, iniciales } from '@/lib/rolodex/expediente'
import { COLUMNAS_DIRECTORIO } from '@/lib/rolodex/columnas-directorio'
import type { ColumnaDirectorioKey } from '@/lib/rolodex/columnas-directorio'
import { estadisticasDirectorio } from '@/lib/rolodex/directorio'
import type { EstadisticasDirectorio, FilaDirectorio } from '@/lib/rolodex/directorio'

type Props = {
  filas: FilaDirectorio[]
  columnas: Set<ColumnaDirectorioKey>
  orden: ColumnaDirectorioKey
  ascendente: boolean
  filtrando: boolean
  nombreCategoria: (id: string | null) => string
  onOrdenar: (columna: ColumnaDirectorioKey) => void
  onAbrir: (fila: FilaDirectorio) => void
}

const TH = 'sticky top-0 z-10 bg-white px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-[.07em] text-[#999] whitespace-nowrap cursor-pointer select-none transition hover:text-[#666] shadow-[inset_0_-1px_0_#e8e8e8]'
const TD = 'px-3.5 py-3.5 text-sm align-middle overflow-hidden text-ellipsis whitespace-nowrap'
const SUB = 'block text-[11.5px] font-normal text-[#999] overflow-hidden text-ellipsis'

function Guion() {
  return <span className="text-[#c4c4c4]">—</span>
}

function Fuerte({ children }: { children: React.ReactNode }) {
  return <span className="text-[15px] font-bold tabular-nums">{children}</span>
}

function Calificacion({ score }: { score: number | null }) {
  if (score == null) return <Guion />
  return <Estrellas score={score} tamano={13} />
}

function celda(key: ColumnaDirectorioKey, f: FilaDirectorio, nombreCategoria: (id: string | null) => string) {
  switch (key) {
    case 'proveedor':
      return (
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-[#f0e4c8] bg-[#fffbf0] text-xs font-extrabold text-[#b8912f]">
            {iniciales(f.nombre)}
          </span>
          <span className="min-w-0">
            <span className="block overflow-hidden text-ellipsis font-bold">
              {f.nombre}
              <ArrowUpRight size={12} className="ml-1 inline text-[#c4c4c4] opacity-0 transition group-hover:opacity-100" />
            </span>
            <span className={SUB}>
              {[f.ciudad, f.estadoRegion].filter(Boolean).join(', ') || '—'}
              {f.tags.map(t => (
                <span key={t} className="ml-1 rounded border border-[#e8e8e8] bg-[#f8f8f8] px-1 py-px text-[11px]">{t}</span>
              ))}
            </span>
          </span>
        </span>
      )
    case 'categoria':
      return f.categoriaId
        ? <span className="inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-full border border-[#e8e8e8] bg-[#f2f2f2] px-2.5 py-[3px] align-middle text-[11px] font-bold uppercase tracking-[.04em] text-[#666]">{nombreCategoria(f.categoriaId)}</span>
        : <Guion />
    case 'activo':
      return (
        <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${f.activo ? 'text-[#1D9E75]' : 'text-[#999]'}`}>
          <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${f.activo ? 'bg-[#1D9E75]' : 'bg-[#c4c4c4]'}`} />
          {f.activo ? 'Activo' : 'No activo'}
        </span>
      )
    case 'eventos':
      return f.eventos > 0
        ? <><Fuerte>{f.eventos}</Fuerte><span className={SUB}>{f.activos > 0 ? `${f.activos} por venir` : 'ya pasaron'}</span></>
        : <span className="text-[11.5px] text-[#c4c4c4]">Ninguno</span>
    case 'cierre':
      return f.tasa != null
        ? <><Fuerte>{f.tasa}%</Fuerte><span className={SUB}>{f.contratados} de {f.cotizados}</span></>
        : <Guion />
    case 'ahorro':
      return f.ahorro != null
        ? <span className={`text-[15px] font-bold tabular-nums ${f.ahorro <= 0 ? 'text-[#1D9E75]' : 'text-[#A63B27]'}`}>{f.ahorro > 0 ? '+' : ''}{f.ahorro}%</span>
        : <Guion />
    case 'rango':
      return f.rango
        ? <span className="tabular-nums">{f.rango.min === f.rango.max ? formatCurrency(f.rango.min, f.moneda) : `${formatCurrency(f.rango.min, f.moneda)} – ${formatCurrency(f.rango.max, f.moneda)}`}</span>
        : <Guion />
    case 'planner':  return <Calificacion score={f.planner} />
    case 'cliente':  return <Calificacion score={f.cliente} />
    case 'ultima':
      return f.ultimaVez
        ? (
          <>
            <span className="flex items-center gap-2">
              <EstatusProveedor estado={f.ultimaVez.estatus} chico />
              <span className="font-semibold tabular-nums">{mesYAno(f.ultimaVez.fecha) || 'sin fecha'}</span>
            </span>
            <span className={SUB}>{f.ultimaVez.nombre}</span>
          </>
        )
        : <Guion />
  }
}

const TF = 'border-t-2 border-[#e0e0e0] bg-[#f8f8f8] px-3.5 py-3 text-sm font-bold align-middle whitespace-nowrap overflow-hidden text-ellipsis'
const PIE_SUB = 'block text-[11px] font-medium text-[#999]'

// Lo que va debajo de cada columna. Cuentas y dinero se suman; porcentajes y
// estrellas se promedian, igual que el pie del expediente. Lo que no se puede
// resumir se queda en blanco en vez de inventar un numero.
function pie(key: ColumnaDirectorioKey, t: EstadisticasDirectorio, filtrando: boolean) {
  switch (key) {
    case 'proveedor':
      return (
        <>
          <span className="text-[10.5px] uppercase tracking-[.09em] text-[#666]">
            {filtrando ? 'Total de lo filtrado' : 'Totales'}
          </span>
          <span className={PIE_SUB}>
            {t.total} {t.total === 1 ? 'proveedor' : 'proveedores'} · {t.contratados} {t.contratados === 1 ? 'contratado' : 'contratados'}
          </span>
        </>
      )
    case 'categoria':
      return t.categorias > 0
        ? <span className="text-[12.5px] font-semibold text-[#666]">{t.categorias} {t.categorias === 1 ? 'categoría' : 'categorías'}</span>
        : null
    case 'activo':
      return <><span className="tabular-nums text-[#1D9E75]">{t.activos}</span><span className={PIE_SUB}>{t.activos === 1 ? 'activo' : 'activos'}</span></>
    case 'eventos':
      return <><span className="tabular-nums">{t.eventos}</span><span className={PIE_SUB}>en total</span></>
    case 'cierre':
      return t.tasa != null
        ? <><span className="tabular-nums">{t.tasa}%</span><span className={PIE_SUB}>{t.tasaContratados} de {t.tasaCotizados}</span></>
        : null
    case 'ahorro':
      return t.ahorro != null
        ? <>
            <span className={`tabular-nums ${t.ahorro <= 0 ? 'text-[#1D9E75]' : 'text-[#A63B27]'}`}>{t.ahorro > 0 ? '+' : ''}{t.ahorro}%</span>
            <span className={PIE_SUB}>{t.ahorroN} {t.ahorroN === 1 ? 'contrato' : 'contratos'}</span>
          </>
        : null
    // Sin total ni promedio a proposito: juntar lo que cuesta una banda con lo
    // que cuesta un banquete no da una cifra, da ruido.
    case 'rango':
      return null
    case 'planner':
      return t.planner != null
        ? <><span className="tabular-nums">{t.planner.toFixed(1)}</span><span className={PIE_SUB}>promedio</span></>
        : null
    case 'cliente':
      return t.cliente != null
        ? <><span className="tabular-nums">{t.cliente.toFixed(1)}</span><span className={PIE_SUB}>promedio</span></>
        : null
    case 'ultima':
      return null
  }
}

export function TablaDirectorio({ filas, columnas, orden, ascendente, filtrando, nombreCategoria, onOrdenar, onAbrir }: Props) {
  const cols = COLUMNAS_DIRECTORIO.filter(c => columnas.has(c.key))
  const totales = estadisticasDirectorio(filas)

  return (
    <table className="w-full table-fixed border-collapse">
      <thead>
        <tr>
          {cols.map(col => (
            <th
              key={col.key}
              onClick={() => onOrdenar(col.key)}
              aria-sort={orden === col.key ? (ascendente ? 'ascending' : 'descending') : 'none'}
              style={{ width: `${col.peso}%` }}
              className={`${TH} ${col.derecha ? 'text-right' : ''} ${orden === col.key ? 'text-[#1D1E20]' : ''}`}
            >
              <span className={`inline-flex max-w-full items-center gap-1 overflow-hidden text-ellipsis ${col.derecha ? 'flex-row-reverse' : ''}`}>
                {col.label}
                {orden === col.key && (ascendente ? <ChevronUp size={12} strokeWidth={3} /> : <ChevronDown size={12} strokeWidth={3} />)}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map(f => (
          <tr
            key={f.id}
            tabIndex={0}
            onClick={() => onAbrir(f)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(f) } }}
            className="group cursor-pointer border-b border-[#f2f2f2] transition hover:bg-[#f4f4f4] focus:outline-none focus-visible:bg-[#f4f4f4] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#48C9B0]"
          >
            {cols.map(col => (
              <td key={col.key} className={`${TD} ${col.derecha ? 'text-right' : ''}`}>
                {celda(col.key, f, nombreCategoria)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      <tfoot className="sticky bottom-0 z-10">
        <tr>
          {cols.map(col => (
            <td key={col.key} className={`${TF} ${col.derecha ? 'text-right' : ''}`}>
              {pie(col.key, totales, filtrando)}
            </td>
          ))}
        </tr>
      </tfoot>
    </table>
  )
}

export function ListaDirectorio({ filas, filtrando, nombreCategoria, onAbrir }: Pick<Props, 'filas' | 'filtrando' | 'nombreCategoria' | 'onAbrir'>) {
  const t = estadisticasDirectorio(filas)
  return (
    <div>
      {filas.map(f => (
        <button
          key={f.id}
          type="button"
          onClick={() => onAbrir(f)}
          className="flex w-full flex-col gap-2.5 border-b border-[#f2f2f2] px-4 py-3 text-left transition active:bg-[#f4f4f4]"
        >
          <div className="flex w-full items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#f0e4c8] bg-[#fffbf0] text-xs font-extrabold text-[#b8912f]">
              {iniciales(f.nombre)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${f.activo ? 'bg-[#1D9E75]' : 'bg-[#c4c4c4]'}`} title={f.activo ? 'Activo' : 'No activo'} />
                <span className="truncate text-[14.5px] font-bold">{f.nombre}</span>
              </span>
              <span className="block truncate text-xs text-[#999]">
                {[f.categoriaId ? nombreCategoria(f.categoriaId) : null, f.ciudad].filter(Boolean).join(' · ') || '—'}
              </span>
            </span>
            {f.ultimaVez && (
              <span className="shrink-0 text-right">
                <EstatusProveedor estado={f.ultimaVez.estatus} chico />
                <span className="block text-[11px] text-[#999]">{mesYAno(f.ultimaVez.fecha)}</span>
              </span>
            )}
          </div>
          <div className="grid w-full grid-cols-3 gap-2 pl-[46px]">
            <Celda etiqueta="Eventos" nota={f.eventos > 0 ? (f.activos > 0 ? `${f.activos} por venir` : 'ya pasaron') : 'sin eventos'}>
              {f.eventos > 0 ? <span className="tabular-nums">{f.eventos}</span> : <Guion />}
            </Celda>
            <Celda etiqueta="Cierre" nota={f.tasa != null ? `${f.contratados} de ${f.cotizados}` : null}>
              {f.tasa != null ? <span className="tabular-nums">{f.tasa}%</span> : <Guion />}
            </Celda>
            <Celda etiqueta="Planner">
              <Calificacion score={f.planner} />
            </Celda>
          </div>
        </button>
      ))}

      <div className="flex flex-col gap-1.5 border-t-2 border-[#e0e0e0] bg-[#f8f8f8] px-4 py-3">
        <span className="text-[10.5px] font-bold uppercase tracking-[.09em] text-[#666]">
          {filtrando ? 'Total de lo filtrado' : 'Totales'} · {t.total} {t.total === 1 ? 'proveedor' : 'proveedores'} · {t.activos} {t.activos === 1 ? 'activo' : 'activos'} · {t.contratados} {t.contratados === 1 ? 'contratado' : 'contratados'}
        </span>
        <div className="grid grid-cols-3 gap-2">
          <Celda etiqueta="Eventos" nota="en total"><span className="tabular-nums">{t.eventos}</span></Celda>
          <Celda etiqueta="Cierre" nota={t.tasa != null ? `${t.tasaContratados} de ${t.tasaCotizados}` : null}>
            {t.tasa != null ? <span className="tabular-nums">{t.tasa}%</span> : <Guion />}
          </Celda>
          <Celda etiqueta="Planner" nota={t.planner != null ? 'promedio' : null}>
            {t.planner != null ? <span className="tabular-nums">{t.planner.toFixed(1)}</span> : <Guion />}
          </Celda>
        </div>
      </div>
    </div>
  )
}

function Celda({ etiqueta, nota, children }: { etiqueta: string; nota?: string | null; children: React.ReactNode }) {
  return (
    <span className="flex flex-col">
      <span className="text-[10px] font-bold uppercase tracking-[.07em] text-[#999]">{etiqueta}</span>
      <span className="text-[14.5px] font-bold tabular-nums">{children}</span>
      {nota && <span className="text-[11px] text-[#999]">{nota}</span>}
    </span>
  )
}
