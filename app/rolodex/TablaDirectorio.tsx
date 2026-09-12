'use client'

import { ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/types'
import Estrellas from '@/app/components/ui/Estrellas'
import { EstatusProveedor } from '@/app/events/[id]/proveedores/EstatusProveedor'
import { mesYAno, iniciales } from '@/lib/rolodex/expediente'
import type { ColumnaDirectorio, FilaDirectorio } from '@/lib/rolodex/directorio'

type Props = {
  filas: FilaDirectorio[]
  orden: ColumnaDirectorio
  ascendente: boolean
  nombreCategoria: (id: string | null) => string
  onOrdenar: (columna: ColumnaDirectorio) => void
  onAbrir: (fila: FilaDirectorio) => void
}

const COLUMNAS: { key: ColumnaDirectorio; etiqueta: string; derecha?: boolean }[] = [
  { key: 'nombre',    etiqueta: 'Proveedor' },
  { key: 'categoria', etiqueta: 'Categoría' },
  { key: 'eventos',   etiqueta: 'Eventos', derecha: true },
  { key: 'tasa',      etiqueta: 'Tasa de cierre', derecha: true },
  { key: 'ahorro',    etiqueta: 'Ahorro negociado', derecha: true },
  { key: 'rango',     etiqueta: 'Rango de inversión', derecha: true },
  { key: 'planner',   etiqueta: 'Calificación del planner' },
  { key: 'cliente',   etiqueta: 'Satisfacción del cliente' },
  { key: 'ultima',    etiqueta: 'Última vez' },
]

const TH = 'px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[.09em] text-[#999] whitespace-nowrap cursor-pointer select-none transition hover:text-[#666]'
const TD = 'px-3.5 py-2.5 text-[12.5px] align-middle whitespace-nowrap'

function Guion() {
  return <span className="text-[#c4c4c4]">—</span>
}

function Ahorro({ valor, n }: { valor: number | null; n: number }) {
  if (valor == null) return <Guion />
  return (
    <>
      <span className={`font-bold tabular-nums ${valor <= 0 ? 'text-[#1D9E75]' : 'text-[#A63B27]'}`}>
        {valor > 0 ? '+' : ''}{valor}%
      </span>
      <span className="block text-[10.5px] text-[#999]">{n === 1 ? 'de una vez' : `${n} contratos`}</span>
    </>
  )
}

function Rango({ fila }: { fila: FilaDirectorio }) {
  if (!fila.rango) return <Guion />
  const { min, max } = fila.rango
  return (
    <span className="tabular-nums">
      {min === max ? formatCurrency(min, fila.moneda) : `${formatCurrency(min, fila.moneda)} – ${formatCurrency(max, fila.moneda)}`}
    </span>
  )
}

function UltimaVez({ fila }: { fila: FilaDirectorio }) {
  if (!fila.ultimaVez) return <Guion />
  return (
    <>
      <span className="inline-flex items-center gap-2">
        <b className="font-bold">{fila.ultimaVez.nombre}</b>
        <EstatusProveedor estado={fila.ultimaVez.estatus} chico />
      </span>
      <span className="block text-[10.5px] text-[#999]">{mesYAno(fila.ultimaVez.fecha) || 'sin fecha'}</span>
    </>
  )
}

function Calificacion({ score }: { score: number | null }) {
  if (score == null) return <Guion />
  return <Estrellas score={score} tamano={11} />
}

export function TablaDirectorio({ filas, orden, ascendente, nombreCategoria, onOrdenar, onAbrir }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#e8e8e8]">
            {COLUMNAS.map(col => (
              <th
                key={col.key}
                onClick={() => onOrdenar(col.key)}
                aria-sort={orden === col.key ? (ascendente ? 'ascending' : 'descending') : 'none'}
                className={`${TH} ${col.derecha ? 'text-right' : ''} ${orden === col.key ? 'text-[#1D1E20]' : ''}`}
              >
                <span className={`inline-flex items-center gap-1 ${col.derecha ? 'flex-row-reverse' : ''}`}>
                  {col.etiqueta}
                  {orden === col.key && (ascendente ? <ChevronUp size={11} strokeWidth={3} /> : <ChevronDown size={11} strokeWidth={3} />)}
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
              <td className={TD}>
                <span className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-[#f0e4c8] bg-[#fffbf0] text-[11px] font-extrabold text-[#b8912f]">
                    {iniciales(f.nombre)}
                  </span>
                  <span>
                    <span className="font-bold">
                      {f.nombre}
                      <ArrowUpRight size={11} className="ml-1 inline text-[#c4c4c4] opacity-0 transition group-hover:opacity-100" />
                    </span>
                    <span className="block text-[10.5px] text-[#999]">
                      {[f.ciudad, f.estadoRegion].filter(Boolean).join(', ') || '—'}
                      {f.tags.map(t => (
                        <span key={t} className="ml-1 rounded border border-[#e8e8e8] bg-[#f8f8f8] px-1 py-px text-[10px]">{t}</span>
                      ))}
                    </span>
                  </span>
                </span>
              </td>
              <td className={TD}>
                {f.categoriaId
                  ? <span className="rounded-full border border-[#e8e8e8] bg-[#f2f2f2] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#666]">{nombreCategoria(f.categoriaId)}</span>
                  : <Guion />}
              </td>
              <td className={`${TD} text-right`}>
                {f.eventos > 0
                  ? <><b className="font-bold tabular-nums">{f.eventos}</b><span className="block text-[10.5px] text-[#999]">{f.activos > 0 ? `${f.activos} ${f.activos === 1 ? 'activo' : 'activos'}` : 'ninguno activo'}</span></>
                  : <span className="text-[11.5px] text-[#bbb]">Sin eventos</span>}
              </td>
              <td className={`${TD} text-right`}>
                {f.tasa != null
                  ? <><b className="font-bold tabular-nums">{f.tasa}%</b><span className="block text-[10.5px] text-[#999]">{f.contratados} de {f.cotizados}</span></>
                  : <Guion />}
              </td>
              <td className={`${TD} text-right`}><Ahorro valor={f.ahorro} n={f.ahorroN} /></td>
              <td className={`${TD} text-right`}><Rango fila={f} /></td>
              <td className={TD}><Calificacion score={f.planner} /></td>
              <td className={TD}><Calificacion score={f.cliente} /></td>
              <td className={TD}><UltimaVez fila={f} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
          className="flex w-full flex-col gap-2 border-b border-[#f2f2f2] px-4 py-3 text-left transition active:bg-[#f4f4f4]"
        >
          <div className="flex w-full items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#f0e4c8] bg-[#fffbf0] text-[11px] font-extrabold text-[#b8912f]">
              {iniciales(f.nombre)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold">{f.nombre}</span>
              <span className="block truncate text-[10.5px] text-[#999]">
                {[f.categoriaId ? nombreCategoria(f.categoriaId) : null, f.ciudad].filter(Boolean).join(' · ') || '—'}
              </span>
            </span>
            {f.ultimaVez && (
              <span className="shrink-0 text-right">
                <EstatusProveedor estado={f.ultimaVez.estatus} chico />
                <span className="block text-[10px] text-[#999]">{mesYAno(f.ultimaVez.fecha)}</span>
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
      <span className="text-[9.5px] font-bold uppercase tracking-[.08em] text-[#999]">{etiqueta}</span>
      <span className="text-[13px] font-bold tabular-nums">{children}</span>
      {nota && <span className="text-[10px] text-[#999]">{nota}</span>}
    </span>
  )
}
