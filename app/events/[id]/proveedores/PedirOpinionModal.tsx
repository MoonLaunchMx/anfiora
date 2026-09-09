'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { Modal } from '@/app/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { randomToken } from '@/lib/invite'
import { interpretarEscritura } from '@/lib/invite/persistencia'
import { urlOpinion, mensajeWhatsApp } from '@/lib/reviews/link-cliente'

type Contratado = { id: string; nombre: string; categoria: string }

type Props = {
  abierto: boolean
  onClose: () => void
  eventoId: string
  eventoNombre: string
  contratados: Contratado[]
  seleccionActual: string[] | null
  token: string | null
  onEnviado: (token: string, ids: string[]) => void
}

// El planner elige a quienes califica el cliente: es el unico que sabe con
// quien tuvieron cara. Vienen todos palomeados; desmarca al generador de luz.
export default function PedirOpinionModal({
  abierto, onClose, eventoId, eventoNombre, contratados, seleccionActual, token, onEnviado,
}: Props) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!abierto) return
    const base = seleccionActual && seleccionActual.length > 0
      ? seleccionActual.filter(id => contratados.some(c => c.id === id))
      : contratados.map(c => c.id)
    setMarcados(new Set(base))
    setError('')
    setCopiado(false)
  }, [abierto, seleccionActual, contratados])

  const alternar = (id: string) => {
    setMarcados(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  // Un solo link por evento: se crea la primera vez y se reutiliza siempre.
  const asegurarLink = async (): Promise<string | null> => {
    const ids = contratados.filter(c => marcados.has(c.id)).map(c => c.id)
    if (ids.length === 0) { setError('Elige al menos un proveedor.'); return null }
    const tokenFinal = token ?? randomToken(12)
    setGuardando(true)
    const res = await supabase
      .from('event_settings')
      .update({ review_token: tokenFinal, review_event_supplier_ids: ids })
      .eq('event_id', eventoId)
      .select('event_id')
    setGuardando(false)
    const r = interpretarEscritura(res)
    if (!r.ok) { setError(r.motivo); return null }
    onEnviado(tokenFinal, ids)
    return tokenFinal
  }

  const enviarWhatsApp = async () => {
    const t = await asegurarLink()
    if (!t) return
    const url = urlOpinion(window.location.origin, t)
    window.open(`https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp(eventoNombre, url))}`, '_blank', 'noopener,noreferrer')
    onClose()
  }

  const copiarLink = async () => {
    const t = await asegurarLink()
    if (!t) return
    try {
      await navigator.clipboard.writeText(urlOpinion(window.location.origin, t))
      setCopiado(true)
    } catch {
      setError('No se pudo copiar. Mándalo por WhatsApp.')
    }
  }

  if (!abierto) return null
  const n = marcados.size

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header title="Pedir la opinión de tu cliente" subtitle={`${contratados.length} proveedores contratados`} />
      <Modal.Body>
        <ul className="divide-y divide-[#f2f2f2] rounded-xl border border-[#eee]">
          {contratados.map(c => {
            const on = marcados.has(c.id)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => alternar(c.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#fafafa]"
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? 'border-[#1D1E20] bg-[#1D1E20] text-white' : 'border-[#e0e0e0] bg-white'}`}>
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${on ? 'text-[#1D1E20]' : 'text-[#999]'}`}>{c.nombre}</span>
                    {c.categoria && <span className="block text-xs text-[#999]">{c.categoria}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {error && <p className="mt-3 text-xs text-[var(--error-text)]">{error}</p>}
        {copiado && <p className="mt-3 text-xs text-[#2a7a50]">Link copiado.</p>}
      </Modal.Body>
      <Modal.Footer>
        <span className="text-xs tabular-nums text-[#666]"><b className="text-[#1D1E20]">{n}</b> de {contratados.length} · les toma {Math.max(1, n)} min</span>
        <button
          type="button"
          onClick={copiarLink}
          disabled={guardando}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-2 text-xs font-semibold text-[#1D1E20] hover:bg-[#f5f5f5] disabled:opacity-50"
        >
          <Copy size={13} /> Copiar link
        </button>
        <button
          type="button"
          onClick={enviarWhatsApp}
          disabled={guardando}
          className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3aa896] disabled:opacity-50"
        >
          <FaWhatsapp size={14} /> Enviar por WhatsApp
        </button>
      </Modal.Footer>
    </Modal>
  )
}
