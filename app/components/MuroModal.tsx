'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import PhoneInput from '@/app/components/ui/PhoneInput'
import { supabase } from '@/lib/supabase'
import { PLANES, normalizarPlan } from '@/lib/workspace/planes'
import { normalizarSello, type Sello } from '@/lib/workspace/sello'
import { esEventoVigente, hoyISO } from '@/lib/workspace/eventos'
import { PAISES, CIUDADES_MEXICO, CODIGO_PAIS_DEFAULT, nombrePais } from '@/lib/ubicaciones'
import type { DatosSolicitud } from '@/lib/solicitud/mensaje'

// Cada muro es UNA cosa que la persona acabo de intentar, no un catalogo de
// planes. Este tipo enumera los ocho caminos reales del producto (el noveno,
// el estado vacio de Equipo, no es un modal: solo reusa este mismo formulario
// via AltaPersonaModal -> caso "equipo-invitar").
export type MuroCaso =
  | 'crear-evento'
  | 'reactivar-evento'
  | 'mover-fecha'
  | 'invitados-tope'
  | 'import-vacio'
  | 'equipo-invitar'

interface MuroModalProps {
  open: boolean
  caso: MuroCaso
  limite: number
  onClose: () => void
  // El evento que disparo el aviso de invitados: solo con esto se puede
  // contar personas reales (invitados + acompanantes) de ESE evento. Sin
  // eventId no se fabrica un numero, se manda null y el reporte dice
  // "no disponible".
  eventId?: string
  // Solo para "import-vacio": cuantas personas traia el archivo que no cupo
  // ninguna. El resto de los casos no lo usa.
  personasEnArchivo?: number
}

type Paso = 'aviso' | 'formulario' | 'enviado'
type Contacto = 'WhatsApp' | 'Llamada' | 'Correo'
const CONTACTOS: Contacto[] = ['WhatsApp', 'Llamada', 'Correo']

const OPCIONES_TIPO_EVENTO = [
  'Bodas', 'XV años', 'Bautizos', 'Cumpleaños', 'Corporativos', 'Graduaciones', 'Baby shower', 'Otro',
] as const

interface CasoConfig {
  // El grupo es lo que ya sabe el backend (DatosSolicitud.motivo) y decide si
  // se cargan personas del evento: no se toca ese contrato, solo se agrupan
  // los ocho caminos en los tres baldes de siempre.
  grupo: 'eventos' | 'invitados' | 'equipo'
  titulo: (ctx: { limite: number; personasEnArchivo?: number }) => string
  subtitulo: (ctx: { limite: number }) => string
  // Un solo plan por muro: el que desbloquea justo lo que se intento hacer.
  // Agency nunca aparece aqui, solo en el catalogo de planes.
  plan: { id: 'pro' | 'studio'; descripcion: string }
  // Linea tenue debajo del plan. null = ninguna.
  notaTenue: string | null
  botonSecundario: string
  mostrarBarra: boolean
}

// Unico lugar con el texto de cada muro: agregar un caso nuevo es agregar una
// entrada aqui, no tocar los archivos que abren el modal.
const CASOS: Record<MuroCaso, CasoConfig> = {
  'crear-evento': {
    grupo: 'eventos',
    titulo: () => 'Necesitas un plan para llevar otro evento',
    subtitulo: () => 'Tu cuenta gratis lleva un evento a la vez. El tuyo sigue intacto.',
    plan: { id: 'pro', descripcion: 'Todos los eventos que quieras, sin tope de invitados.' },
    notaTenue: 'Pides acceso y te escribimos para activarlo.',
    botonSecundario: 'Ahora no',
    mostrarBarra: false,
  },
  'reactivar-evento': {
    grupo: 'eventos',
    titulo: () => 'Para reactivarlo necesitas un plan',
    subtitulo: () => 'Tu cuenta gratis lleva un evento a la vez, y ya tienes uno activo.',
    plan: { id: 'pro', descripcion: 'Todos los eventos que quieras, sin tope de invitados.' },
    notaTenue: 'También puedes archivar el otro y reactivar este.',
    botonSecundario: 'Ahora no',
    mostrarBarra: false,
  },
  'mover-fecha': {
    grupo: 'eventos',
    titulo: () => 'Con esa fecha vuelve a contar como activo',
    subtitulo: () => 'Y tu cuenta gratis lleva un evento a la vez. No guardamos el cambio.',
    plan: { id: 'pro', descripcion: 'Todos los eventos que quieras, sin tope de invitados.' },
    notaTenue: 'Pides acceso y te escribimos para activarlo.',
    botonSecundario: 'Ahora no',
    mostrarBarra: false,
  },
  'invitados-tope': {
    grupo: 'invitados',
    titulo: ({ limite }) => `Tu lista llegó a ${limite} persona${limite === 1 ? '' : 's'}`,
    subtitulo: () => 'Es el tope de la cuenta gratis. Nadie de los que ya tienes se pierde.',
    plan: { id: 'pro', descripcion: 'Invitados sin tope, en todos tus eventos.' },
    notaTenue: 'Pides acceso y te escribimos para activarlo.',
    botonSecundario: 'Ahora no',
    mostrarBarra: true,
  },
  'import-vacio': {
    grupo: 'invitados',
    titulo: ({ personasEnArchivo }) => `Ninguno de estos ${personasEnArchivo ?? 0} cabe todavía`,
    subtitulo: ({ limite }) => `Tu lista ya está en su tope de ${limite} personas.`,
    plan: { id: 'pro', descripcion: 'Invitados sin tope, en todos tus eventos.' },
    notaTenue: null,
    botonSecundario: 'Cancelar',
    mostrarBarra: true,
  },
  'equipo-invitar': {
    grupo: 'equipo',
    titulo: () => 'Necesitas Studio para trabajar en equipo',
    subtitulo: () => 'Tu cuenta gratis es de una persona.',
    plan: { id: 'studio', descripcion: 'Tu equipo adentro, con permisos por persona, y eventos e invitados sin tope.' },
    notaTenue: 'A tus clientes sí puedes invitarlos, desde cada evento.',
    botonSecundario: 'Ahora no',
    mostrarBarra: false,
  },
}

interface Contexto {
  email: string
  tipoDeCuenta: string
  planActual: string
  sello: Sello
  eventosVigentes: number | null
  personasEnEvento: number | null
}

interface Resultado {
  folio: string
  enviadoEn: string
}

const inputCls =
  'mt-1 w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none focus:border-[#48C9B0]'

async function cargarContexto(caso: MuroCaso, eventId: string | undefined): Promise<{
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
    if (CASOS[caso].grupo === 'invitados' && eventId) {
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

// Campo que se despliega, no ocho chips sueltos: en un modal chico los chips
// se veian de golpe y descuadraban el formulario. Vive dentro del flujo
// normal (nada de portal ni posicion absoluta) para que nunca se salga de la
// pantalla, y el boton "Listo" queda a la altura de la lista para cerrarse
// con el pulgar en movil.
function CampoTipoEvento({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const toggle = (t: string) => onChange(value.includes(t) ? value.filter(x => x !== t) : [...value, t])

  return (
    <div ref={ref} className="relative flex flex-col gap-1">
      <label className="text-xs font-semibold text-[#666]">Qué eventos organizas</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`${inputCls} flex w-full items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${value.length ? 'text-[#1D1E20]' : 'text-[#aaa]'}`}>
          {value.length ? value.join(', ') : 'Elige uno o más'}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-[#999] transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-lg">
          <div className="max-h-40 overflow-y-auto p-1.5">
            {OPCIONES_TIPO_EVENTO.map(t => (
              <label key={t} className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[#1D1E20] transition hover:bg-[#f8f8f8]">
                <input type="checkbox" checked={value.includes(t)} onChange={() => toggle(t)} className="h-4 w-4 shrink-0 accent-[#48C9B0]" />
                {t}
              </label>
            ))}
          </div>
          <div className="border-t border-[#f0f0f0] p-1.5">
            <button type="button" onClick={() => setOpen(false)} className="w-full rounded-md py-1.5 text-xs font-semibold text-[#1a9e88] transition hover:bg-[#f0fdfb]">
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function MuroModal({ open, caso, limite, onClose, eventId, personasEnArchivo }: MuroModalProps) {
  const casoCfg = CASOS[caso]
  const [paso, setPaso] = useState<Paso>('aviso')
  const [contexto, setContexto] = useState<Contexto | null>(null)

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [eventosAlAno, setEventosAlAno] = useState('')
  const [tiposDeEventos, setTiposDeEventos] = useState<string[]>([])
  const [tamanoDeEquipo, setTamanoDeEquipo] = useState('')
  const [contactoPreferido, setContactoPreferido] = useState<Contacto>('WhatsApp')
  const [pais, setPais] = useState(CODIGO_PAIS_DEFAULT)
  const [ciudad, setCiudad] = useState('')
  const [mensaje, setMensaje] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)

  useEffect(() => {
    if (!open) return
    setPaso('aviso')
    setError('')
    setEnviando(false)
    setEventosAlAno('')
    setTiposDeEventos([])
    setTamanoDeEquipo('')
    setContactoPreferido('WhatsApp')
    setPais(CODIGO_PAIS_DEFAULT)
    setCiudad('')
    setMensaje('')
    setContexto(null)
    setResultado(null)

    let vivo = true
    void cargarContexto(caso, eventId).then(r => {
      if (!vivo) return
      setContexto(r.contexto)
      setNombre(r.nombre)
      setTelefono(r.telefono)
      setEmail(r.contexto?.email ?? '')
    })
    return () => { vivo = false }
  }, [open, caso, eventId])

  const tituloAviso = casoCfg.titulo({ limite, personasEnArchivo })
  const subtituloAviso = casoCfg.subtitulo({ limite })

  const personasParaBarra = Math.min(contexto?.personasEnEvento ?? limite, limite)
  const pctBarra = limite > 0 ? Math.min(100, (personasParaBarra / limite) * 100) : 100

  const medioContacto = contactoPreferido === 'Correo'
    ? `por correo a ${email}`
    : contactoPreferido === 'Llamada'
    ? `por teléfono al ${telefono}`
    : `por WhatsApp al ${telefono}`

  const pasosSolicitud = [
    'Revisamos tu caso hoy mismo.',
    `Te escribimos ${medioContacto}.`,
    'Activamos tu plan y sigues donde te quedaste.',
  ]

  const avisoFinal = casoCfg.grupo === 'invitados'
    ? `Mientras tanto tu evento y tus ${limite} invitados siguen ahí. No se pierde nada.`
    : 'Mientras tanto tu evento sigue ahí. No se pierde nada.'

  const enviar = async () => {
    if (enviando || !nombre.trim() || !telefono.trim() || !email.trim() || tiposDeEventos.length === 0) return
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
        motivo: casoCfg.grupo,
        eventosAlAno: eventosAlAno.trim(),
        tipoDeEventos: tiposDeEventos.join(', '),
        tamanoDeEquipo: tamanoDeEquipo.trim(),
        contactoPreferido,
        pais: nombrePais(pais),
        ciudad: ciudad.trim(),
        mensaje: mensaje.trim(),
      }

      const res = await fetch('/api/solicitud-acceso', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(datos),
      })
      if (!res.ok) { setError('No se pudo enviar. Intenta de nuevo.'); return }
      const data = await res.json().catch(() => null) as { folio?: string; enviadoEn?: string } | null
      setResultado({
        folio: data?.folio ?? '',
        enviadoEn: data?.enviadoEn ?? new Date().toISOString(),
      })
      setPaso('enviado')
    } catch {
      setError('No se pudo enviar. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      {paso !== 'enviado' && <Modal.Header title={tituloAviso} />}
      <Modal.Body>
        {paso === 'aviso' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[#666]">{subtituloAviso}</p>

            {casoCfg.mostrarBarra && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-[#1D1E20]">{personasParaBarra}</span>
                  <span className="text-sm text-[#888]">de {limite} personas</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#f0f0f0]">
                  <div className="h-full rounded-full bg-[#b98d2e]" style={{ width: `${pctBarra}%` }} />
                </div>
              </div>
            )}

            <div className="rounded-lg border border-[#48C9B0] bg-[#f0fdfb] px-3 py-2.5">
              <span className="text-sm font-semibold text-[#1D1E20]">{PLANES[casoCfg.plan.id].nombre}</span>
              <p className="mt-0.5 text-xs text-[#666]">{casoCfg.plan.descripcion}</p>
            </div>

            {casoCfg.notaTenue && (
              <p className="text-[11px] leading-snug text-[#999]">{casoCfg.notaTenue}</p>
            )}
          </div>
        )}

        {paso === 'formulario' && (
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-[#666]">Nombre
              <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus className={inputCls} />
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
            <CampoTipoEvento value={tiposDeEventos} onChange={setTiposDeEventos} />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-[#666]">País
                <select value={pais} onChange={e => { setPais(e.target.value); setCiudad('') }} className={inputCls}>
                  {PAISES.map(p => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-[#666]">Ciudad
                {pais === CODIGO_PAIS_DEFAULT ? (
                  <select value={ciudad} onChange={e => setCiudad(e.target.value)} className={inputCls}>
                    <option value="">Selecciona...</option>
                    {CIUDADES_MEXICO.map(c => (
                      <option key={c.nombre} value={c.nombre}>{c.nombre} ({c.estado})</option>
                    ))}
                  </select>
                ) : (
                  <input value={ciudad} onChange={e => setCiudad(e.target.value)} className={inputCls} />
                )}
              </label>
            </div>
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

        {paso === 'enviado' && resultado && (
          <div className="flex flex-col items-center gap-5 px-1 py-3 text-center">
            <img src="/images/isotipoylogo.svg" alt="Anfiora" className="h-9 w-auto" />
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold text-[#1D1E20]">Recibimos tu solicitud</h3>
            </div>
            <div className="flex w-full flex-col gap-3 text-left">
              {pasosSolicitud.map((texto, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f0fdfb] text-[11px] font-bold text-[#1a9e88]">
                    {i + 1}
                  </span>
                  <p className="text-sm text-[#1D1E20]">{texto}</p>
                </div>
              ))}
            </div>
            <div className="w-full rounded-lg border border-[#eeddb0] bg-[#fdf8ec] p-3 text-left text-xs leading-snug text-[#8a6a1f]">
              {avisoFinal}
            </div>
          </div>
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
              {casoCfg.botonSecundario}
            </button>
            <button
              type="button"
              onClick={() => setPaso('formulario')}
              className="ml-auto rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-[#08312a] transition hover:bg-[#3db39d]"
            >
              Pedir acceso
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
              disabled={enviando || !nombre.trim() || !telefono.trim() || !email.trim() || tiposDeEventos.length === 0}
              className="ml-auto rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-[#08312a] transition hover:bg-[#3db39d] disabled:opacity-50"
            >
              {enviando ? 'Enviando...' : 'Pedir acceso'}
            </button>
          </>
        )}

        {paso === 'enviado' && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-[#08312a] transition hover:bg-[#3db39d]"
          >
            Volver a mi evento
          </button>
        )}
      </Modal.Footer>
    </Modal>
  )
}

export default MuroModal
