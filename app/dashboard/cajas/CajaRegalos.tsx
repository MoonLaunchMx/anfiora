'use client'

import { formatCurrency } from '@/lib/types'
import CajaShell, { T_CUERPO, T_METRICA, type PropsCaja } from './CajaShell'

function Barra({ tramos, alto = 'h-2' }: { tramos: { pct: number; color: string }[]; alto?: string }) {
  return (
    <div className={`my-3 flex ${alto} overflow-hidden rounded-full bg-[#F0F0F0]`}>
      {tramos.filter(t => t.pct > 0).map((t, i) => (
        <span key={i} className="block h-full transition-all duration-500" style={{ width: `${t.pct}%`, background: t.color }} />
      ))}
    </div>
  )
}

export default function CajaRegalos({ m, modoPersonalizar, onQuitar }: PropsCaja) {
  const pctApartado = m.regalos.totalItems > 0
    ? (m.regalos.apartados / m.regalos.totalItems) * 100
    : 0

  return (
    <CajaShell
      id="regalos"
      titulo="Mesa de regalos"
      modoPersonalizar={modoPersonalizar}
      onQuitar={onQuitar}
    >
      <div className="px-5 py-4">
        <p className={T_METRICA}>{formatCurrency(m.regalos.recibido, m.event.currency)}</p>
        <Barra tramos={[{ pct: pctApartado, color: '#D4A853' }]} />
        <p className={T_CUERPO}>{m.regalos.apartados} de {m.regalos.totalItems} apartados</p>
      </div>
    </CajaShell>
  )
}
