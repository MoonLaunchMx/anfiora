'use client'

import { ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/types'
import Estrellas from '@/app/components/ui/Estrellas'
import { EstatusProveedor } from '@/app/events/[id]/proveedores/EstatusProveedor'
import { mesYAno, iniciales } from '@/lib/rolodex/expediente'
import { COLUMNAS_DIRECTORIO } from '@/lib/rolodex/columnas-directorio'
import type { ColumnaDirectorioKey } from '@/lib/rolodex/columnas-directorio'
import type { FilaDirectorio } from '@/lib/rolodex/directorio'

type Props = {
  filas: FilaDirectorio[]
  columnas: Set<ColumnaDirectorioKey>
  orden: ColumnaDirectorioKey
  ascendente: boolean
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
    case 'eventos':
      return f.eventos > 0
        ? <><Fuerte>{f.eventos}</Fuerte><span className={SUB}>{f.activos > 0 ? `${f.activos} ${f.activos === 1 ? 'activo' : 'activos'}` : 'ninguno activo'}</span></>
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

export function TablaDirectorio({ filas, columnas, orden, ascendente, nombreCategoria, onOrdenar, onAbrir }: Props) {
  const cols = COLUMNAS_DIRECTORIO.filter(c => columnas.has(c.key))

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
    </table>
  )
}

export function ListaDirectorio({ filas, nombreCategoria, onAbrir }: Pick<Props, 'filas' | 'nombreCategoria' | 'onAbrir'>) {
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
              <span className="block truncate text-[14.5px] font-bold">{f.nombre}</span>
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
            <Celda etiqueta="Eventos" nota={f.eventos > 0 ? (f.activos > 0 ? `${f.activos} ${f.activos === 1 ? 'activo' : 'activos'}` : 'ninguno activo') : 'sin eventos'}>
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
