'use client'
import { useEffect, useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { Modal } from '@/app/components/ui/Modal'
import { PermisosEditor } from '@/app/events/[id]/configuracion/PermisosEditor'
import type { PermisosEvento } from '@/lib/permisos/catalogo'
import { aplicarKit, permisosDeRol } from '@/lib/permisos/resolver'
import { contarAsientos, puedeInvitar } from '@/lib/workspace/asientos'
import { enlaceWhatsApp, mensajeEquipo } from '@/lib/workspace/compartir'
import { eventoTerminado, eventosParaRepartir, hoyISO } from '@/lib/workspace/eventos'
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

  // Lo que ese correo YA tiene vivo en este workspace, venga de un miembro o de
  // una invitacion suelta de antes. Sin esto el alta ofrece una lista en blanco
  // y al aceptar se le suman accesos que nunca viste: elegias dos y entraban
  // cuatro.
  const yaTiene = useMemo(() => {
    const correo = email.trim().toLowerCase()
    if (!correo) return new Map<string, string>()
    const mapa = new Map<string, string>()
    const miembro = workspace.miembros.find(m => m.email.toLowerCase() === correo)
    for (const b of miembro?.bodas ?? []) {
      if (b.status !== 'revoked') mapa.set(b.eventId, b.status)
    }
    for (const a of workspace.accesosSueltos ?? []) {
      if (a.email.toLowerCase() === correo && a.status !== 'revoked') mapa.set(a.eventId, a.status)
    }
    return mapa
  }, [workspace.miembros, workspace.accesosSueltos, email])

  // Ofrecer y revelar son dos trabajos distintos. Se OFRECE solo lo vigente; se
  // REVELA todo lo que ya tiene, incluso si ya paso de fecha, porque lo que no
  // se ve no se puede quitar. Lo terminado no entra en ninguna de las dos.
  const vivos = workspace.bodas.filter(b => !eventoTerminado(b.event_status))
  const conAcceso = vivos.filter(b => yaTiene.has(b.id))
  const paraAgregar = eventosParaRepartir(vivos, hoyISO()).filter(b => !yaTiene.has(b.id))
  const bodasActivas = [...conAcceso, ...paraAgregar]
  const todasElegidas = bodasActivas.length > 0 && bodasActivas.every(b => elegidas.has(b.id))

  // Lo que ya tiene nace palomeado: el total de abajo tiene que cuadrar con lo
  // que va a recibir. Despalomear ahi es quitarle ese acceso.
  useEffect(() => {
    if (yaTiene.size === 0) return
    setElegidas(prev => {
      const n = new Set(prev)
      for (const id of yaTiene.keys()) n.add(id)
      return n
    })
  }, [yaTiene])

  // Kit: lo que ese correo ya tiene en otros eventos; si nada, "Puede editar".
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
      if (elegidas.size === 0) { setError('Elige al menos un evento'); return }
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

  // Los pasos se dicen en el subtitulo, con el resto del texto: la tira de
  // migajas a 11 px no se leia y ademas competia con el contenido.
  const totalPasos = rol === 'admin' ? 2 : 3
  const pasoActual = rol === 'admin' && paso === 3 ? 2 : paso
  const queHacer: Record<Paso, string> = {
    1: 'quién entra y con qué rol',
    2: 'a qué eventos entra',
    3: 'qué puede hacer en cada evento',
  }
  const subtituloPaso = `Paso ${pasoActual} de ${totalPasos} · ${queHacer[paso]}`

  const btnBase = 'rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60'
  const btnCta = btnBase + ' bg-[#48C9B0] text-[#08312a]'
  const btnSec = 'rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#888] transition hover:bg-[#f5f5f5]'

  return (
    <Modal open={open} onClose={onClose} size={paso === 3 && rol === 'colaborador' && elegidas.size > 1 ? '2xl' : 'lg'}>
      <Modal.Header
        title={token ? 'Invitación lista' : 'Agregar persona al workspace'}
        subtitle={token ? 'Copia el enlace y mándaselo. Al entrar ya tiene sus eventos y sus permisos.' : subtituloPaso}
      />
      <Modal.Body>
        {token ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs text-[#666]">{link}</span>
              <button onClick={copiar} className="flex shrink-0 items-center gap-1 rounded-md border border-[#e0e0e0] bg-white px-2 py-1 text-xs font-semibold text-[#1D1E20]">
                {copiado ? <Check size={12} className="text-[#48C9B0]" /> : <Copy size={12} />} {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            {/* wa.me sin numero: abre WhatsApp con el mensaje escrito y el
                planner escoge el contacto. No hace falta guardar telefonos. */}
            <a
              href={enlaceWhatsApp(mensajeEquipo(workspace.name, link))}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1eb855]"
            >
              <FaWhatsapp size={16} /> Enviar por WhatsApp
            </a>
          </div>
        ) : !permiso.ok ? (
          <div className="rounded-xl border border-[#f0dfae] bg-[#fffbf0] px-4 py-3 text-sm text-[#7a5a14]">
            <p className="font-semibold">Para trabajar en equipo necesitas Pro.</p>
            {/* Mientras no haya cobro, Pro se activa a mano. El aviso tiene que
                decir A DONDE escribir, no solo "escribenos". */}
            <p className="mt-1 text-[13px]">
              Tu plan {PLANES[workspace.plan].nombre} es solo para ti. Escríbenos a{' '}
              <a href="mailto:partners@anfiora.com" className="font-semibold underline underline-offset-2">partners@anfiora.com</a>
              {' '}y te lo activamos sin costo.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {paso === 1 && (
              <>
                <label className="text-xs font-semibold text-[#666]">Correo
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@correo.com" autoFocus
                    className="mt-1 w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none focus:border-[#48C9B0]" />
                </label>
                <div>
                  <p className="text-xs font-semibold text-[#666]">Rol en el workspace</p>
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    {([['colaborador', 'Colaborador', 'Solo entra a los eventos que le des'], ['admin', 'Administrador', 'Entra a todos y reparte accesos']] as const).map(([v, l, d]) => (
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
                {bodasActivas.length === 0 && <p className="text-sm text-[#888]">No tienes eventos activos todavía.</p>}
                {bodasActivas.length > 1 && (
                  <div className="flex items-center justify-between pb-0.5">
                    <span className="text-[11px] text-[#999]">
                      {elegidas.size} de {bodasActivas.length} {bodasActivas.length === 1 ? 'evento' : 'eventos'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setElegidas(todasElegidas ? new Set() : new Set(bodasActivas.map(b => b.id)))}
                      className="text-[12px] font-semibold text-[#1a9e88] transition hover:text-[#48C9B0]"
                    >
                      {todasElegidas ? 'Quitar todos' : 'Seleccionar todos'}
                    </button>
                  </div>
                )}
                {[
                  { titulo: `Ya tiene acceso · ${conAcceso.length}`, lista: conAcceso, yaEra: true },
                  { titulo: 'Agregar a', lista: paraAgregar, yaEra: false },
                ].map(({ titulo, lista, yaEra }) => lista.length === 0 ? null : (
                  <div key={titulo} className="flex flex-col gap-1.5">
                    {conAcceso.length > 0 && (
                      <p className="pt-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#b9b8b2]">{titulo}</p>
                    )}
                    {lista.map(b => {
                      const on = elegidas.has(b.id)
                      const paso = b.event_date ? b.event_date < hoyISO() : false
                      return (
                        <label key={b.id} className={'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 ' + (on ? 'border-[#48C9B0] bg-[#f0fdfb]' : 'border-[#e0e0e0] bg-white')}>
                          <input type="checkbox" checked={on} onChange={() => setElegidas(prev => { const n = new Set(prev); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n })} className="accent-[#48C9B0]" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-[#1D1E20]">{b.name}</span>
                            <span className="block text-[11px] text-[#999]">
                              {b.event_date ?? 'Sin fecha'}{paso && ' · ya pasó'}
                            </span>
                          </span>
                          {yaEra && (
                            <span className="shrink-0 rounded-full border border-[#f0dfae] bg-[#fffbf0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[#8a6a1f]">
                              {yaTiene.get(b.id) === 'pending' ? 'Invitado' : 'Dentro'}
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                ))}

                {conAcceso.length > 0 && (
                  <p className="mt-1 rounded-lg border border-[#f0dfae] bg-[#fffbf0] px-3 py-2 text-[12px] leading-snug text-[#7a5a14]">
                    Ese correo ya tenía acceso a {conAcceso.length} {conAcceso.length === 1 ? 'evento' : 'eventos'}. Vienen palomeados. Si despalomeas uno, se lo quitas.
                  </p>
                )}
              </div>
            )}
            {paso === 3 && rol === 'admin' && (
              <p className="rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2.5 text-[13px] text-[#666]">Como administrador entra a todos los eventos con acceso total y puede repartir accesos. No hay permisos que ajustar.</p>
            )}
            {paso === 3 && rol === 'colaborador' && bodaActual && (
              <>
                {elegidas.size > 1 ? (
                  // Lista vertical a la izquierda y permisos a la derecha. Las
                  // pestañas servian para tres o cuatro; aqui el numero lo pone
                  // el planner y puede ser veinte. El scroll de arriba abajo si
                  // lo sabe usar cualquiera, el de lado no.
                  <div className="grid gap-0 sm:grid-cols-[minmax(0,230px)_minmax(0,1fr)] sm:gap-6">
                    <div className="anf-barra-fina flex max-h-[200px] flex-col gap-1 overflow-y-auto border-b border-[#f0eeea] pb-3 sm:max-h-[360px] sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
                      {[...elegidas].map(id => {
                        const boda = workspace.bodas.find(b => b.id === id)
                        if (!boda) return null
                        const abierta = bodaActual === id
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setBodaActual(id)}
                            className={'flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition ' + (abierta ? 'border-[#48C9B0] bg-[#f0fdfb]' : 'border-transparent hover:bg-[#f8f8f6]')}
                          >
                            <span className={'truncate text-sm font-semibold ' + (abierta ? 'text-[#0a5c4e]' : 'text-[#1D1E20]')}>{boda.name}</span>
                            <span className="truncate text-xs text-[#999]">{boda.event_date ?? 'Sin fecha'}</span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="min-w-0 pt-3 sm:pt-0">
                      <PermisosEditor
                        permisos={permisosDe(bodaActual)}
                        features={workspace.bodas.find(b => b.id === bodaActual)!.features}
                        onChange={next => setPermisos(prev => ({ ...prev, [bodaActual]: next }))}
                      />
                    </div>
                  </div>
                ) : (
                  <PermisosEditor
                    permisos={permisosDe(bodaActual)}
                    features={workspace.bodas.find(b => b.id === bodaActual)!.features}
                    onChange={next => setPermisos(prev => ({ ...prev, [bodaActual]: next }))}
                  />
                )}
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
              ? <button className={btnCta + ' ml-auto'} onClick={siguiente}>Continuar</button>
              : <button className={btnCta + ' ml-auto'} disabled={guardando} onClick={guardar}>{guardando ? 'Creando' : 'Crear enlace'}</button>}
          </>
        )}
      </Modal.Footer>
    </Modal>
  )
}
