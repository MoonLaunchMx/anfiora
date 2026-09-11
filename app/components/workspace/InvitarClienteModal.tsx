'use client'
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { Modal } from '@/app/components/ui/Modal'
import { postJson } from '@/lib/workspace/cliente'
import { enlaceWhatsApp, mensajeCliente } from '@/lib/workspace/compartir'
import type { WorkspaceResumen } from '@/lib/workspace/tipos'

interface Props {
  open: boolean
  onClose: () => void
  workspace: WorkspaceResumen
  bodaFija?: string
  onHecho: (r: { inviteToken: string }) => void
}

export function InvitarClienteModal({ open, onClose, workspace, bodaFija, onHecho }: Props) {
  const [email, setEmail] = useState('')
  const [eventId, setEventId] = useState(bodaFija ?? workspace.bodas[0]?.id ?? '')
  const nombreBoda = workspace.bodas.find(b => b.id === eventId)?.name ?? ''
  const [punto, setPunto] = useState<'ver' | 'editar'>('ver')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const guardar = async () => {
    setGuardando(true); setError('')
    try {
      const r = await postJson('/api/workspace/clientes', { workspaceId: workspace.id, eventId, email: email.trim(), puntoDePartida: punto })
      setToken(r.inviteToken)
      onHecho({ inviteToken: r.inviteToken })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally { setGuardando(false) }
  }
  const link = token ? `${window.location.origin}/invite/${token}` : ''
  const copiar = async () => { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1500) }
  const inputCls = 'mt-1 w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none focus:border-[#48C9B0]'

  return (
    <Modal open={open} onClose={onClose} size="md">
      <Modal.Header title={token ? 'Invitación lista' : 'Invitar cliente'} subtitle="Los anfitriones, sus papás, quien sea de ese evento. Entra solo ahí y no ocupa asiento." />
      <Modal.Body>
        {token ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs text-[#666]">{link}</span>
              <button onClick={copiar} className="flex shrink-0 items-center gap-1 rounded-md border border-[#e0e0e0] bg-white px-2 py-1 text-xs font-semibold text-[#1D1E20]">
                {copiado ? <Check size={12} className="text-[#48C9B0]" /> : <Copy size={12} />} {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <a
              href={enlaceWhatsApp(mensajeCliente(nombreBoda, link))}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1eb855]"
            >
              <FaWhatsapp size={16} /> Enviar por WhatsApp
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-[#666]">Correo
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@correo.com" autoFocus className={inputCls} />
            </label>
            <label className="text-xs font-semibold text-[#666]">Boda
              <select value={eventId} onChange={e => setEventId(e.target.value)} disabled={!!bodaFija} className={inputCls}>
                {workspace.bodas.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <div>
              <p className="text-xs font-semibold text-[#666]">Punto de partida</p>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {([['ver', 'Solo lectura', 'Ve todo, no toca nada'], ['editar', 'Puede editar', 'Agrega y corrige, no borra']] as const).map(([v, l, d]) => (
                  <button key={v} type="button" onClick={() => setPunto(v)}
                    className={'rounded-lg border px-3 py-2.5 text-left transition ' + (punto === v ? 'border-[#48C9B0] bg-[#f0fdfb]' : 'border-[#e0e0e0] bg-white hover:border-[#48C9B0]')}>
                    <span className="block text-[12px] font-semibold text-[#1D1E20]">{l}</span>
                    <span className="block text-[11px] text-[#888]">{d}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-[#aaa]">Después le ajustas herramienta por herramienta desde la pestaña Equipo del evento.</p>
            </div>
            {error && <p className="text-xs text-[#cc3333]">{error}</p>}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button className="rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#888] transition hover:bg-[#f5f5f5]" onClick={onClose}>{token ? 'Listo' : 'Cancelar'}</button>
        {!token && <button className="ml-auto rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-[#08312a] disabled:opacity-60" disabled={guardando || !email.trim() || !eventId} onClick={guardar}>{guardando ? 'Creando' : 'Crear enlace'}</button>}
      </Modal.Footer>
    </Modal>
  )
}
