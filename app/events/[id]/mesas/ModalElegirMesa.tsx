'use client'

import { useState } from 'react'
import { Modal } from '@/app/components/ui/Modal'
import type { Lugar, Persona } from '@/lib/mesas/asientos'

type Mesa = { id: string; number: number; name: string | null; capacity: number }

export type ElegirMesa = { personas: Persona[]; titulo: string }

// Elegir la mesa destino para una persona (Mover) o para una familia sin mesa
// (Sentar a los N). Las llenas salen apagadas; se ve donde esta su familia.
export default function ModalElegirMesa({ abierto, tables, ocupacion, mapa, personas, onElegir, onClose }: {
  abierto: ElegirMesa | null
  tables: Mesa[]
  ocupacion: (tableId: string) => number
  mapa: Map<string, Lugar>
  personas: Persona[]
  onElegir: (tableId: string) => Promise<boolean>
  onClose: () => void
}) {
  const [elegida, setElegida] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  if (!abierto) return null
  const gente = abierto.personas
  const necesita = gente.length
  const guestIds = new Set(gente.map(p => p.guestId))
  const mesaActual = necesita === 1 ? mapa.get(gente[0].clave)?.tableId ?? null : null

  const familiaEn = (tableId: string) => personas
    .filter(p => guestIds.has(p.guestId) && !gente.some(g => g.clave === p.clave) && mapa.get(p.clave)?.tableId === tableId)
    .map(p => p.nombre)

  const confirmar = async () => {
    if (!elegida) return
    setGuardando(true)
    const ok = await onElegir(elegida)
    setGuardando(false)
    if (ok) { setElegida(null); onClose() }
  }

  return (
    <Modal open onClose={() => { setElegida(null); onClose() }} size="sm">
      <Modal.Header title={abierto.titulo} subtitle={necesita === 1 ? undefined : `Necesitan ${necesita} lugares en la misma mesa`} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {[...tables].sort((a, b) => a.number - b.number).map(t => {
          const libres = t.capacity - ocupacion(t.id)
          const aqui = mesaActual === t.id
          const cabe = libres >= necesita && !aqui
          const fam = familiaEn(t.id)
          return (
            <button key={t.id} type="button" disabled={!cabe} onClick={() => setElegida(t.id)}
              className={'flex w-full items-center gap-3 border-b border-[#f5f5f5] px-4 py-3 text-left last:border-0 ' + (!cabe ? 'cursor-not-allowed opacity-40' : elegida === t.id ? 'bg-[#f0fdfb] ring-1 ring-inset ring-[#48C9B0]' : 'hover:bg-[#f8f8f8]')}>
              <span className="rounded bg-[#f0f0f0] px-1.5 py-0.5 text-xs font-bold text-[#555]">#{t.number}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#1D1E20]">{t.name || `Mesa ${t.number}`}</p>
                {fam.length > 0 && <p className="truncate text-[10.5px] text-[#9a6b12]">Aquí {fam.length === 1 ? 'está' : 'están'} {fam.join(', ')}</p>}
              </div>
              <span className="shrink-0 text-[11px] font-medium" style={{ color: aqui ? '#48C9B0' : libres <= 0 ? '#cc3333' : '#888' }}>
                {aqui ? 'Aquí está' : libres <= 0 ? 'Llena' : `${libres} ${libres === 1 ? 'libre' : 'libres'}`}
              </span>
            </button>
          )
        })}
      </div>
      <Modal.Footer>
        <button type="button" onClick={() => { setElegida(null); onClose() }} className="flex-1 rounded-lg border border-[#e0e0e0] py-3 text-sm text-[#888]">Cancelar</button>
        <button type="button" onClick={confirmar} disabled={!elegida || guardando} className="flex-[2] rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white disabled:opacity-40">
          {guardando ? 'Guardando…' : necesita === 1 ? 'Mover' : `Sentar a ${necesita}`}
        </button>
      </Modal.Footer>
    </Modal>
  )
}
