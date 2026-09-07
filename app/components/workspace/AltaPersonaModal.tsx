'use client'
import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import { PermisosEditor } from '@/app/events/[id]/configuracion/PermisosEditor'
import type { PermisosEvento } from '@/lib/permisos/catalogo'
import { aplicarKit, permisosDeRol } from '@/lib/permisos/resolver'
import { contarAsientos, puedeInvitar } from '@/lib/workspace/asientos'
import { postJson } from '@/lib/workspace/cliente'
import { kitDesde, validarAltaEquipo } from '@/lib/workspace/invitacion'
import { PLANES } from '@/lib/workspace/planes'
import type { RolInvitable, WorkspaceResumen } from '@/lib/workspace/tipos'

interface Props {
  open: boolean
  onClose: () => void
  workspace: WorkspaceResumen
  bodaFija?: string
  onHecho: (r: { inviteToken: string }) => void
}

type Paso = 1 | 2 | 3

export function AltaPersonaModal({ open, onClose, workspace, bodaFija, onHecho }: Props) {
  const [paso, setPaso] = useState<Paso>(1)
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<RolInvitable>('colaborador')
  const [elegidas, setElegidas] = useState<Set<string>>(new Set(bodaFija ? [bodaFija] : []))
  const [permisos, setPermisos] = useState<Record<string, PermisosEvento>>({})
  const [bodaActual, setBodaActual] = useState<string | null>(bodaFija ?? null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const ocupados = contarAsientos(workspace.miembros)
  const permiso = puedeInvitar(workspace.plan, ocupados)
  const bodasActivas = workspace.bodas.filter(b => b.event_status !== 'archived' && b.event_status !== 'cancelled')

  // Kit: lo que ese correo ya tiene en otras bodas; si nada, "Puede editar".
  const kit = useMemo(() => {
    const m = workspace.miembros.find(x => x.email.toLowerCase() === email.trim().toLowerCase())
    return m ? kitDesde(m.bodas) : {}
  }, [workspace.miembros, email])

  const permisosDe = (eventId: string): PermisosEvento => {
    if (permisos[eventId]) return permisos[eventId]
    const boda = workspace.bodas.find(b => b.id === eventId)!
    const base = Object.keys(kit).length ? kit : permisosDeRol('editor')
    return aplicarKit(base, boda.features)
  }

  const siguiente = () => {
    setError('')
    if (paso === 1) {
      const v = validarAltaEquipo({ email, miembros: workspace.miembros })
      if (!v.ok) { setError(v.error!); return }
      if (rol === 'admin') { setPaso(3); return }
      setPaso(2)
      return
    }
    if (paso === 2) {
      if (elegidas.size === 0) { setError('Elige al menos una boda'); return }
      setBodaActual([...elegidas][0])
      setPaso(3)
    }
  }

  const guardar = async () => {
    setGuardando(true); setError('')
    try {
      const bodas = rol === 'admin' ? [] : [...elegidas].map(eventId => ({ eventId, permisos: permisosDe(eventId) }))
      const r = await postJson('/api/workspace/miembros', { workspaceId: workspace.id, email: email.trim(), rol, bodas })
      setToken(r.inviteToken)
      onHecho({ inviteToken: r.inviteToken })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const link = token ? `${window.location.origin}/invite/${token}` : ''
  const copiar = async () => { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1500) }

  const titulos: Record<Paso, string> = { 1: 'Persona', 2: 'Bodas', 3: 'Permisos' }
  const pasos = (
    <p className="mb-1 text-[11px] text-[#999]">
      {([1, 2, 3] as Paso[]).filter(p => !(rol === 'admin' && p === 2)).map((p, i) => (
        <span key={p}>{i > 0 && <span className="mx-1 text-[#ccc]">›</span>}<span className={p === paso ? 'font-semibold text-[#1D1E20]' : ''}>{p} {titulos[p]}</span></span>
      ))}
    </p>
  )

  const btnBase = 'rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60'
  const btnCta = btnBase + ' bg-[#48C9B0] text-[#08312a]'
  const btnSec = 'rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#888] transition hover:bg-[#f5f5f5]'

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <Modal.Header
        title={token ? 'Invitación lista' : 'Agregar persona al workspace'}
        subtitle={token ? 'Copia el enlace y mándaselo. Al entrar ya tiene sus bodas y sus permisos.' : 'Recibe un enlace. Al entrar ya tiene sus bodas y sus permisos.'}
      />
      <Modal.Body>
        {token ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs text-[#666]">{link}</span>
            <button onClick={copiar} className="flex items-center gap-1 rounded-md border border-[#e0e0e0] bg-white px-2 py-1 text-xs font-semibold text-[#1D1E20]">
              {copiado ? <Check size={12} className="text-[#48C9B0]" /> : <Copy size={12} />} {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        ) : !permiso.ok ? (
          <div className="rounded-xl border border-[#f0dfae] bg-[#fffbf0] px-4 py-3 text-sm text-[#7a5a14]">
            <p className="font-semibold">Para trabajar en equipo necesitas Pro.</p>
            <p className="mt-1 text-[13px]">Tu plan {PLANES[workspace.plan].nombre} es solo para ti. Escríbenos y te lo activamos.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pasos}
            {paso === 1 && (
              <>
                <label className="text-xs font-semibold text-[#666]">Correo
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@correo.com" autoFocus
                    className="mt-1 w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none focus:border-[#48C9B0]" />
                </label>
                <div>
                  <p className="text-xs font-semibold text-[#666]">Rol en el workspace</p>
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    {([['colaborador', 'Colaborador', 'Solo entra a las bodas que le des'], ['admin', 'Administrador', 'Entra a todas y reparte accesos']] as const).map(([v, l, d]) => (
                      <button key={v} type="button" onClick={() => setRol(v)}
                        className={'rounded-lg border px-3 py-2.5 text-left transition ' + (rol === v ? 'border-[#48C9B0] bg-[#f0fdfb]' : 'border-[#e0e0e0] bg-white hover:border-[#48C9B0]')}>
                        <span className="block text-[12px] font-semibold text-[#1D1E20]">{l}</span>
                        <span className="block text-[11px] text-[#888]">{d}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className={'rounded-lg px-3 py-2.5 text-[13px] ' + (permiso.costoNuevoAsiento > 0 ? 'border border-[#f0dfae] bg-[#fffbf0] text-[#7a5a14]' : 'border border-[#a0e0c0] bg-[#f0fff6] text-[#2a7a50]')}>
                  {permiso.costoNuevoAsiento > 0
                    ? <><strong>Ocupa un asiento nuevo.</strong> Tu plan incluye {PLANES[workspace.plan].asientosIncluidos} y ya usas {ocupados}. Se suma <strong>+${permiso.costoNuevoAsiento} / mes</strong>.</>
                    : <><strong>Usa un asiento incluido</strong> en tu plan {PLANES[workspace.plan].nombre}.</>}
                </div>
              </>
            )}
            {paso === 2 && (
              <div className="flex flex-col gap-1.5">
                {bodasActivas.length === 0 && <p className="text-sm text-[#888]">No tienes bodas activas todavía.</p>}
                {bodasActivas.map(b => {
                  const on = elegidas.has(b.id)
                  return (
                    <label key={b.id} className={'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 ' + (on ? 'border-[#48C9B0] bg-[#f0fdfb]' : 'border-[#e0e0e0] bg-white')}>
                      <input type="checkbox" checked={on} onChange={() => setElegidas(prev => { const n = new Set(prev); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n })} className="accent-[#48C9B0]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[#1D1E20]">{b.name}</span>
                        <span className="block text-[11px] text-[#999]">{b.event_date ?? 'Sin fecha'}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
            {paso === 3 && rol === 'admin' && (
              <p className="rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2.5 text-[13px] text-[#666]">Como administrador entra a todas las bodas con acceso total y puede repartir accesos. No hay permisos que ajustar.</p>
            )}
            {paso === 3 && rol === 'colaborador' && bodaActual && (
              <>
                {elegidas.size > 1 && (
                  <div className="flex flex-wrap gap-1">
                    {[...elegidas].map(id => (
                      <button key={id} type="button" onClick={() => setBodaActual(id)}
                        className={'rounded-full border px-2.5 py-1 text-[11px] font-semibold ' + (bodaActual === id ? 'border-[#1D1E20] bg-[#1D1E20] text-white' : 'border-[#e0e0e0] text-[#666]')}>
                        {workspace.bodas.find(b => b.id === id)?.name}
                      </button>
                    ))}
                  </div>
                )}
                <PermisosEditor
                  permisos={permisosDe(bodaActual)}
                  features={workspace.bodas.find(b => b.id === bodaActual)!.features}
                  onChange={next => setPermisos(prev => ({ ...prev, [bodaActual]: next }))}
                />
              </>
            )}
            {error && <p className="text-xs text-[#cc3333]">{error}</p>}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {token ? (
          <button className={btnCta + ' ml-auto'} onClick={onClose}>Listo</button>
        ) : !permiso.ok ? (
          <button className={btnSec + ' ml-auto'} onClick={onClose}>Cerrar</button>
        ) : (
          <>
            {paso > 1 && <button className={btnSec} onClick={() => setPaso((paso === 3 && rol === 'admin' ? 1 : paso - 1) as Paso)}>Atrás</button>}
            <button className={btnSec} onClick={onClose}>Cancelar</button>
            {paso < 3
              ? <button className={btnCta + ' ml-auto'} onClick={siguiente}>{paso === 1 ? (rol === 'admin' ? 'Siguiente' : 'Siguiente: bodas') : 'Siguiente: permisos'}</button>
              : <button className={btnCta + ' ml-auto'} disabled={guardando} onClick={guardar}>{guardando ? 'Creando…' : 'Crear enlace'}</button>}
          </>
        )}
      </Modal.Footer>
    </Modal>
  )
}
