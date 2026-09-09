'use client'
import { useState } from 'react'
import { Check, Copy, UserPlus, Users } from 'lucide-react'
import { AltaPersonaModal } from '@/app/components/workspace/AltaPersonaModal'
import { FichaMiembroModal } from '@/app/components/workspace/FichaMiembroModal'
import { resumenAsientos } from '@/lib/workspace/asientos'
import { PLANES, PRECIO_ASIENTO_EXTRA } from '@/lib/workspace/planes'
import { ROL_LABEL, type Cliente, type Miembro } from '@/lib/workspace/tipos'
import { useWorkspace } from '../WorkspaceContext'

const TONOS = [
  { bg: '#e1f5ee', fg: '#04342C' },
  { bg: '#eae7f6', fg: '#443a7a' },
  { bg: '#f6ede3', fg: '#7a4a1e' },
  { bg: '#e3eef6', fg: '#1e4a7a' },
  { bg: '#f6e3e8', fg: '#7a1e3a' },
  { bg: '#e8f0e0', fg: '#3a5a1e' },
]
const APAGADO = { bg: '#f4f4f4', fg: '#999999' }
const PRINCIPAL = { bg: '#1D1E20', fg: '#ffffff' }

const tono = (s: string) => TONOS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % TONOS.length]
const iniciales = (nombre: string | null, email: string) =>
  (nombre ?? email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('')

const COLS = 'grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,2fr)_96px]'
const COLS_CLIENTE = 'grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_minmax(0,1fr)_96px]'

function Avatar({ tam, colores, texto, url }: {
  tam: number; colores: { bg: string; fg: string }; texto: string; url?: string | null
}) {
  if (url) {
    return <img src={url} alt="" className="shrink-0 rounded-full object-cover" style={{ width: tam, height: tam }} />
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: tam, height: tam, background: colores.bg, color: colores.fg, fontSize: tam <= 32 ? 12 : 13 }}
    >
      {texto}
    </span>
  )
}

function Estado({ status }: { status: string }) {
  const pendiente = status === 'pending'
  return (
    <span
      className="inline-flex rounded-full border px-2.5 py-[3px] text-xs font-medium"
      style={pendiente
        ? { background: '#fff8ec', borderColor: '#f5dfb4', color: '#8a5a08' }
        : { background: '#f0fdfb', borderColor: '#cdeee6', color: '#04342C' }}
    >
      {pendiente ? 'Pendiente' : 'Activo'}
    </span>
  )
}

// El acceso del cliente se resume desde sus permisos: no hay rol que leer.
function nivelCliente(permisos: Cliente['permisos']): string {
  const niveles = Object.values(permisos ?? {})
  if (niveles.some(n => n === 'editar' || n === 'total')) return 'Puede editar'
  if (niveles.some(n => n === 'ver')) return 'Solo lectura'
  return 'Sin acceso'
}

export default function EquipoPage() {
  const { activo, recargar } = useWorkspace()
  const [alta, setAlta] = useState(false)
  const [ficha, setFicha] = useState<Miembro | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  if (!activo) return null

  const asientos = resumenAsientos(activo.plan, activo.miembros)
  const plan = PLANES[activo.plan]
  const esFree = activo.plan === 'free'
  const soloYo = activo.miembros.length <= 1

  // Sin extras la barra mide contra lo que incluye el plan; con extras el plan
  // deja de ser el techo, asi que mide contra lo que de verdad se ocupa.
  const conExtra = asientos.extra > 0
  const dinero = (n: number) => `$${n.toLocaleString('es-MX')}`
  const anchoIncluidos = conExtra
    ? (asientos.incluidos / asientos.ocupados) * 100
    : (asientos.ocupados / Math.max(asientos.incluidos, 1)) * 100
  const anchoExtra = conExtra ? (asientos.extra / asientos.ocupados) * 100 : 0

  const unidad = asientos.incluidos === 1 ? 'asiento usado' : 'asientos usados'
  const fraccion = conExtra
    ? `${asientos.ocupados} ${asientos.ocupados === 1 ? 'asiento' : 'asientos'}`
    : `${asientos.ocupados} de ${asientos.incluidos}`
  const resto = conExtra
    ? ` · ${asientos.incluidos} ${asientos.incluidos === 1 ? 'incluido' : 'incluidos'} en ${plan.nombre}`
    : asientos.ocupados >= asientos.incluidos && !esFree
      ? ` ${unidad} · el siguiente suma ${dinero(PRECIO_ASIENTO_EXTRA)} al mes`
      : ` ${unidad} · Plan ${plan.nombre}`

  const copiarInvitacion = async (id: string, token: string | null) => {
    if (!token) return
    await navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`)
    setCopiado(id)
    setTimeout(() => setCopiado(c => (c === id ? null : c)), 1500)
  }

  const coloresDe = (m: Miembro) =>
    m.es_dueno_principal ? PRINCIPAL : m.user_id ? tono(m.email) : APAGADO

  const eventosDe = (m: Miembro) => {
    if (m.rol === 'dueno' || m.rol === 'admin') return { texto: 'Todos los eventos', cuenta: activo.bodas.length }
    const vivas = m.bodas.filter(b => b.status !== 'revoked')
    if (vivas.length === 0) return { texto: 'Ninguno', cuenta: 0 }
    return { texto: vivas.map(b => b.name).join(', '), cuenta: vivas.length }
  }

  const CopiarEnlace = ({ id, token }: { id: string; token: string | null }) => {
    if (!token) return null
    return (
      <button
        onClick={() => copiarInvitacion(id, token)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#666] transition hover:text-[#1D1E20]"
      >
        {copiado === id ? <Check size={13} className="text-[#48C9B0]" /> : <Copy size={13} />}
        {copiado === id ? 'Copiado' : 'Copiar enlace'}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1D1E20]">Equipo</h2>
          <p className="mt-1 text-[13px] text-[#666]">Quién entra al workspace y a qué eventos.</p>
        </div>
        <button
          onClick={() => setAlta(true)}
          className="flex items-center gap-2 rounded-[10px] bg-[#48C9B0] px-[18px] py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(72,201,176,.35)] transition hover:bg-[#3ab89f]"
        >
          <UserPlus size={16} /> Agregar persona
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[12.5px] text-[#666]">
          <span className="font-semibold tabular-nums text-[#1D1E20]">{fraccion}</span>{resto}
          {conExtra && (
            <span className="font-semibold text-[#a97f22]"> + {asientos.extra} extra · {dinero(asientos.costoExtraMensual)} al mes</span>
          )}
        </p>
        <div className="flex h-[5px] w-[260px] max-w-full overflow-hidden rounded-full bg-[#f0f0f0]">
          <span className="h-full bg-[#48C9B0]" style={{ width: `${anchoIncluidos}%` }} />
          {conExtra && <span className="h-full bg-[#d9a441]" style={{ width: `${anchoExtra}%` }} />}
        </div>
      </div>

      {soloYo && esFree ? (
        <div className="flex flex-col items-start gap-2.5 rounded-xl border border-[#e8e8e8] p-6">
          <span className="rounded-full bg-[#f4f4f4] px-2.5 py-0.5 text-[11px] font-semibold text-[#666]">Plan Free</span>
          <p className="text-[15px] font-semibold text-[#1D1E20]">El equipo es parte de Pro</p>
          <p className="max-w-[46ch] text-[13px] leading-relaxed text-[#666]">
            En Free trabajas tú solo con un evento activo. Pro cuesta {dinero(PLANES.pro.precio)} al mes, quita ese límite y te deja sumar a tu equipo por {dinero(PRECIO_ASIENTO_EXTRA)} cada asiento.
          </p>
          <button
            onClick={() => setAlta(true)}
            className="mt-1 rounded-[10px] bg-[#48C9B0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
          >
            Ver Pro
          </button>
          <p className="text-xs text-[#999]">Invitar clientes sí está incluido en Free. Se hace desde cada evento.</p>
        </div>
      ) : soloYo ? (
        <div className="flex flex-col items-center gap-2.5 rounded-xl border border-[#e8e8e8] px-6 py-8 text-center">
          <Users size={28} className="text-[#ccc]" strokeWidth={1.5} />
          <p className="text-[15px] font-semibold text-[#1D1E20]">Todavía trabajas solo</p>
          <p className="max-w-[36ch] text-[13px] leading-relaxed text-[#666]">Agrega a alguien de tu equipo y elige a qué eventos entra.</p>
          <button
            onClick={() => setAlta(true)}
            className="mt-1.5 rounded-[10px] bg-[#48C9B0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
          >
            Agregar persona
          </button>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-[#e8e8e8] sm:block">
            <div className={`grid ${COLS} gap-4 border-b border-[#e8e8e8] bg-[#fafafa] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#999]`}>
              <span>Persona</span><span>Rol</span><span>Estado</span><span>Eventos</span><span />
            </div>
            {activo.miembros.map(m => {
              const ev = eventosDe(m)
              return (
                <div key={m.id} className={`grid ${COLS} items-center gap-4 border-b border-[#f2f2f2] px-5 py-3.5 last:border-b-0`}>
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar tam={32} colores={coloresDe(m)} texto={iniciales(m.nombre, m.email)} url={m.avatar_url} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[#1D1E20]">{m.nombre ?? m.email}</span>
                      <span className="block truncate text-xs text-[#666]">{m.nombre ? m.email : m.user_id ? '' : 'Sin cuenta todavía'}</span>
                    </span>
                  </span>
                  <span className="text-[13px] text-[#1D1E20]">{m.es_dueno_principal ? 'Dueño principal' : ROL_LABEL[m.rol]}</span>
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <Estado status={m.status} />
                    {m.status === 'pending' && <CopiarEnlace id={m.id} token={m.invite_token} />}
                  </span>
                  <span className="min-w-0 truncate text-[13px] text-[#666]">
                    {ev.texto}{ev.cuenta > 0 && <span className="text-[#999]"> · {ev.cuenta}</span>}
                  </span>
                  <span className="text-right">
                    {m.es_dueno_principal
                      ? <span className="text-[13px] text-[#999]">Eres tú</span>
                      : <button onClick={() => setFicha(m)} className="text-[13px] font-semibold text-[#1D1E20] transition hover:text-[#48C9B0]">Editar</button>}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-2.5 sm:hidden">
            {activo.miembros.map(m => {
              const ev = eventosDe(m)
              return (
                <div key={m.id} className="flex gap-3 rounded-xl border border-[#e8e8e8] p-3.5">
                  <Avatar tam={36} colores={coloresDe(m)} texto={iniciales(m.nombre, m.email)} url={m.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-[15px] font-semibold text-[#1D1E20]">{m.nombre ?? m.email}</span>
                      {m.es_dueno_principal
                        ? <span className="shrink-0 text-xs text-[#999]">Eres tú</span>
                        : <button onClick={() => setFicha(m)} className="shrink-0 text-[13px] font-semibold text-[#1D1E20]">Editar</button>}
                    </div>
                    {m.nombre && <p className="mt-0.5 truncate text-xs text-[#666]">{m.email}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#f4f4f4] px-2 py-0.5 text-[11px] font-medium text-[#1D1E20]">
                        {m.es_dueno_principal ? 'Dueño principal' : ROL_LABEL[m.rol]}
                      </span>
                      <Estado status={m.status} />
                      <span className="text-[11px] text-[#999]">{ev.texto}</span>
                    </div>
                    {m.status === 'pending' && (
                      <div className="mt-2.5 flex min-h-[44px] items-center justify-center rounded-[10px] border border-[#e8e8e8]">
                        <CopiarEnlace id={m.id} token={m.invite_token} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h3 className="text-[15px] font-semibold text-[#1D1E20]">Clientes</h3>
          <p className="text-[13px] text-[#666]">No ocupan asiento · un solo evento cada uno</p>
        </div>

        {activo.clientes.length === 0 ? (
          <div className="flex flex-col gap-2 rounded-xl border border-[#e8e8e8] p-6">
            <p className="text-[13px] font-semibold text-[#1D1E20]">Sin clientes</p>
            <p className="max-w-[52ch] text-[13px] leading-relaxed text-[#666]">
              Ningún cliente tiene acceso todavía. Se invita desde su evento y no ocupa asiento.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-[#e8e8e8] sm:block">
              <div className={`grid ${COLS_CLIENTE} gap-4 border-b border-[#e8e8e8] bg-[#fafafa] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#999]`}>
                <span>Correo</span><span>Evento</span><span>Estado</span><span />
              </div>
              {activo.clientes.map(c => (
                <div key={c.id} className={`grid ${COLS_CLIENTE} items-center gap-4 border-b border-[#f2f2f2] px-5 py-3.5 last:border-b-0`}>
                  <span className="min-w-0 truncate text-sm text-[#1D1E20]">{c.email}</span>
                  <span className="min-w-0 truncate text-[13px] text-[#666]">{c.eventName}</span>
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    {c.status === 'pending'
                      ? <Estado status="pending" />
                      : <span className="inline-flex rounded-full border border-[#cdeee6] bg-[#f0fdfb] px-2.5 py-[3px] text-xs font-medium text-[#04342C]">{nivelCliente(c.permisos)}</span>}
                  </span>
                  <span className="text-right">
                    <a href={`/events/${c.eventId}/configuracion?tab=equipo`} className="text-[13px] font-semibold text-[#1D1E20] transition hover:text-[#48C9B0]">Ver evento</a>
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2.5 sm:hidden">
              {activo.clientes.map(c => (
                <a key={c.id} href={`/events/${c.eventId}/configuracion?tab=equipo`} className="flex flex-col gap-1 rounded-xl border border-[#e8e8e8] p-3.5">
                  <span className="truncate text-sm text-[#1D1E20]">{c.email}</span>
                  <span className="truncate text-xs text-[#666]">
                    {c.eventName} · {c.status === 'pending' ? 'Invitación pendiente' : nivelCliente(c.permisos)}
                  </span>
                </a>
              ))}
            </div>
          </>
        )}
      </div>

      {alta && <AltaPersonaModal open onClose={() => setAlta(false)} workspace={activo} onHecho={() => recargar()} />}
      {ficha && <FichaMiembroModal open onClose={() => setFicha(null)} workspace={activo} miembro={ficha} onHecho={() => recargar()} />}
    </div>
  )
}
