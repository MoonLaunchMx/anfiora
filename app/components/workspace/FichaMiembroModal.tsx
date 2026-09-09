'use client'
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import { useConfirm } from '@/app/components/ui/ConfirmModal'
import { PermisosEditor } from '@/app/events/[id]/configuracion/PermisosEditor'
import { eventosParaRepartir, hoyISO } from '@/lib/workspace/eventos'
import type { PermisosEvento } from '@/lib/permisos/catalogo'
import { aplicarKit, permisosDeRol } from '@/lib/permisos/resolver'
import { deleteJson, patchJson } from '@/lib/workspace/cliente'
import { kitDesde } from '@/lib/workspace/invitacion'
import { ROL_LABEL, type Miembro, type RolInvitable, type WorkspaceResumen } from '@/lib/workspace/tipos'

interface Props {
  open: boolean
  onClose: () => void
  workspace: WorkspaceResumen
  miembro: Miembro
  // Devuelve promesa cuando quien llama recarga la lista: el modal la espera
  // antes de cerrarse, para no dejar la fila vieja un segundo en pantalla.
  onHecho: () => void | Promise<void>
}

export function FichaMiembroModal({ open, onClose, workspace, miembro, onHecho }: Props) {
  const confirm = useConfirm()
  const [rol, setRol] = useState<RolInvitable>(miembro.rol === 'admin' ? 'admin' : 'colaborador')
  const [bodas, setBodas] = useState<Record<string, PermisosEvento>>(
    Object.fromEntries(miembro.bodas.filter(b => b.status !== 'revoked').map(b => [b.eventId, b.permisos])),
  )
  const [abierta, setAbierta] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [accion, setAccion] = useState<'guardar' | 'quitar' | null>(null)
  const [copiado, setCopiado] = useState(false)
  const ocupado = accion !== null
  const kit = kitDesde(miembro.bodas)
  // Mismo criterio que el alta, pero NUNCA se esconde un evento donde la
  // persona ya tiene acceso: desaparecerlo la dejaria sin manera de quitarselo.
  const yaTiene = new Set(miembro.bodas.filter(b => b.status !== 'revoked').map(b => b.eventId))
  const bodasActivas = eventosParaRepartir(workspace.bodas, hoyISO(), yaTiene)

  const alternar = (eventId: string) => {
    setBodas(prev => {
      const n = { ...prev }
      if (n[eventId]) delete n[eventId]
      else {
        const boda = workspace.bodas.find(b => b.id === eventId)!
        n[eventId] = aplicarKit(Object.keys(kit).length ? kit : permisosDeRol('editor'), boda.features)
      }
      return n
    })
  }

  const guardar = async () => {
    setAccion('guardar'); setError('')
    try {
      await patchJson(`/api/workspace/miembros/${miembro.id}`, {
        rol,
        bodas: rol === 'admin' ? [] : Object.entries(bodas).map(([eventId, permisos]) => ({ eventId, permisos })),
      })
      // Se espera a que la lista se refresque ANTES de cerrar. Si no, el modal
      // desaparece y la fila vieja se queda un segundo en pantalla.
      await onHecho()
      onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') }
    finally { setAccion(null) }
  }

  const revocar = async () => {
    const ok = await confirm({
      title: `¿Quitar a ${miembro.nombre ?? miembro.email} del workspace?`,
      message: 'Pierde el acceso a todos sus eventos. Su asiento se libera. Puedes volver a invitarla después.',
      confirmLabel: 'Quitar', tone: 'danger',
    })
    if (!ok) return
    setAccion('quitar')
    setError('')
    try {
      await deleteJson(`/api/workspace/miembros/${miembro.id}`)
      // Igual que al guardar: primero desaparece de la lista, luego se cierra.
      await onHecho()
      onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo quitar') }
    finally { setAccion(null) }
  }

  const link = miembro.invite_token ? `${window.location.origin}/invite/${miembro.invite_token}` : ''
  const copiar = async () => { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1500) }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <Modal.Header title={miembro.nombre ?? miembro.email} subtitle={miembro.email + ' · ' + ROL_LABEL[miembro.rol] + (miembro.status === 'pending' ? ' · Invitación pendiente' : '')} />
      <Modal.Body>
        <div className="flex flex-col gap-4">
          {miembro.status === 'pending' && link && (
            <div className="flex items-center gap-2 rounded-lg border border-[#f0dfae] bg-[#fffbf0] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs text-[#7a5a14]">Todavía no entra. Enlace: {link}</span>
              <button onClick={copiar} className="flex items-center gap-1 rounded-md border border-[#e0e0e0] bg-white px-2 py-1 text-xs font-semibold text-[#1D1E20]">
                {copiado ? <Check size={12} className="text-[#48C9B0]" /> : <Copy size={12} />} {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          )}
          {!miembro.es_dueno_principal && (
            <div>
              <p className="text-xs font-semibold text-[#666]">Rol en el workspace</p>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {([['colaborador', 'Colaborador'], ['admin', 'Administrador']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setRol(v)} className={'rounded-lg border px-3 py-2 text-[12px] font-semibold transition ' + (rol === v ? 'border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]' : 'border-[#e0e0e0] text-[#666]')}>{l}</button>
                ))}
              </div>
            </div>
          )}
          {rol === 'admin' || miembro.es_dueno_principal ? (
            <p className="rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2.5 text-[13px] text-[#666]">Entra a todos los eventos con acceso total.</p>
          ) : (
            <div>
              <p className="text-xs font-semibold text-[#666]">Eventos y permisos</p>
              <div className="mt-1 flex flex-col gap-1.5">
                {bodasActivas.map(b => {
                  const on = !!bodas[b.id]
                  return (
                    <div key={b.id} className={'rounded-lg border ' + (on ? 'border-[#48C9B0]' : 'border-[#e0e0e0]')}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <input type="checkbox" checked={on} onChange={() => alternar(b.id)} className="accent-[#48C9B0]" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#1D1E20]">{b.name}</span>
                        {on && <button type="button" onClick={() => setAbierta(abierta === b.id ? null : b.id)} className="text-[11px] font-semibold text-[#1a9e88]">{abierta === b.id ? 'Cerrar' : 'Permisos'}</button>}
                      </div>
                      {on && abierta === b.id && (
                        <div className="border-t border-[#e8e8e8] px-3 py-3">
                          <PermisosEditor permisos={bodas[b.id]} features={b.features} onChange={next => setBodas(prev => ({ ...prev, [b.id]: next }))} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {error && <p className="text-xs text-[#cc3333]">{error}</p>}
        </div>
      </Modal.Body>
      <Modal.Footer>
        {!miembro.es_dueno_principal && <button className="rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-4 py-2 text-sm text-[#cc3333] disabled:opacity-60" disabled={ocupado} onClick={revocar}>{accion === 'quitar' ? 'Quitando…' : 'Quitar del workspace'}</button>}
        <button className="ml-auto rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#888] transition hover:bg-[#f5f5f5] disabled:opacity-60" disabled={ocupado} onClick={onClose}>Cancelar</button>
        {!miembro.es_dueno_principal && <button className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-[#08312a] disabled:opacity-60" disabled={ocupado} onClick={guardar}>{accion === 'guardar' ? 'Guardando…' : 'Guardar'}</button>}
      </Modal.Footer>
    </Modal>
  )
}
