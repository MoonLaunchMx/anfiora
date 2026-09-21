'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/app/components/ui/Modal'
import PhoneInput from '@/app/components/ui/PhoneInput'
import { Aviso } from '@/app/components/ui/Aviso'
import { supabase } from '@/lib/supabase'
import { PAID_PLAN_IDS, PLANES, normalizarPlan } from '@/lib/workspace/planes'
import { normalizarSello, type Sello } from '@/lib/workspace/sello'
import { esEventoVigente, hoyISO } from '@/lib/workspace/eventos'
import type { DatosSolicitud } from '@/lib/solicitud/mensaje'

interface MuroModalProps {
  open: boolean
  motivo: 'eventos' | 'invitados'
  limite: number
  onClose: () => void
  // El evento que disparo el aviso de invitados: solo con esto se puede
  // contar personas reales (invitados + acompanantes) de ESE evento. Sin
  // eventId no se fabrica un numero, se manda null y el reporte dice
  // "no disponible".
  eventId?: string
}

type Paso = 'aviso' | 'formulario' | 'enviado'
type Contacto = 'WhatsApp' | 'Llamada' | 'Correo'
const CONTACTOS: Contacto[] = ['WhatsApp', 'Llamada', 'Correo']

interface Contexto {
  email: string
  tipoDeCuenta: string
  planActual: string
  sello: Sello
  eventosVigentes: number | null
  personasEnEvento: number | null
}

const inputCls =
  'mt-1 w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none focus:border-[#48C9B0]'

async function cargarContexto(motivo: 'eventos' | 'invitados', eventId: string | undefined): Promise<{
  contexto: Contexto | null
  nombre: string
  telefono: string
}> {
  const vacio = { contexto: null, nombre: '', telefono: '' }
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return vacio

    const { data: perfil } = await supabase
      .from('users')
      .select('full_name, phone, role')
      .eq('id', user.id)
      .maybeSingle()
    const fila = perfil as { full_name?: string | null; phone?: string | null; role?: string | null } | null

    // dueno o admin: los dos administran el workspace y pueden toparse con el
    // muro. Igual que lib/workspace/cliente.ts, nunca solo dueno.
    const { data: mem } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id).eq('status', 'active').in('rol', ['dueno', 'admin'])
      .limit(1)
      .maybeSingle()
    const workspaceId = (mem as { workspace_id?: string } | null)?.workspace_id ?? null

    let planActual = 'free'
    let sello: Sello = null
    if (workspaceId) {
      const conSello = await supabase.from('workspaces').select('plan, sello').eq('id', workspaceId).maybeSingle()
      if (!conSello.error && conSello.data) {
        const ws = conSello.data as { plan?: string; sello?: string }
        planActual = normalizarPlan(ws.plan)
        sello = normalizarSello(ws.sello)
      } else {
        // La columna sello puede no existir todavia en este ambiente: se pide
        // el plan solo, sin dejar que ese hueco tumbe la carga del contexto.
        const soloPlan = await supabase.from('workspaces').select('plan').eq('id', workspaceId).maybeSingle()
        if (!soloPlan.error && soloPlan.data) planActual = normalizarPlan((soloPlan.data as { plan?: string }).plan)
      }
    }

    // Nunca se fabrica: si una lectura falla se queda en null y el reporte
    // dice "no disponible" en vez de inventar un numero.
    let eventosVigentes: number | null = null
    let personasEnEvento: number | null = null
    if (workspaceId) {
      const { data: eventos, error: errEventos } = await supabase
        .from('events')
        .select('id, event_status, event_date')
        .eq('workspace_id', workspaceId)
      if (!errEventos && eventos) {
        const hoy = hoyISO()
        eventosVigentes = (eventos as { id: string; event_status: string | null; event_date: string | null }[])
          .filter(e => esEventoVigente(e, hoy))
          .length
      }
    }
    // Personas = invitados + acompanantes, igual que en el resto de la app
    // (contarPersonas). Solo tiene sentido para el evento que disparo el
    // aviso de invitados: total_guests cuenta filas, no personas, y sumar
    // todos los eventos del workspace no responde "cuantas personas tiene
    // ESE evento".
    if (motivo === 'invitados' && eventId) {
      const [rGuests, rMembers] = await Promise.all([
        supabase.from('guests').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('party_members').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      ])
      if (!rGuests.error && !rMembers.error) {
        personasEnEvento = (rGuests.count ?? 0) + (rMembers.count ?? 0)
      }
    }

    return {
      contexto: {
        email: user.email ?? '',
        tipoDeCuenta: fila?.role || 'planner',
        planActual,
        sello,
        eventosVigentes,
        personasEnEvento,
      },
      nombre: fila?.full_name ?? '',
      telefono: fila?.phone ?? '',
    }
  } catch (e) {
    // El aviso y el formulario tienen que servir aunque el contexto no cargue:
    // se degrada a los defaults, nunca se queda una promesa sin atrapar.
    console.error('[MuroModal] no se pudo cargar el contexto', e)
    return vacio
  }
}

export function MuroModal({ open, motivo, limite, onClose, eventId }: MuroModalProps) {
  const [paso, setPaso] = useState<Paso>('aviso')
  const [contexto, setContexto] = useState<Contexto | null>(null)

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [eventosAlAno, setEventosAlAno] = useState('')
  const [tipoDeEventos, setTipoDeEventos] = useState('')
  const [tamanoDeEquipo, setTamanoDeEquipo] = useState('')
  const [contactoPreferido, setContactoPreferido] = useState<Contacto>('WhatsApp')
  const [ciudad, setCiudad] = useState('')
  const [mensaje, setMensaje] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setPaso('aviso')
    setError('')
    setEnviando(false)
    setEventosAlAno('')
    setTipoDeEventos('')
    setTamanoDeEquipo('')
    setContactoPreferido('WhatsApp')
    setCiudad('')
    setMensaje('')
    setContexto(null)

    let vivo = true
    void cargarContexto(motivo, eventId).then(r => {
      if (!vivo) return
      setContexto(r.contexto)
      setNombre(r.nombre)
      setTelefono(r.telefono)
      setEmail(r.contexto?.email ?? '')
    })
    return () => { vivo = false }
  }, [open, motivo, eventId])

  const lineaTope = motivo === 'eventos'
    ? `Ya tienes ${limite} evento${limite === 1 ? '' : 's'} activo${limite === 1 ? '' : 's'}, el máximo de tu plan.`
    : `Este evento ya llegó a ${limite} invitado${limite === 1 ? '' : 's'}, el máximo de tu plan.`

  const eventosFree = PLANES.free.eventosActivos ?? 0
  const invitadosFree = PLANES.free.invitadosPorEvento ?? 0
  const lineaGeneral = `Con tu cuenta puedes llevar ${eventosFree === 1 ? 'un evento' : `${eventosFree} eventos`} a la vez, con hasta ${invitadosFree} invitados.`

  const enviar = async () => {
    if (enviando || !nombre.trim() || !telefono.trim() || !email.trim()) return
    setEnviando(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      if (!accessToken) { setError('Tu sesión expiró. Vuelve a entrar.'); return }

      const datos: DatosSolicitud = {
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        tipoDeCuenta: contexto?.tipoDeCuenta ?? 'planner',
        planActual: contexto?.planActual ?? 'free',
        sello: contexto?.sello ?? null,
        eventosVigentes: contexto?.eventosVigentes ?? null,
        personasEnEvento: contexto?.personasEnEvento ?? null,
        motivo,
        eventosAlAno: eventosAlAno.trim(),
        tipoDeEventos: tipoDeEventos.trim(),
        tamanoDeEquipo: tamanoDeEquipo.trim(),
        contactoPreferido,
        ciudad: ciudad.trim(),
        mensaje: mensaje.trim(),
      }

      const res = await fetch('/api/solicitud-acceso', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(datos),
      })
      if (!res.ok) { setError('No se pudo enviar. Intenta de nuevo.'); return }
      setPaso('enviado')
    } catch {
      setError('No se pudo enviar. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <Modal.Header title="Llegaste al tope de la cuenta gratis" />
      <Modal.Body>
        {paso === 'aviso' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-[#1D1E20]">{lineaTope}</p>
              <p className="text-sm text-[#666]">{lineaGeneral}</p>
            </div>
            <div className="flex flex-col gap-2">
              {PAID_PLAN_IDS.map(id => {
                const plan = PLANES[id]
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2.5"
                  >
                    <span className="text-sm font-semibold text-[#1D1E20]">{plan.nombre}</span>
                    <span className="text-xs text-[#666]">
                      ${plan.precio.toLocaleString('es-MX')} MXN/mes · {plan.asientosIncluidos} asiento{plan.asientosIncluidos === 1 ? '' : 's'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {paso === 'formulario' && (
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-[#666]">Nombre
              <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus className={inputCls} />
            </label>
            <label className="text-xs font-semibold text-[#666]">Correo
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
            </label>
            <label className="text-xs font-semibold text-[#666]">WhatsApp
              <PhoneInput value={telefono} onChange={setTelefono} className="mt-1" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-[#666]">Eventos al año
                <input value={eventosAlAno} onChange={e => setEventosAlAno(e.target.value)} placeholder="Ej. 12" className={inputCls} />
              </label>
              <label className="text-xs font-semibold text-[#666]">Tamaño de equipo
                <input value={tamanoDeEquipo} onChange={e => setTamanoDeEquipo(e.target.value)} placeholder="Ej. 3" className={inputCls} />
              </label>
            </div>
            <label className="text-xs font-semibold text-[#666]">Tipo de eventos
              <input value={tipoDeEventos} onChange={e => setTipoDeEventos(e.target.value)} placeholder="Bodas, XV, corporativos..." className={inputCls} />
            </label>
            <label className="text-xs font-semibold text-[#666]">Ciudad
              <input value={ciudad} onChange={e => setCiudad(e.target.value)} className={inputCls} />
            </label>
            <div>
              <p className="text-xs font-semibold text-[#666]">Cómo prefieres que te contactemos</p>
              <div className="mt-1 grid grid-cols-3 gap-1.5">
                {CONTACTOS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setContactoPreferido(c)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      contactoPreferido === c
                        ? 'border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]'
                        : 'border-[#e0e0e0] text-[#666] hover:bg-[#f8f8f8]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <label className="text-xs font-semibold text-[#666]">Mensaje
              <textarea
                value={mensaje}
                onChange={e => setMensaje(e.target.value)}
                rows={3}
                placeholder="Cuéntanos qué necesitas..."
                className={`${inputCls} resize-none`}
              />
            </label>
            {error && <p className="text-xs text-[#cc3333]">{error}</p>}
          </div>
        )}

        {paso === 'enviado' && (
          <Aviso tono="exito" mensaje="Listo, te escribimos hoy mismo." />
        )}
      </Modal.Body>
      <Modal.Footer>
        {paso === 'aviso' && (
          <>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#888] transition hover:bg-[#f5f5f5]"
            >
              Ahora no
            </button>
            <button
              type="button"
              onClick={() => setPaso('formulario')}
              className="ml-auto rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-[#08312a] transition hover:bg-[#3db39d]"
            >
              Solicitar acceso
            </button>
          </>
        )}

        {paso === 'formulario' && (
          <>
            <button
              type="button"
              onClick={() => setPaso('aviso')}
              className="rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#888] transition hover:bg-[#f5f5f5]"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={enviar}
              disabled={enviando || !nombre.trim() || !telefono.trim() || !email.trim()}
              className="ml-auto rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-[#08312a] transition hover:bg-[#3db39d] disabled:opacity-50"
            >
              {enviando ? 'Enviando...' : 'Solicitar acceso'}
            </button>
          </>
        )}

        {paso === 'enviado' && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-[#08312a] transition hover:bg-[#3db39d]"
          >
            Listo
          </button>
        )}
      </Modal.Footer>
    </Modal>
  )
}

export default MuroModal
