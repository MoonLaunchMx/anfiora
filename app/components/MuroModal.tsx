'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import PhoneInput from '@/app/components/ui/PhoneInput'
import { supabase } from '@/lib/supabase'
import { sinAcentos } from '@/lib/phone'
import { normalizarPlan } from '@/lib/workspace/planes'
import { normalizarSello, type Sello } from '@/lib/workspace/sello'
import { esEventoVigente, hoyISO } from '@/lib/workspace/eventos'
import { PAISES, CIUDADES_MEXICO, CODIGO_PAIS_DEFAULT, nombrePais } from '@/lib/ubicaciones'
import type { DatosSolicitud } from '@/lib/solicitud/mensaje'

// Cada muro es UNA cosa que la persona acabo de intentar, no un catalogo de
// planes. Este tipo enumera los seis caminos reales del producto (el septimo,
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
  // Solo lo usa events/[id]/page.tsx al armar el reporte que se manda a
  // Telegram (no vive en el texto que ve la persona): cuantas personas
  // traia el archivo que no cupo ninguna. El modal ya no lo muestra.
  personasEnArchivo?: number
}

type Paso = 'formulario' | 'enviado'
type Contacto = 'WhatsApp' | 'Llamada' | 'Correo'
const CONTACTOS: Contacto[] = ['WhatsApp', 'Llamada', 'Correo']

const OPCIONES_TIPO_EVENTO = [
  'Bodas', 'XV años', 'Bautizos', 'Cumpleaños', 'Corporativos', 'Graduaciones', 'Baby shower', 'Otro',
] as const

// Lo que la persona escoge en el formulario: es la informacion mas valiosa de
// la solicitud, la primera que Diego necesita leer. Viene preseleccionada
// segun el caso (Studio si es de equipo, Pro en los demas), pero siempre se
// puede cambiar.
const OPCIONES_PLAN_DESEADO: { id: 'pro' | 'studio'; nombre: string; resuelve: string }[] = [
  { id: 'pro', nombre: 'Pro', resuelve: 'Trabajo solo. Eventos e invitados sin tope.' },
  { id: 'studio', nombre: 'Studio', resuelve: 'Tengo equipo. Todo lo de Pro y mi gente adentro.' },
]

interface CasoConfig {
  // El grupo es lo que ya sabe el backend (DatosSolicitud.motivo) y decide si
  // se cargan personas del evento: no se toca ese contrato, solo se agrupan
  // los seis caminos en los tres baldes de siempre. Tambien decide el plan
  // preseleccionado: Studio si es 'equipo', Pro en los demas.
  grupo: 'eventos' | 'invitados' | 'equipo'
  subtitulo: (ctx: { limite: number }) => string
}

// El titulo es el mismo para los seis casos: lo que cambia es el subtitulo,
// una sola frase con el numero real del plan.
const TITULO_MURO = 'Alcanzaste el límite de tu plan gratuito'

// Unico lugar con el texto de cada muro: agregar un caso nuevo es agregar una
// entrada aqui, no tocar los archivos que abren el modal.
const CASOS: Record<MuroCaso, CasoConfig> = {
  'crear-evento': {
    grupo: 'eventos',
    subtitulo: ({ limite }) =>
      `Tu plan incluye ${limite} evento${limite === 1 ? '' : 's'} activo${limite === 1 ? '' : 's'}: cambia a Pro para crear más.`,
  },
  'reactivar-evento': {
    grupo: 'eventos',
    subtitulo: ({ limite }) =>
      `Tu plan incluye ${limite} evento${limite === 1 ? '' : 's'} activo${limite === 1 ? '' : 's'}: archiva el actual o cambia a Pro.`,
  },
  'mover-fecha': {
    grupo: 'eventos',
    subtitulo: ({ limite }) =>
      `Con esa fecha tendrías ${limite + 1} eventos activos: cambia a Pro para llevar más de ${limite}.`,
  },
  'invitados-tope': {
    grupo: 'invitados',
    subtitulo: ({ limite }) =>
      `Tu plan incluye ${limite} persona${limite === 1 ? '' : 's'} por evento: cambia a Pro para agregar más.`,
  },
  'import-vacio': {
    grupo: 'invitados',
    subtitulo: ({ limite }) =>
      `Tu plan incluye ${limite} persona${limite === 1 ? '' : 's'} por evento y ya las tienes: cambia a Pro para importar más.`,
  },
  'equipo-invitar': {
    grupo: 'equipo',
    subtitulo: () => 'Tu plan es individual: cambia a Studio para invitar a tu equipo.',
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

// text-base + py-2 porque es el alto que ya trae PhoneInput fijo por dentro
// (no se toca ese componente para un solo modal): si aqui se usa un texto
// mas chico el campo de telefono se ve mas grande que sus vecinos. font-normal
// porque varios de estos campos viven DENTRO de un <label> font-semibold: sin
// resetear el peso aqui, el campo (valor Y placeholder, que hereda tipografia
// del propio campo) sale en negritas por herencia de CSS.
const inputCls =
  'mt-1 w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2 text-base font-normal text-[#1D1E20] outline-none focus:border-[#48C9B0]'

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
    // aviso de invitados: total_guests cuenta filas, no personas. Sumar
    // todos los eventos del workspace tampoco responde "cuantas personas
    // tiene ESE evento".
    if (CASOS[caso].grupo === 'invitados' && eventId) {
      const [rGuests, rMembers] = await Promise.all([
        supabase.from('guests').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('party_members').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      ])
      // rGuests.count/rMembers.count vienen null (sin error) cuando Postgrest
      // no pudo calcular el conteo exacto: ahi tambien se queda en null, nunca
      // en 0 — un 0 relleno es lo que hacia decir "0 de 50" un instante
      // despues de "50 de 50".
      if (!rGuests.error && !rMembers.error && rGuests.count !== null && rMembers.count !== null) {
        personasEnEvento = rGuests.count + rMembers.count
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
    // El formulario tiene que servir aunque el contexto no cargue: se
    // degrada a los defaults, nunca se queda una promesa sin atrapar.
    console.error('[MuroModal] no se pudo cargar el contexto', e)
    return vacio
  }
}

// Posicion de un menu flotante: nunca empuja el contenido de abajo, se
// dibuja encima via portal. Ancla al elemento disparador, se voltea hacia
// arriba si no hay espacio abajo. Su alto se recorta al que realmente
// quepa en el lado elegido — igual de criterio que el selector de pais de
// PhoneInput, pero sin el modo "hoja" porque estos campos viven dentro de un
// modal que ya resuelve el viewport de iOS por su cuenta.
const FLOTANTE_GAP = 4
const FLOTANTE_ALTO_MAX = 200
const FLOTANTE_ALTO_MIN = 80

interface LayoutFlotante {
  top: number
  left: number
  width: number
  maxHeight: number
}

function calcularLayoutFlotante(trigger: HTMLElement): LayoutFlotante {
  const rect = trigger.getBoundingClientRect()
  const vh = window.innerHeight
  const espacioAbajo = vh - rect.bottom - FLOTANTE_GAP
  const espacioArriba = rect.top - FLOTANTE_GAP
  const haciaArriba = espacioAbajo < FLOTANTE_ALTO_MIN + 40 && espacioArriba > espacioAbajo
  const disponible = haciaArriba ? espacioArriba : espacioAbajo
  const maxHeight = Math.max(FLOTANTE_ALTO_MIN, Math.min(FLOTANTE_ALTO_MAX, disponible - 8))
  const top = haciaArriba ? Math.max(8, rect.top - FLOTANTE_GAP - maxHeight) : rect.bottom + FLOTANTE_GAP
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))
  return { top, left, width: rect.width, maxHeight }
}

// El campo vive dentro de la columna derecha, que tiene su propio scroll: si
// la persona scrollea esa columna con la lista abierta, el campo puede
// quedar tapado bajo el borde del contenedor mientras la lista sigue
// flotando donde ya no hay nada debajo. `contenedorRef` es esa columna: si
// el campo deja de solaparse con su area visible, `alSalirDeVista` cierra
// la lista en vez de dejarla colgada.
function useLayoutFlotante(
  open: boolean,
  triggerRef: RefObject<HTMLDivElement | null>,
  contenedorRef: RefObject<HTMLDivElement | null>,
  alSalirDeVista: () => void
): LayoutFlotante {
  const [layout, setLayout] = useState<LayoutFlotante>({ top: 0, left: 0, width: 0, maxHeight: FLOTANTE_ALTO_MAX })

  useEffect(() => {
    if (!open) return
    const recalcular = () => {
      const el = triggerRef.current
      if (!el) return
      const contenedor = contenedorRef.current
      if (contenedor) {
        const rectEl = el.getBoundingClientRect()
        const rectContenedor = contenedor.getBoundingClientRect()
        const visible = rectEl.bottom > rectContenedor.top && rectEl.top < rectContenedor.bottom
        if (!visible) {
          alSalirDeVista()
          return
        }
      }
      setLayout(calcularLayoutFlotante(el))
    }
    recalcular()
    // capture:true para enterarse tambien del scroll interno del modal (la
    // columna derecha), que es un ancestro y no dispara scroll en window.
    window.addEventListener('scroll', recalcular, true)
    window.addEventListener('resize', recalcular)
    return () => {
      window.removeEventListener('scroll', recalcular, true)
      window.removeEventListener('resize', recalcular)
    }
  }, [open, triggerRef, contenedorRef, alSalirDeVista])

  return layout
}

// Campo que se despliega, no ocho chips sueltos. La lista flota encima del
// formulario (portal a document.body) en vez de empujarlo: antes crecia en
// linea y cambiaba el alto del modal cada vez que se abria.
function CampoTipoEvento({
  value,
  onChange,
  contenedorRef,
}: {
  value: string[]
  onChange: (next: string[]) => void
  contenedorRef: RefObject<HTMLDivElement | null>
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const cerrar = useCallback(() => setOpen(false), [])
  const layout = useLayoutFlotante(open, triggerRef, contenedorRef, cerrar)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const toggle = (t: string) => onChange(value.includes(t) ? value.filter(x => x !== t) : [...value, t])

  return (
    <div ref={triggerRef} className="flex flex-col gap-1">
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
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ top: layout.top, left: layout.left, width: layout.width }}
          className="fixed z-[350] overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-xl"
        >
          <div className="overflow-y-auto p-1.5" style={{ maxHeight: layout.maxHeight }}>
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
        </div>,
        document.body
      )}
    </div>
  )
}

// Mismo patron que CampoTipoEvento: la lista flota via portal en vez de
// empujar el formulario, con un buscador arriba porque 283 ciudades ya no
// caben en un <select> usable. El filtro es sin acentos (sinAcentos de
// lib/phone.ts, mismo criterio que PhoneInput con paises) para que "leon"
// encuentre "León".
function CampoCiudadMexico({
  value,
  onChange,
  contenedorRef,
}: {
  value: string
  onChange: (next: string) => void
  contenedorRef: RefObject<HTMLDivElement | null>
}) {
  const [open, setOpen] = useState(false)
  const [filtro, setFiltro] = useState('')
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const cerrar = useCallback(() => setOpen(false), [])
  const layout = useLayoutFlotante(open, triggerRef, contenedorRef, cerrar)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const filtroNorm = sinAcentos(filtro.trim())
  const filtradas = filtroNorm
    ? CIUDADES_MEXICO.filter(c => sinAcentos(c.nombre).includes(filtroNorm) || sinAcentos(c.estado).includes(filtroNorm))
    : CIUDADES_MEXICO

  // Mexico tiene miles de municipios y la lista trae 283 (los comunes, no
  // todos): si lo que escribe no es igual (sin acentos) a ninguna de la
  // lista, se ofrece usarlo tal cual. Sin esta salida un pueblo chico deja a
  // la persona sin poder mandar la solicitud, que es obligatoria.
  const hayCoincidenciaExacta = filtroNorm !== '' && CIUDADES_MEXICO.some(c => sinAcentos(c.nombre) === filtroNorm)
  const mostrarUsarTalCual = filtro.trim() !== '' && !hayCoincidenciaExacta

  // El valor guardado es el nombre de la lista o, si se uso la salida, el
  // texto libre tal cual se escribio: con nombres repetidos entre estados
  // (Guadalupe en Nuevo Leon y en Zacatecas) se muestra el primero que
  // calce, misma ambiguedad que ya tenia el <select>.
  const seleccionada = CIUDADES_MEXICO.find(c => c.nombre === value)

  const elegir = (nombre: string) => {
    onChange(nombre)
    setOpen(false)
    setFiltro('')
  }

  return (
    <div ref={triggerRef} className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-[#666]">Ciudad</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`${inputCls} flex w-full items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${value ? 'text-[#1D1E20]' : 'text-[#aaa]'}`}>
          {seleccionada ? `${seleccionada.nombre} (${seleccionada.estado})` : (value || 'Busca tu ciudad')}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-[#999] transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ top: layout.top, left: layout.left, width: layout.width }}
          className="fixed z-[350] overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-xl"
        >
          <div className="border-b border-[#f0f0f0] p-1.5">
            <input
              autoFocus
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              placeholder="Buscar ciudad o estado"
              className="w-full rounded-md border border-[#e0e0e0] px-2.5 py-1.5 text-sm text-[#1D1E20] outline-none focus:border-[#48C9B0]"
            />
          </div>
          <div className="overflow-y-auto p-1.5" style={{ maxHeight: layout.maxHeight }}>
            {filtradas.length === 0 && !mostrarUsarTalCual && (
              <p className="px-2.5 py-2 text-sm text-[#999]">Sin resultados</p>
            )}
            {filtradas.map(c => (
              <button
                key={`${c.nombre}|${c.estado}`}
                type="button"
                onClick={() => elegir(c.nombre)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition ${
                  c.nombre === value ? 'bg-[#f0fdfb] text-[#1a9e88]' : 'text-[#1D1E20] hover:bg-[#f8f8f8]'
                }`}
              >
                <span className="truncate">{c.nombre}</span>
                <span className="shrink-0 text-xs text-[#999]">{c.estado}</span>
              </button>
            ))}
            {mostrarUsarTalCual && (
              <button
                type="button"
                onClick={() => elegir(filtro.trim())}
                className="flex w-full items-center gap-1 rounded-md px-2.5 py-2 text-left text-sm font-medium text-[#1a9e88] transition hover:bg-[#f0fdfb]"
              >
                Usar «{filtro.trim()}»
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export function MuroModal({ open, caso, limite, onClose, eventId }: MuroModalProps) {
  const casoCfg = CASOS[caso]
  const [paso, setPaso] = useState<Paso>('formulario')
  const [contexto, setContexto] = useState<Contexto | null>(null)

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [planDeseado, setPlanDeseado] = useState<'pro' | 'studio'>('pro')
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

  // La columna derecha tiene su propio scroll: los campos flotantes la usan
  // para cerrarse solos si el disparador queda tapado por el borde.
  const columnaDerechaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setPaso('formulario')
    setError('')
    setEnviando(false)
    // Preseleccionado segun el caso (Studio si es de equipo, Pro en los
    // demas), pero se puede cambiar: es una eleccion, no un dato fijo.
    setPlanDeseado(casoCfg.grupo === 'equipo' ? 'studio' : 'pro')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, caso, eventId])

  const subtitulo = casoCfg.subtitulo({ limite })

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

  const faltaTelefono = contactoPreferido !== 'Correo' && !telefono.trim()
  const puedeEnviar = !enviando && !!nombre.trim() && !!email.trim() && !!ciudad.trim() && !!pais
    && tiposDeEventos.length > 0 && !faltaTelefono

  const enviar = async () => {
    if (!puedeEnviar) return
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
        planDeseado,
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
    <Modal open={open} onClose={onClose} size={paso === 'enviado' ? 'md' : 'xl'}>
      {paso === 'formulario' && <Modal.Header title={TITULO_MURO} subtitle={subtitulo} />}
      <Modal.Body className={paso === 'formulario' ? '!overflow-hidden !p-0' : ''}>
        {paso === 'formulario' && (
          <div className="flex h-full min-h-0 flex-col sm:flex-row">
            <div className="flex shrink-0 flex-col gap-5 border-b border-[#eee] bg-[#f8f8f7] px-5 py-5 sm:w-[220px] sm:border-b-0 sm:border-r">
              <div>
                <p className="text-xs font-semibold text-[#666]">¿Qué plan te interesa?</p>
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {OPCIONES_PLAN_DESEADO.map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setPlanDeseado(o.id)}
                      aria-pressed={planDeseado === o.id}
                      className={`rounded-lg border px-3 py-2.5 text-left transition ${
                        planDeseado === o.id
                          ? 'border-[#48C9B0] bg-[#f0fdfb]'
                          : 'border-[#e0e0e0] bg-white hover:bg-[#f5f5f5]'
                      }`}
                    >
                      <span className={`block text-sm font-semibold ${planDeseado === o.id ? 'text-[#1a9e88]' : 'text-[#1D1E20]'}`}>
                        {o.nombre}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-[#666]">{o.resuelve}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="mt-auto text-[11px] leading-snug text-[#999]">Te escribimos el mismo día para activarlo.</p>
            </div>

            <div ref={columnaDerechaRef} className="anf-barra-fina min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <div className="flex flex-col gap-3">
                <label className="text-xs font-semibold text-[#666]">Nombre o empresa
                  <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus className={inputCls} />
                </label>

                <CampoTipoEvento value={tiposDeEventos} onChange={setTiposDeEventos} contenedorRef={columnaDerechaRef} />

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-[#666]">País
                    <select value={pais} onChange={e => { setPais(e.target.value); setCiudad('') }} className={inputCls}>
                      {PAISES.map(p => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
                    </select>
                  </label>
                  {pais === CODIGO_PAIS_DEFAULT ? (
                    <CampoCiudadMexico value={ciudad} onChange={setCiudad} contenedorRef={columnaDerechaRef} />
                  ) : (
                    <label className="text-xs font-semibold text-[#666]">Ciudad
                      <input value={ciudad} onChange={e => setCiudad(e.target.value)} className={inputCls} />
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-[#666]">Te contactamos por
                    <select value={contactoPreferido} onChange={e => setContactoPreferido(e.target.value as Contacto)} className={inputCls}>
                      {CONTACTOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  {contactoPreferido === 'Correo' ? (
                    <label className="text-xs font-semibold text-[#666]">Correo
                      <input value={email} disabled className={`${inputCls} cursor-not-allowed bg-[#f5f5f5] text-[#888]`} />
                    </label>
                  ) : (
                    <label className="text-xs font-semibold text-[#666]">Teléfono
                      <PhoneInput value={telefono} onChange={setTelefono} placeholder="81 1234 5678" className="mt-1 font-normal" />
                    </label>
                  )}
                </div>

                <label className="text-xs font-semibold text-[#666]">Eventos al año
                  <input value={eventosAlAno} onChange={e => setEventosAlAno(e.target.value)} placeholder="Ej. 12" className={inputCls} />
                </label>

                <label className="text-xs font-semibold text-[#666]">Tamaño de tu equipo
                  <input value={tamanoDeEquipo} onChange={e => setTamanoDeEquipo(e.target.value)} placeholder="Ej. 3" className={inputCls} />
                </label>

                <label className="text-xs font-semibold text-[#666]">Algo que quieras contarnos
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
            </div>
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
        {paso === 'formulario' && (
          <>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-[#888] transition hover:text-[#1D1E20]"
            >
              Ahora no
            </button>
            <button
              type="button"
              onClick={enviar}
              disabled={!puedeEnviar}
              className="ml-auto rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-[#08312a] transition hover:bg-[#3db39d] disabled:opacity-50"
            >
              {enviando ? 'Enviando...' : 'Enviar solicitud'}
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
