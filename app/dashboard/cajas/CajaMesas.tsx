'use client'

import { LayoutGrid } from 'lucide-react'
import CajaShell, { type PropsCaja } from './CajaShell'

function Ficha({ valor, label, tono }: { valor: number | string; label: string; tono?: 'aviso' | 'teal' }) {
  const fondo = tono === 'aviso' ? 'bg-[#FFF8E8]' : tono === 'teal' ? 'bg-[#F0FDFB]' : 'bg-[#F8F8F8]'
  const color = tono === 'aviso' ? 'text-[#B8860B]' : tono === 'teal' ? 'text-[#1A9E88]' : 'text-[#1D1E20]'
  return (
    <div className={`rounded-xl px-2 py-3 text-center ${fondo}`}>
      <b className={`block font-display text-[22px] font-extrabold leading-none ${color}`}>{valor}</b>
      <span className="mt-1.5 block text-[12px] text-[#888]">{label}</span>
    </div>
  )
}

export default function CajaMesas({ m, modoPersonalizar, onQuitar }: PropsCaja) {
  const pctAcomodado = m.mesas.conLugar + m.mesas.sinLugar > 0
    ? Math.round((m.mesas.conLugar / (m.mesas.conLugar + m.mesas.sinLugar)) * 100)
    : 0

  return (
    <CajaShell
      id="mesas"
      titulo="Mesas y acomodo"
      Icono={LayoutGrid}
      meta={`${m.mesas.mesas} mesas · ${m.mesas.conGente} con gente`}
      accion={{ label: 'Ver mesas', href: `/events/${m.event.id}/mesas` }}
      modoPersonalizar={modoPersonalizar}
      onQuitar={onQuitar}
    >
      <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4">
        <Ficha valor={m.mesas.conLugar} label="Con lugar" />
        <Ficha valor={m.mesas.sinLugar} label="Sin lugar" tono={m.mesas.sinLugar > 0 ? 'aviso' : undefined} />
        <Ficha valor={m.mesas.sillasLibres} label="Sillas libres" />
        <Ficha valor={`${pctAcomodado}%`} label="Acomodado" tono="teal" />
      </div>
    </CajaShell>
  )
}
