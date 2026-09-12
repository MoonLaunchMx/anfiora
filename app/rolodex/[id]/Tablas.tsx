'use client'

import { ArrowUpRight } from 'lucide-react'
import { Currency, formatCurrency } from '@/lib/types'
import Estrellas from '@/app/components/ui/Estrellas'
import { EstatusProveedor } from '@/app/events/[id]/proveedores/EstatusProveedor'
import { etiquetaRelativa, fechaLarga, totales } from '@/lib/rolodex/expediente'
import type { FilaExpediente } from '@/lib/rolodex/expediente'

export type Carpeta = 'activos' | 'historial'

type Props = {
  filas: FilaExpediente[]
  carpeta: Carpeta
  hoy: string
  moneda: Currency
  onAbrir: (fila: FilaExpediente) => void
}

function Guion() {
  return <span className="text-[#c4c4c4]">—</span>
}

function Dinero({ monto, moneda, fuerte, tachado }: { monto: number | null; moneda: Currency; fuerte?: boolean; tachado?: boolean }) {
  if (monto == null) return <Guion />
  return (
    <span className={`tabular-nums ${tachado ? 'text-[#999] line-through decoration-[#c4c4c4]' : fuerte ? 'font-bold text-[#1D1E20]' : ''}`}>
      {formatCurrency(monto, moneda)}
    </span>
  )
}

function Ahorro({ valor }: { valor: number | null }) {
  if (valor == null) return <Guion />
  return (
    <span className={`font-bold tabular-nums ${valor <= 0 ? 'text-[#1D9E75]' : 'text-[#A63B27]'}`}>
      {valor > 0 ? '+' : ''}{valor}%
    </span>
  )
}

function Calificacion({ score }: { score: number | null }) {
  if (score == null) return <Guion />
  return <Estrellas score={score} tamano={11} />
}

function textoVacio(carpeta: Carpeta) {
  return carpeta === 'activos'
    ? 'No está en ningún evento que siga en pie.'
    : 'Todavía no hay eventos que ya hayan pasado con este proveedor.'
}

const TH = 'px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-[.09em] text-[#999]'
const TD = 'px-3.5 py-3.5 text-sm align-middle whitespace-nowrap'
const TF = 'px-3.5 py-3 text-sm font-bold border-t-2 border-[#e0e0e0] bg-[#f8f8f8]'

export function TablaExpediente({ filas, carpeta, hoy, moneda, onAbrir }: Props) {
  if (filas.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-[#999]">{textoVacio(carpeta)}</p>
  }
  const t = totales(filas)
  const activos = carpeta === 'activos'

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#e8e8e8]">
            <th className={TH}>Fecha del evento</th>
            <th className={TH}>Evento</th>
            <th className={TH}>Estatus</th>
            <th className={`${TH} text-right`}>Cotizado</th>
            <th className={`${TH} text-right`}>Contratado</th>
            <th className={`${TH} text-right`}>Ahorro</th>
            {activos ? (
              <>
                <th className={`${TH} text-right`}>Pagado</th>
                <th className={`${TH} text-right`}>Por pagar</th>
              </>
            ) : (
              <>
                <th className={TH}>Por qué</th>
                <th className={TH}>Planner</th>
                <th className={TH}>Cliente</th>
                <th className={TH}>Tu comentario</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {filas.map(f => (
            <tr
              key={f.vinculoId}
              onClick={() => onAbrir(f)}
              className="group cursor-pointer border-b border-[#f2f2f2] transition hover:bg-[#f4f4f4]"
            >
              <td className={TD}>
                <span className="block font-bold tabular-nums">{fechaLarga(f.fecha) || <Guion />}</span>
                <span className="block text-[11.5px] text-[#999]">{etiquetaRelativa(f.fecha, f.fechaFin, hoy)}</span>
              </td>
              <td className={TD}>
                <span className="inline-flex items-center gap-1.5 font-bold">
                  {f.nombre}
                  <ArrowUpRight size={11} className="text-[#c4c4c4] opacity-0 transition group-hover:opacity-100" />
                </span>
                {f.lugar && <span className="block text-[11.5px] text-[#999]">{f.lugar}</span>}
              </td>
              <td className={TD}><EstatusProveedor estado={f.estatus} /></td>
              <td className={`${TD} text-right`}>
                <Dinero monto={f.cotizado} moneda={f.moneda} fuerte={f.contratado == null} tachado={f.contratado != null} />
              </td>
              <td className={`${TD} text-right`}><Dinero monto={f.contratado} moneda={f.moneda} fuerte /></td>
              <td className={`${TD} text-right`}><Ahorro valor={f.ahorro} /></td>
              {activos ? (
                <>
                  <td className={`${TD} text-right`}>
                    {f.contratado == null ? <Guion /> : (
                      <>
                        <span className="tabular-nums">{formatCurrency(f.pagado, f.moneda)}</span>
                        {f.porcentajePagado != null && <span className="block text-[11.5px] text-[#999]">{f.porcentajePagado}%</span>}
                      </>
                    )}
                  </td>
                  <td className={`${TD} text-right`}>
                    <Dinero monto={f.porPagar} moneda={f.moneda} fuerte />
                    {f.porPagar === 0 && <span className="block text-[11.5px] font-semibold text-[#1D9E75]">liquidado</span>}
                  </td>
                </>
              ) : (
                <>
                  <td className={`${TD} max-w-[220px] whitespace-normal text-[#666]`}>{f.porQue ?? <Guion />}</td>
                  <td className={TD}><Calificacion score={f.planner} /></td>
                  <td className={TD}><Calificacion score={f.cliente} /></td>
                  <td className={`${TD} max-w-[240px] whitespace-normal text-[#1D1E20]`}>{f.comentario ?? <Guion />}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={TF} colSpan={3}>
              <span className="text-[10.5px] uppercase tracking-[.09em] text-[#666]">Balance consolidado</span>
              <span className="ml-2 text-[12px] font-semibold text-[#999]">
                {t.eventos} {t.eventos === 1 ? 'evento' : 'eventos'} · {activos ? `${t.contratados} ${t.contratados === 1 ? 'contratado' : 'contratados'}` : `se quedó ${t.contratados} de ${t.eventos}`}
              </span>
            </td>
            <td className={`${TF} text-right text-[#999]`}>{formatCurrency(t.cotizado, moneda)}</td>
            <td className={`${TF} text-right text-[13.5px]`}>{formatCurrency(t.contratado, moneda)}</td>
            <td className={`${TF} text-right`}><Ahorro valor={t.ahorro} /></td>
            {activos ? (
              <>
                <td className={`${TF} text-right`}>{formatCurrency(t.pagado, moneda)}</td>
                <td className={`${TF} text-right text-[13.5px]`}>{formatCurrency(t.porPagar, moneda)}</td>
              </>
            ) : (
              <>
                <td className={TF}></td>
                <td className={`${TF} tabular-nums`}>{t.planner != null ? t.planner.toFixed(1) : ''}</td>
                <td className={`${TF} tabular-nums`}>{t.cliente != null ? t.cliente.toFixed(1) : ''}</td>
                <td className={`${TF} text-center text-[10.5px] text-[#999]`}>{moneda}</td>
              </>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Celda({ etiqueta, children, nota, notaColor }: { etiqueta: string; children: React.ReactNode; nota?: string | null; notaColor?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-bold uppercase tracking-[.07em] text-[#999]">{etiqueta}</span>
      <span className="text-[14.5px] font-bold tabular-nums">{children}</span>
      {nota && <span className={`text-[11px] ${notaColor ?? 'text-[#999]'}`}>{nota}</span>}
    </div>
  )
}

export function FilasExpediente({ filas, carpeta, hoy, moneda, onAbrir }: Props) {
  if (filas.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-[#999]">{textoVacio(carpeta)}</p>
  }
  const t = totales(filas)
  const activos = carpeta === 'activos'

  return (
    <div>
      {filas.map(f => {
        const relativa = etiquetaRelativa(f.fecha, f.fechaFin, hoy)
        const subtitulo = [fechaLarga(f.fecha), activos ? relativa : null, f.lugar].filter(Boolean).join(' · ')
        return (
          <button
            key={f.vinculoId}
            type="button"
            onClick={() => onAbrir(f)}
            className="flex w-full flex-col gap-2 border-b border-[#f2f2f2] px-4 py-3 text-left transition active:bg-[#f4f4f4]"
          >
            <div className="flex w-full items-start gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-bold">{f.nombre}</span>
                <span className="block text-[11.5px] text-[#999]">{subtitulo}</span>
              </span>
              <EstatusProveedor estado={f.estatus} chico />
            </div>
            <div className="grid w-full grid-cols-3 gap-2">
              {activos ? (
                <>
                  <Celda etiqueta="Contrató" nota={f.cotizado != null ? `cotizó ${formatCurrency(f.cotizado, f.moneda)}` : null}>
                    <Dinero monto={f.contratado} moneda={f.moneda} />
                  </Celda>
                  <Celda etiqueta="Pagado" nota={f.porcentajePagado != null ? `${f.porcentajePagado}%` : null}>
                    {f.contratado == null ? <Guion /> : <span className="tabular-nums">{formatCurrency(f.pagado, f.moneda)}</span>}
                  </Celda>
                  <Celda etiqueta="Por pagar" nota={f.porPagar === 0 ? 'liquidado' : null} notaColor="text-[#1D9E75] font-semibold">
                    <Dinero monto={f.porPagar} moneda={f.moneda} />
                  </Celda>
                </>
              ) : (
                <>
                  <Celda
                    etiqueta="Contrató"
                    nota={f.ahorro != null ? `${f.ahorro > 0 ? '+' : ''}${f.ahorro}% vs cotizado` : f.cotizado != null ? `cotizó ${formatCurrency(f.cotizado, f.moneda)}` : null}
                    notaColor={f.ahorro != null ? (f.ahorro <= 0 ? 'text-[#1D9E75] font-semibold' : 'text-[#A63B27] font-semibold') : undefined}
                  >
                    <Dinero monto={f.contratado} moneda={f.moneda} />
                  </Celda>
                  <Celda etiqueta="Planner"><Calificacion score={f.planner} /></Celda>
                  <Celda etiqueta="Cliente"><Calificacion score={f.cliente} /></Celda>
                </>
              )}
            </div>
            {!activos && (f.porQue || f.comentario) && (
              <p className="text-[13px] text-[#666]">
                {f.porQue && <><span className="text-[#999]">Por qué</span> {f.porQue}</>}
                {f.porQue && f.comentario && <span className="text-[#999]"> · </span>}
                {f.comentario && <span className="text-[#1D1E20]">«{f.comentario}»</span>}
              </p>
            )}
          </button>
        )
      })}

      <div className="flex flex-col gap-1.5 border-t-2 border-[#e0e0e0] bg-[#f8f8f8] px-4 py-3">
        <span className="text-[10.5px] font-bold uppercase tracking-[.09em] text-[#666]">
          Balance · {t.eventos} {t.eventos === 1 ? 'evento' : 'eventos'} · {activos ? `${t.contratados} ${t.contratados === 1 ? 'contratado' : 'contratados'}` : `se quedó ${t.contratados} de ${t.eventos}`}
        </span>
        <div className="grid grid-cols-3 gap-2">
          {activos ? (
            <>
              <Celda etiqueta="Contrató">{formatCurrency(t.contratado, moneda)}</Celda>
              <Celda etiqueta="Pagado">{formatCurrency(t.pagado, moneda)}</Celda>
              <Celda etiqueta="Por pagar">{formatCurrency(t.porPagar, moneda)}</Celda>
            </>
          ) : (
            <>
              <Celda etiqueta="Contrató">{formatCurrency(t.contratado, moneda)}</Celda>
              <Celda etiqueta="Planner">{t.planner != null ? t.planner.toFixed(1) : <Guion />}</Celda>
              <Celda etiqueta="Cliente">{t.cliente != null ? t.cliente.toFixed(1) : <Guion />}</Celda>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
