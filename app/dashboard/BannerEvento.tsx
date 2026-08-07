'use client'

import { useEffect, useState } from 'react'
import { Calendar, ChevronDown, CircleAlert, CircleCheck, ExternalLink, MapPin, PencilLine } from 'lucide-react'
import { formatCurrency, formatEventDate } from '@/lib/types'
import { slugifyEvent } from '@/lib/invite'
import { ACCESS_MODES, resolveAccessMode } from '@/lib/features'
import { CIFRAS, type CifraId } from '@/lib/dashboard/tablero'
import type { EventMetrics } from '@/lib/dashboard/types'

const ESTADO_LABEL: Record<string, string> = {
  active: 'Activo', paused: 'Pausado', cancelled: 'Cancelado', completed: 'Completado',
}

const INVITACION_CHIP: Record<string, { color: string; texto: string; Icono: React.ElementType }> = {
  publicada: { color: 'text-[#1A9E88]', texto: 'Invitación publicada',   Icono: CircleCheck },
  cambios:   { color: 'text-[#B8860B]', texto: 'Cambios sin publicar',   Icono: CircleAlert },
  borrador:  { color: 'text-[#999]',    texto: 'Invitación en borrador', Icono: PencilLine },
}

const T_LABEL = 'text-[12px] font-semibold uppercase tracking-[0.07em] text-[#999]'
const BTN_SEC = 'rounded-[10px] border border-[#E0E0E0] bg-[#F8F8F8] px-3.5 py-2 text-[13px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]'

const TITULO_CIFRA = new Map(CIFRAS.map(c => [c.id, c.titulo]))

function getEventDateTime(event: { event_date: string | null; event_time: string | null }): Date {
  if (!event.event_date) return new Date()
  const [year, month, day] = event.event_date.split('T')[0].split('-').map(Number)
  const base = new Date(year, month - 1, day)
  if (event.event_time) {
    const [h, m] = event.event_time.split(':').map(Number)
    base.setHours(h, m, 0, 0)
  } else {
    base.setHours(0, 0, 0, 0)
  }
  return base
}

function formatTime(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return h12 + ':' + m.toString().padStart(2, '0') + ' ' + ampm
}

// Las cuatro celdas del countdown. `null` significa que el evento ya llego.
function partesCuentaRegresiva(
  event: { event_date: string | null; event_time: string | null },
  now: Date,
): { valor: string; unidad: string }[] | null {
  const diff = getEventDateTime(event).getTime() - now.getTime()
  if (diff <= 0) return null

  const dosDigitos = (n: number) => String(n).padStart(2, '0')

  return [
    { valor: String(Math.floor(diff / 86400000)), unidad: 'días' },
    { valor: dosDigitos(Math.floor(diff / 3600000) % 24), unidad: 'hrs' },
    { valor: dosDigitos(Math.floor(diff / 60000) % 60), unidad: 'min' },
    { valor: dosDigitos(Math.floor(diff / 1000) % 60), unidad: 'seg' },
  ]
}

// Late cada segundo, asi que vive aparte: si el intervalo estuviera en el
// banner, la tarjeta entera se redibujaria una vez por segundo.
export function CuentaRegresiva({ event, compacto = false }: {
  event: { event_date: string | null; event_time: string | null }
  compacto?: boolean
}) {
  const [now, setNow] = useState<Date | null>(null)

  // Arranca en null y se llena ya montado: la hora del servidor y la del
  // navegador no coinciden, y pintarla en el primer render desalinea el HTML.
  // El primer valor va aqui a proposito; esperar al primer tic dejaria el
  // countdown en blanco un segundo. Mismo patron que el primitivo Modal.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return <div className={compacto ? 'h-5' : 'h-[58px] sm:h-[66px]'} />

  const partes = partesCuentaRegresiva(event, now)

  if (!partes) {
    return compacto ? (
      <span className="shrink-0 font-display text-[14px] font-extrabold text-[#1A9E88]">Es hoy</span>
    ) : (
      <div className="shrink-0 rounded-xl border border-[#48C9B0] bg-[#F0FDFB] px-4 py-2.5">
        <b className="font-display text-[20px] font-extrabold leading-none text-[#1A9E88] sm:text-[24px]">Es hoy</b>
      </div>
    )
  }

  // En la barra pegada no caben cuatro celdas: se lee corrido, con el
  // segundero puesto, que es lo que le da la sensacion de urgencia.
  if (compacto) {
    const [d, h, mi, s] = partes
    return (
      <span className="shrink-0 font-display text-[14px] font-extrabold tabular-nums tracking-[-0.01em] text-[#1A9E88]">
        {d.valor}d {h.valor}:{mi.valor}:{s.valor}
      </span>
    )
  }

  return (
    <div className="flex shrink-0 items-stretch gap-1.5" aria-label="Tiempo que falta para el evento">
      {partes.map(p => (
        <div key={p.unidad} className="min-w-[50px] rounded-xl border border-[#E8E8E8] bg-white/70 px-2 py-2 text-center sm:min-w-[58px]">
          <b className="block font-display text-[19px] font-extrabold leading-none tabular-nums tracking-[-0.02em] text-[#1A9E88] sm:text-[23px]">
            {p.valor}
          </b>
          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-[#999]">
            {p.unidad}
          </span>
        </div>
      ))}
    </div>
  )
}

// Promedio simple de las cuatro dimensiones que el planner ya mueve a mano.
// Deliberadamente sin pesos: cualquier ponderacion seria inventada.
function pctOrganizacion(m: EventMetrics): number {
  const cabezas = m.mesas.conLugar + m.mesas.sinLugar
  const acomodado = cabezas > 0 ? (m.mesas.conLugar / cabezas) * 100 : 0
  const totalTareas = m.tareas.vencidas + m.tareas.hoy + m.tareas.proximas
  const alDia = totalTareas > 0 ? ((totalTareas - m.tareas.vencidas) / totalTareas) * 100 : 0
  return Math.round((m.invitados.pctConfirmado + Math.min(100, m.dinero.pctContratado) + acomodado + alDia) / 4)
}

type Pintada = { valor: string; nota: string; tramos: { pct: number; color: string }[]; pie: string }

// Una entrada por cifra del catalogo. El Record obliga a que agregar un CifraId
// nuevo no compile hasta que se le de su pintura aqui.
const PINTAR: Record<CifraId, (m: EventMetrics) => Pintada> = {
  invitados: m => {
    const total = m.invitados.total || 1
    return {
      valor: String(m.invitados.confirmados),
      nota: `de ${m.invitados.total}`,
      tramos: [
        { pct: (m.invitados.confirmados / total) * 100, color: '#48C9B0' },
        { pct: (m.invitados.pendientes  / total) * 100, color: '#D4A853' },
        { pct: (m.invitados.declinados  / total) * 100, color: '#E4E4E4' },
      ],
      pie: `${m.invitados.pctConfirmado}% confirmado · ${m.invitados.pendientes} por responder · ${m.invitados.declinados} no asisten`,
    }
  },
  presupuesto: m => {
    const pista = Math.max(m.dinero.estimado, m.dinero.contratado) || 1
    return {
      valor: formatCurrency(m.dinero.estimado, m.event.currency),
      nota: 'estimado',
      tramos: m.dinero.excedido
        ? [{ pct: 100, color: '#CC3333' }]
        : [
            { pct: (m.dinero.pagado   / pista) * 100, color: '#1A9E88' },
            { pct: (m.dinero.porPagar / pista) * 100, color: '#48C9B0' },
          ],
      pie: m.dinero.excedido
        ? `Excedido en ${formatCurrency(m.dinero.contratado - m.dinero.estimado, m.event.currency)}`
        : `Pagado ${formatCurrency(m.dinero.pagado, m.event.currency)} · por pagar ${formatCurrency(m.dinero.porPagar, m.event.currency)}`,
    }
  },
  proveedores: m => {
    const total = m.proveedores.total || 1
    return {
      valor: String(m.proveedores.contratados),
      nota: `de ${m.proveedores.total}`,
      tramos: [
        { pct: (m.proveedores.contratados / total) * 100, color: '#48C9B0' },
        { pct: (m.proveedores.cotizados   / total) * 100, color: '#D4A853' },
      ],
      pie: `${m.proveedores.cotizados} cotizados · ${m.proveedores.nuevos} sin cotizar`,
    }
  },
  tareas: m => {
    const total = m.tareas.vencidas + m.tareas.hoy + m.tareas.proximas || 1
    return {
      valor: String(m.tareas.vencidas),
      nota: m.tareas.vencidas === 1 ? 'vencida' : 'vencidas',
      tramos: [
        { pct: (m.tareas.vencidas / total) * 100, color: '#CC3333' },
        { pct: (m.tareas.hoy      / total) * 100, color: '#D4A853' },
        { pct: (m.tareas.proximas / total) * 100, color: '#48C9B0' },
      ],
      pie: `${m.tareas.hoy} para hoy · ${m.tareas.proximas} próximas${m.tareas.bloqueantesVencidas > 0 ? ` · ${m.tareas.bloqueantesVencidas} bloqueantes` : ''}`,
    }
  },
  regalos: m => ({
    valor: formatCurrency(m.regalos.recibido, m.event.currency),
    nota: 'recibido',
    tramos: [{ pct: m.regalos.totalItems > 0 ? (m.regalos.apartados / m.regalos.totalItems) * 100 : 0, color: '#D4A853' }],
    pie: `${m.regalos.apartados} de ${m.regalos.totalItems} apartados`,
  }),
  mesas: m => {
    const cabezas = m.mesas.conLugar + m.mesas.sinLugar
    const pct = cabezas > 0 ? Math.round((m.mesas.conLugar / cabezas) * 100) : 0
    return {
      valor: `${pct}%`,
      nota: 'acomodado',
      tramos: [{ pct, color: '#48C9B0' }],
      pie: `${m.mesas.conLugar} con lugar · ${m.mesas.sinLugar} sin lugar · ${m.mesas.sillasLibres} sillas libres`,
    }
  },
  atencion: m => {
    const total = m.invitados.total || 1
    return {
      valor: String(m.invitados.atencion),
      nota: m.invitados.atencion === 1 ? 'invitado' : 'invitados',
      tramos: [{ pct: (m.invitados.atencion / total) * 100, color: '#CC3333' }],
      pie: m.invitados.atencion === 0 ? 'Nadie espera respuesta' : 'Escribieron algo que hay que resolver',
    }
  },
  organizacion: m => {
    const pct = pctOrganizacion(m)
    return {
      valor: `${pct}%`,
      nota: 'en orden',
      tramos: [{ pct, color: '#48C9B0' }],
      pie: 'Promedio de invitados, dinero, logística y tareas',
    }
  },
}

function Barra({ tramos }: { tramos: { pct: number; color: string }[] }) {
  return (
    <div className="my-2.5 flex h-2 overflow-hidden rounded-full bg-[#F0F0F0]">
      {tramos.filter(t => t.pct > 0).map((t, i) => (
        <span key={i} className="block h-full transition-all duration-500" style={{ width: `${t.pct}%`, background: t.color }} />
      ))}
    </div>
  )
}

function Cifra({ id, indice, m, modoPersonalizar, cifrasDisp, onCambiarCifra }: {
  id: CifraId
  indice: number
  m: EventMetrics
  modoPersonalizar: boolean
  cifrasDisp: CifraId[]
  onCambiarCifra: (indice: number, nueva: CifraId) => void
}) {
  const [menu, setMenu] = useState(false)
  const d = PINTAR[id](m)

  // Derivado en vez de reiniciado por efecto: al salir del modo el menu se
  // cierra solo, sin provocar un render extra.
  const abierto = menu && modoPersonalizar

  return (
    <div className="relative min-w-0 flex-1 px-4 py-4 sm:px-5">
      {modoPersonalizar ? (
        <>
          <button
            onClick={() => setMenu(p => !p)}
            aria-expanded={abierto}
            className="flex items-center gap-1.5 rounded-[8px] border border-dashed border-[#CCC] px-2 py-1 transition hover:border-[#48C9B0]"
          >
            <span className={T_LABEL}>{TITULO_CIFRA.get(id) ?? id}</span>
            <ChevronDown size={13} className="text-[#BBB]" />
          </button>
          {abierto && (
            <div className="absolute left-4 top-12 z-50 w-56 overflow-hidden rounded-xl border border-[#E8E8E8] bg-white shadow-lg">
              {cifrasDisp.map(opcion => (
                <button
                  key={opcion}
                  onClick={() => { setMenu(false); onCambiarCifra(indice, opcion) }}
                  className={'block w-full px-4 py-2.5 text-left text-[13.5px] transition hover:bg-[#F8F8F8] ' + (opcion === id ? 'font-semibold text-[#1A9E88]' : 'text-[#1D1E20]')}
                >
                  {TITULO_CIFRA.get(opcion) ?? opcion}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <span className={T_LABEL}>{TITULO_CIFRA.get(id) ?? id}</span>
      )}

      <p className="mt-1.5 font-display text-[26px] font-extrabold leading-none tracking-[-0.025em] sm:text-[30px]">
        {d.valor}
        <span className="ml-1.5 text-[13px] font-medium tracking-normal text-[#888]">{d.nota}</span>
      </p>
      <Barra tramos={d.tramos} />
      <p className="text-[12.5px] text-[#888]">{d.pie}</p>
    </div>
  )
}

export default function BannerEvento({ m, cifras, cifrasDisp, modoPersonalizar, onCambiarCifra, onAbrirEvento, controles }: {
  m: EventMetrics
  cifras: CifraId[]
  cifrasDisp: CifraId[]
  modoPersonalizar: boolean
  onCambiarCifra: (indice: number, nueva: CifraId) => void
  onAbrirEvento: () => void
  controles?: React.ReactNode
}) {
  const ev = m.event
  const inv = INVITACION_CHIP[m.invitacion] ?? INVITACION_CHIP.borrador
  const acceso = ACCESS_MODES.find(a => a.key === resolveAccessMode(ev.event_type, m.accessMode))

  // El origin se lee al hacer clic, no en un efecto: guardarlo en estado
  // desincroniza el render del servidor con el del cliente.
  const abrirInvitacion = () => {
    if (!m.sharedToken) return
    const slug = slugifyEvent({ name: ev.name, host_name: ev.host_name, host_name_2: ev.host_name_2 })
    window.open(`${window.location.origin}/invitacion/${slug}/${m.sharedToken}`, '_blank', 'noopener')
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white">

      <div className="relative overflow-hidden bg-gradient-to-br from-white via-white to-[#f3fbf9] px-5 py-5 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-24 h-[320px] w-[320px] rounded-full bg-[#48C9B0]/15 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.09em] text-[#999]">
              {ev.event_type && (
                <>
                  <span>{ev.event_type}</span>
                  <span className="text-[#DDD]">/</span>
                </>
              )}
              <span className={'flex items-center gap-1.5 ' + (ev.event_status === 'active' ? 'text-[#1A9E88]' : 'text-[#B8860B]')}>
                <i className={'h-[7px] w-[7px] rounded-full ' + (ev.event_status === 'active' ? 'bg-[#48C9B0]' : 'bg-[#D4A853]')} />
                {ESTADO_LABEL[ev.event_status] ?? ev.event_status}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
              <h2 className="min-w-0 font-display text-[26px] font-black leading-[1.03] tracking-[-0.03em] sm:text-[32px]">
                {ev.name}
              </h2>
              <CuentaRegresiva event={ev} />
            </div>

            <p className="mt-2.5 flex items-center gap-2 text-[13px] text-[#777] sm:text-[14px]">
              <Calendar size={15} className="shrink-0 text-[#BBB]" />
              <span>
                {formatEventDate(ev.event_date, ev.event_end_date)}
                {ev.event_time && ` · ${formatTime(ev.event_time)}`}
              </span>
            </p>

            {ev.venue && (
              <p className="mt-1.5 flex items-center gap-2 text-[13px] text-[#999]">
                <MapPin size={15} className="shrink-0 text-[#BBB]" />
                <span className="min-w-0">{ev.venue}</span>
              </p>
            )}

            <p className={'mt-3 flex items-center gap-2 text-[13px] font-medium ' + inv.color}>
              <inv.Icono size={15} className="shrink-0" />
              <span className="min-w-0 truncate">{inv.texto}</span>
            </p>

            {acceso && (
              <p className="mt-1.5 flex items-center gap-2 text-[13px] text-[#999]">
                <acceso.icon size={15} className="shrink-0" />
                <span className="min-w-0 truncate">{acceso.label}</span>
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-3 lg:items-end">
            {controles}
          </div>
        </div>

        {/* Pegados al pie del hero, no en la columna de la derecha. */}
        <div className="relative z-10 mt-5 flex flex-wrap gap-2">
          <button
            onClick={onAbrirEvento}
            className="flex-1 rounded-[10px] bg-[#48C9B0] px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-[#3ab89f] active:scale-95 sm:flex-none"
          >
            Abrir evento
          </button>
          {m.sharedToken && (
            <button onClick={abrirInvitacion} className={BTN_SEC + ' flex flex-1 items-center justify-center gap-2 sm:flex-none'}>
              <ExternalLink size={14} />
              Abrir invitación
            </button>
          )}
        </div>

      </div>

      <div className="grid grid-cols-1 divide-y divide-[#EEE] border-t border-[#E8E8E8] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {cifras.map((id, i) => (
          <Cifra
            key={id}
            id={id}
            indice={i}
            m={m}
            modoPersonalizar={modoPersonalizar}
            cifrasDisp={cifrasDisp}
            onCambiarCifra={onCambiarCifra}
          />
        ))}
      </div>
    </div>
  )
}
