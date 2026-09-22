'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import type { Lugar, Persona } from '@/lib/mesas/asientos'
import { ChipTitular, estatusDeChip } from './chips'

type Mesa = { id: string; number: number; name: string | null; capacity: number }

// Asignar a una mesa: un renglon por persona con palomita y la mesa donde
// esta cada quien. Como Zola en iPhone y Prismm: tocas la mesa y palomeas.
// La pagina lo monta con key={tableId}, asi cada mesa arranca limpio.
export default function ModalAsignar({ table, personas, mapa, ocupacion, numeroDeMesa, onSentar, onClose }: {
  table: Mesa | null
  personas: Persona[]
  mapa: Map<string, Lugar>
  ocupacion: (tableId: string) => number
  numeroDeMesa: (tableId: string) => number
  onSentar: (claves: string[]) => Promise<boolean>
  onClose: () => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return personas
    return personas.filter(p => p.nombre.toLowerCase().includes(q) || (p.titular || '').toLowerCase().includes(q))
  }, [personas, busqueda])

  if (!table) return null
  const occ = ocupacion(table.id)
  const libres = Math.max(0, table.capacity - occ)
  const n = marcados.size
  const cabe = n > 0 && n <= libres

  const toggle = (clave: string) => setMarcados(prev => { const s = new Set(prev); s.has(clave) ? s.delete(clave) : s.add(clave); return s })
  const sentar = async () => {
    if (!cabe) return
    setGuardando(true)
    const ok = await onSentar(Array.from(marcados))
    setGuardando(false)
    if (ok) onClose()
  }

  return (
    <Modal open onClose={onClose} size="sm">
      <div className="shrink-0 border-b border-[#f0f0f0] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-[#1D1E20]">
              Asignar a <span className="rounded bg-[#f0f0f0] px-1.5 py-0.5 text-xs font-bold text-[#555]">#{table.number}</span><span className="truncate">{table.name || `Mesa ${table.number}`}</span>
            </p>
            <p className="text-[11px]" style={{ color: libres === 0 ? '#cc3333' : '#aaa' }}>
              {libres === 0 ? 'Mesa llena' : `${libres} ${libres === 1 ? 'lugar libre' : 'lugares libres'} · ${occ}/${table.capacity}`}
            </p>
          </div>
          <button type="button" onClick={sentar} disabled={!cabe || guardando} className="shrink-0 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3ab89f] disabled:opacity-40">
            {guardando ? 'Sentando…' : n === 0 ? 'Sentar' : `Sentar a ${n}`}
          </button>
        </div>
        {n > libres && <p className="mt-1 text-[11px] font-medium text-[#cc3333]">Marcaste {n} y solo hay {libres} {libres === 1 ? 'lugar' : 'lugares'}</p>}
        <div className="relative mt-3">
          <Search width={13} height={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb]" />
          <input autoFocus type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar a alguien…" className="w-full rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] py-2 pl-8 pr-3 text-base outline-none focus:border-[#48C9B0]" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {visibles.length === 0 ? <p className="px-4 py-6 text-center text-xs text-[#bbb]">Sin resultados</p> : visibles.map(p => {
          const lugar = mapa.get(p.clave)
          const aqui = lugar?.tableId === table.id
          const st = estatusDeChip(p.rsvp)
          return (
            <label key={p.clave} className={'flex w-full items-center gap-3 border-b border-[#f5f5f5] px-4 py-2.5 last:border-0 ' + (p.memberId ? 'pl-8 ' : '') + (aqui ? 'cursor-default opacity-40' : 'cursor-pointer hover:bg-[#f0fdfb]')}>
              <input type="checkbox" checked={marcados.has(p.clave)} disabled={aqui} onChange={() => toggle(p.clave)} style={{ accentColor: '#48C9B0' }} className="shrink-0" />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <span className={'truncate text-sm ' + (p.memberId ? 'text-[#444]' : 'font-semibold text-[#1D1E20]')}>{p.nombre}</span>
                <ChipTitular persona={p} />
              </div>
              <span className="shrink-0 text-[10px] font-medium text-[#999]">{aqui ? 'Ya está aquí' : lugar ? `Mesa ${numeroDeMesa(lugar.tableId)}` : 'Sin mesa'}</span>
              <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold" style={{ background: st.bg, borderColor: st.border, color: st.text }}>{st.label.slice(0, 4)}</span>
            </label>
          )
        })}
      </div>
    </Modal>
  )
}
