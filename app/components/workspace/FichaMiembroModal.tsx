'use client'
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { Modal } from '@/app/components/ui/Modal'
import { useConfirm } from '@/app/components/ui/ConfirmModal'
import { PermisosEditor } from '@/app/events/[id]/configuracion/PermisosEditor'
import { eventosParaRepartir, hoyISO } from '@/lib/workspace/eventos'
import type { PermisosEvento } from '@/lib/permisos/catalogo'
import { resumenPermisos } from '@/lib/permisos/resumen'
import { deleteJson, patchJson } from '@/lib/workspace/cliente'
import { enlaceWhatsApp, mensajeEquipo } from '@/lib/workspace/compartir'
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
  // Eventos agregados en esta sesion que todavia no tienen permisos elegidos.
  const [porElegir, setPorElegir] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [accion, setAccion] = useState<'guardar' | 'quitar' | null>(null)
  const [copiado, setCopiado] = useState(false)
  const ocupado = accion !== null
  // Mismo criterio que el alta, pero NUNCA se esconde un evento donde la
  // persona ya tiene acceso: desaparecerlo la dejaria sin manera de quitarselo.
  const yaTiene = new Set(miembro.bodas.filter(b => b.status !== 'revoked').map(b => b.eventId))
  const bodasActivas = eventosParaRepartir(workspace.bodas, hoyISO(), yaTiene)

  const alternar = (eventId: string) => {
    const yaEstaba = !!bodas[eventId]
    setBodas(prev => {
      const n = { ...prev }
      if (n[eventId]) delete n[eventId]
      else n[eventId] = {}
      return n
    })
    setPorElegir(prev => {
      const n = new Set(prev)
      if (yaEstaba) n.delete(eventId)
      else n.add(eventId)
      return n
    })
    // Se abre solo: agregar un evento ES elegir sus permisos.
    if (!yaEstaba) setAbierta(eventId)
  }

  const guardar = async () => {
    if (porElegir.size > 0) {
      const nombres = [...porElegir]
        .map(id => workspace.bodas.find(b => b.id === id)?.name)
        .filter(Boolean)
      setError('Falta elegir los permisos de: ' + nombres.join(', '))
      setAbierta([...porElegir][0])
      return
    }
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
      title: `¿Revocar el acceso de ${miembro.nombre ?? miembro.email}?`,
      message: 'Deja de entrar a todos sus eventos y su asiento se libera. Puedes volver a invitarla cuando quieras.',
      confirmLabel: 'Revocar acceso', tone: 'danger',
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
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#f0dfae] bg-[#fffbf0] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs text-[#7a5a14]">Todavía no entra. Enlace: {link}</span>
              <button onClick={copiar} className="flex shrink-0 items-center gap-1 rounded-md border border-[#e0e0e0] bg-white px-2 py-1 text-xs font-semibold text-[#1D1E20]">
                {copiado ? <Check size={12} className="text-[#48C9B0]" /> : <Copy size={12} />} {copiado ? 'Copiado' : 'Copiar'}
              </button>
              <a
                href={enlaceWhatsApp(mensajeEquipo(workspace.name, link))}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1 rounded-md bg-[#25D366] px-2 py-1 text-xs font-semibold text-white transition hover:bg-[#1eb855]"
              >
                <FaWhatsapp size={12} /> Reenviar
              </a>
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
                  const falta = porElegir.has(b.id)
                  const resumen = on ? resumenPermisos(bodas[b.id]) : null
                  return (
                    <div
                      key={b.id}
                      className={'rounded-lg border ' + (
                        falta ? 'border-[#f0dfae] bg-[#fffbf0]'
                        : on ? 'border-[#48C9B0] bg-[#f0fdfb]'
                        : 'border-[#e0e0e0]'
                      )}
                    >
                      <div className="flex items-center gap-3 py-1 pl-3 pr-3">
                        <label className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-3 py-2">
                        <input type="checkbox" checked={on} onChange={() => alternar(b.id)} className="h-[18px] w-[18px] shrink-0 accent-[#48C9B0]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[#1D1E20]">{b.name}</span>
                          {on && (
                            <span className={'block text-xs ' + (falta ? 'font-semibold text-[#8a6a1f]' : 'text-[#1a9e88]')}>
                              {falta ? 'Falta elegir permisos' : resumen!.texto === 'Sin acceso' ? 'Sin herramientas' : resumen!.texto + ' herramientas'}
                            </span>
                          )}
                        </span>
                        </label>
                        {on && (
                          <button
                            type="button"
                            onClick={() => setAbierta(abierta === b.id ? null : b.id)}
                            className={'shrink-0 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold transition ' + (
                              falta ? 'border-[#f0dfae] text-[#8a6a1f]' : 'border-[#cdeee6] text-[#1a9e88]'
                            )}
                          >
                            {abierta === b.id ? 'Cerrar' : falta ? 'Elegir' : 'Ajustar'}
                          </button>
                        )}
                      </div>
                      {on && abierta === b.id && (
                        <div className="border-t border-[#e8e8e8] bg-white px-3 py-3">
                          <PermisosEditor
                            permisos={bodas[b.id]}
                            features={b.features}
                            onChange={next => {
                              setBodas(prev => ({ ...prev, [b.id]: next }))
                              // Tocar los permisos ES elegirlos: deja de faltar.
                              setPorElegir(prev => { const n = new Set(prev); n.delete(b.id); return n })
                            }}
                          />
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
        {!miembro.es_dueno_principal && <button className="rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-4 py-2 text-sm text-[#cc3333] disabled:opacity-60" disabled={ocupado} onClick={revocar}>{accion === 'quitar' ? 'Revocando acceso' : 'Revocar acceso'}</button>}
        <button className="ml-auto rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#888] transition hover:bg-[#f5f5f5] disabled:opacity-60" disabled={ocupado} onClick={onClose}>Cancelar</button>
        {!miembro.es_dueno_principal && <button className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-[#08312a] disabled:opacity-60" disabled={ocupado} onClick={guardar}>{accion === 'guardar' ? 'Guardando' : 'Guardar'}</button>}
      </Modal.Footer>
    </Modal>
  )
}
