'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import DatePicker from '@/app/components/ui/DatePicker'
import { extenderVencimiento, textoAviso, tonoDelAviso, CLASES_TONO } from '@/lib/reviews/link-cliente'
import type { InfoLink } from '@/lib/reviews/link-cliente'

type Props = {
  info: InfoLink
  contestados: number
  total: number
  puedeEditar: boolean
  canAdmin: boolean
  // Pedir por primera vez y volver a ver el link abren el mismo modal.
  onAbrirLink: () => void
  onDarMasTiempo: (nuevoVence: string) => Promise<string | null>
}

const hoyISO = () => new Date().toISOString().slice(0, 10)

// Una linea, dentro de la carpeta Review de la ficha. Solo existe despues del
// evento, y se va cuando todos contestaron. Vencido no desaparece: es donde
// vive Reactivar.
export default function AvisoOpinionCliente({
  info, contestados, total, puedeEditar, canAdmin, onAbrirLink, onDarMasTiempo,
}: Props) {
  const [menu, setMenu] = useState(false)
  const [eligiendoFecha, setEligiendoFecha] = useState(false)
  const [fecha, setFecha] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const fuera = (e: MouseEvent) => {
      // El calendario se dibuja en un portal fuera de este menu: sin esto,
      // elegir un dia cerraria el menu y desmontaria el propio calendario.
      if ((e.target as HTMLElement).closest?.('[data-datepicker-portal]')) return
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [menu])

  if (info.estado === 'antes' || total === 0) return null
  if (info.estado !== 'vencida' && contestados >= total) return null

  const vencida = info.estado === 'vencida'
  const tono = CLASES_TONO[tonoDelAviso(info.estado) ?? 'teal']

  const aplicar = async (nuevoVence: string) => {
    setError('')
    setOcupado(true)
    const problema = await onDarMasTiempo(nuevoVence)
    setOcupado(false)
    if (problema) { setError(problema); return }
    setMenu(false)
    setEligiendoFecha(false)
  }

  const masDias = (dias: number) =>
    aplicar(extenderVencimiento({ hoy: hoyISO(), venceActual: info.vence, dias }))

  return (
    <div className={`rounded-lg border px-3 py-2 ${tono}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12px] font-semibold text-[#1D1E20]">{textoAviso(info, contestados, total)}</p>

        <div className="ml-auto flex items-center gap-1.5">
          {puedeEditar && (
            <button
              type="button"
              onClick={onAbrirLink}
              className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold ${
                info.estado === 'sin_pedir' || info.estado === 'por_vencer'
                  ? 'bg-[#48C9B0] text-white hover:bg-[#3aa896]'
                  : 'border border-[#e0e0e0] bg-white text-[#1D1E20] hover:bg-[#f5f5f5]'
              }`}
            >
              {info.estado === 'sin_pedir' ? 'Pedir opinión' : 'Ver link'}
            </button>
          )}
          {canAdmin && info.estado !== 'sin_pedir' && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenu(v => !v)}
                disabled={ocupado}
                className="flex items-center gap-1 rounded-lg border border-[#e0e0e0] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#1D1E20] hover:bg-[#f5f5f5] disabled:opacity-50"
              >
                {vencida ? 'Reactivar' : 'Dar más tiempo'} <ChevronDown size={12} />
              </button>
              {menu && (
                <div className="absolute right-0 z-20 mt-1.5 w-56 rounded-xl border border-[#e0e0e0] bg-white p-1.5 shadow-lg">
                  {!eligiendoFecha ? (
                    <>
                      <button type="button" onClick={() => masDias(7)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f5f5f5]">7 días más</button>
                      <button type="button" onClick={() => masDias(14)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f5f5f5]">14 días más</button>
                      <button type="button" onClick={() => setEligiendoFecha(true)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f5f5f5]">Elegir fecha</button>
                    </>
                  ) : (
                    <div className="p-1">
                      <DatePicker mode="single" value={fecha} onChange={setFecha} minDate={hoyISO()} placeholder="Nueva fecha" />
                      <button
                        type="button"
                        disabled={!fecha || ocupado}
                        onClick={() => aplicar(fecha)}
                        className="mt-2 w-full rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Guardar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-[var(--error-text)]">{error}</p>}
    </div>
  )
}
