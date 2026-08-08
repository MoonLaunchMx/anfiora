'use client'

import { dimensionesMesa, encuadre } from '@/lib/dashboard/croquis'
import type { MesaCroquis } from '@/lib/dashboard/types'
import CajaShell, { type PropsCaja } from './CajaShell'

function Ficha({ valor, label, tono }: { valor: number | string; label: string; tono?: 'aviso' | 'teal' }) {
  const fondo = tono === 'aviso' ? 'bg-[#FFF8E8]' : tono === 'teal' ? 'bg-[#F0FDFB]' : 'bg-[#F8F8F8]'
  const color = tono === 'aviso' ? 'text-[#B8860B]' : tono === 'teal' ? 'text-[#1A9E88]' : 'text-[#1D1E20]'
  return (
    <div className={`rounded-xl px-2 py-2.5 text-center ${fondo}`}>
      <b className={`block font-display text-[19px] font-extrabold leading-none ${color}`}>{valor}</b>
      <span className="mt-1 block text-[11px] text-[#888]">{label}</span>
    </div>
  )
}

// Solo el cuerpo de la mesa, sin sillas: a esta escala una silla mide menos de
// un pixel. Lo que se lee de un vistazo es el acomodo y que tan llena esta.
function MesaDibujada({ m }: { m: MesaCroquis }) {
  const { w, h } = dimensionesMesa(m.forma, m.capacidad)
  const llena = m.capacidad > 0 && m.ocupados >= m.capacidad
  const vacia = m.ocupados === 0

  const relleno = llena ? '#E4F7F0' : vacia ? '#FFFFFF' : '#F0FDFB'
  const borde = llena ? '#5DCAA5' : vacia ? '#DDDDDD' : '#48C9B0'
  const centro = `${m.x + w / 2} ${m.y + h / 2}`

  const cuerpo = m.forma === 'round' || m.forma === null || m.forma === undefined
    ? <ellipse cx={m.x + w / 2} cy={m.y + h / 2} rx={w / 2 - 10} ry={h / 2 - 10} fill={relleno} stroke={borde} strokeWidth={3} />
    : m.forma === 'oval'
      ? <ellipse cx={m.x + w / 2} cy={m.y + h / 2} rx={w / 2 - 12} ry={h / 2 - 12} fill={relleno} stroke={borde} strokeWidth={3} />
      : <rect x={m.x + 10} y={m.y + 10} width={Math.max(1, w - 20)} height={Math.max(1, h - 20)} rx={10} fill={relleno} stroke={borde} strokeWidth={3} />

  return (
    <g transform={m.rotacion ? `rotate(${m.rotacion} ${centro})` : undefined}>
      {cuerpo}
      <text
        x={m.x + w / 2}
        y={m.y + h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={Math.max(18, Math.min(w, h) * 0.34)}
        fontWeight={800}
        fill={vacia ? '#BBBBBB' : '#1A9E88'}
      >
        {m.numero ?? ''}
      </text>
    </g>
  )
}

export default function CajaMesas({ m, modoPersonalizar, onQuitar }: PropsCaja) {
  const pctAcomodado = m.mesas.conLugar + m.mesas.sinLugar > 0
    ? Math.round((m.mesas.conLugar / (m.mesas.conLugar + m.mesas.sinLugar)) * 100)
    : 0

  const mesas = m.croquis
  const caja = encuadre(mesas)

  return (
    <CajaShell
      id="mesas"
      titulo="Mesas y acomodo"
      meta={`${m.mesas.mesas} mesas · ${m.mesas.conGente} con gente`}
      accion={{ label: 'Ver mesas', href: `/events/${m.event.id}/mesas` }}
      modoPersonalizar={modoPersonalizar}
      onQuitar={onQuitar}
    >
      <div className="flex h-full flex-col">
        <div className="grid shrink-0 grid-cols-4 gap-2 px-5 py-3">
          <Ficha valor={m.mesas.conLugar} label="Con lugar" />
          <Ficha valor={m.mesas.sinLugar} label="Sin lugar" tono={m.mesas.sinLugar > 0 ? 'aviso' : undefined} />
          <Ficha valor={m.mesas.sillasLibres} label="Sillas libres" />
          <Ficha valor={`${pctAcomodado}%`} label="Acomodado" tono="teal" />
        </div>

        {/* El croquis toma el alto que sobre: al estirar la tarjeta se ve mas
            grande sin recalcular nada, porque el viewBox no cambia. */}
        <div className="min-h-0 flex-1 border-t border-[#F0F0F0] px-3 py-2">
          {mesas.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[#888]">Todavía no hay mesas creadas.</p>
          ) : (
            <svg
              viewBox={`${caja.x} ${caja.y} ${caja.ancho} ${caja.alto}`}
              className="h-full max-h-full w-full"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={`Croquis con ${mesas.length} mesas`}
            >
              {mesas.map(mesa => <MesaDibujada key={mesa.id} m={mesa} />)}
            </svg>
          )}
        </div>
      </div>
    </CajaShell>
  )
}
