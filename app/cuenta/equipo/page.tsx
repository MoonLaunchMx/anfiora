'use client'
import { useState } from 'react'
import { UserPlus, Users } from 'lucide-react'
import { AltaPersonaModal } from '@/app/components/workspace/AltaPersonaModal'
import { FichaMiembroModal } from '@/app/components/workspace/FichaMiembroModal'
import { InvitarClienteModal } from '@/app/components/workspace/InvitarClienteModal'
import { resumenAsientos } from '@/lib/workspace/asientos'
import { PLANES } from '@/lib/workspace/planes'
import { ROL_LABEL, type Miembro } from '@/lib/workspace/tipos'
import { useWorkspace } from '../WorkspaceContext'

const TONOS = ['#5b7c99', '#8a6d9c', '#6f9b7a', '#b08a5b', '#7a8a9c', '#9c6f6f']
const tono = (s: string) => TONOS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % TONOS.length]
const iniciales = (nombre: string | null, email: string) =>
  (nombre ?? email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('')

export default function EquipoPage() {
  const { activo, recargar } = useWorkspace()
  const [alta, setAlta] = useState(false)
  const [cliente, setCliente] = useState(false)
  const [ficha, setFicha] = useState<Miembro | null>(null)
  if (!activo) return null

  const asientos = resumenAsientos(activo.plan, activo.miembros)
  const plan = PLANES[activo.plan]

  const Pastilla = ({ texto, tono }: { texto: string; tono: 'gold' | 'teal' | 'muted' | 'plain' }) => (
    <span className={'rounded-full border px-2 py-0.5 text-[11px] font-semibold ' + ({
      gold: 'border-[#f0dfae] bg-[#fffbf0] text-[#c49a3a]', teal: 'border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]',
      muted: 'border-[#e8e8e8] bg-[#f2f2f2] text-[#999]', plain: 'border-[#e0e0e0] text-[#666]',
    })[tono]}>{texto}</span>
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1D1E20]">Equipo</h2>
          <p className="text-xs text-[#888]">Quién existe en tu workspace y a qué bodas entra.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCliente(true)} className="rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]">Invitar cliente</button>
          <button onClick={() => setAlta(true)} className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-2 text-sm font-semibold text-[#08312a]"><UserPlus size={14} /> Agregar persona</button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {[
          ['Asientos', `${asientos.ocupados}`, 'ocupados'],
          [`Incluidos en ${plan.nombre}`, `${asientos.incluidos}`, ''],
          ['Extra', `${asientos.extra}`, asientos.extra > 0 ? `· $${asientos.costoExtraMensual.toLocaleString('es-MX')} / mes` : ''],
        ].map(([k, v, s]) => (
          <div key={k} className="rounded-xl border border-[#e8e8e8] bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#999]">{k}</p>
            <p className="text-xl font-bold text-[#1D1E20]">{v} <span className="text-xs font-medium text-[#888]">{s}</span></p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e8e8e8] bg-white">
        <div className="hidden grid-cols-[34px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 bg-[#f8f8f8] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#999] sm:grid">
          <span /><span>Persona</span><span>En el workspace</span><span>Bodas</span><span />
        </div>
        {activo.miembros.map(m => {
          const bodas = m.bodas.filter(b => b.status !== 'revoked')
          const esAdmin = m.rol === 'dueno' || m.rol === 'admin'
          return (
            <div key={m.id} className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#e8e8e8] px-3 py-2.5 sm:grid-cols-[34px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: tono(m.email) }}>{iniciales(m.nombre, m.email)}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[#1D1E20]">{m.nombre ?? m.email}</span>
                <span className="block truncate text-xs text-[#999]">{m.email}</span>
              </span>
              <span className="hidden flex-wrap gap-1 sm:flex">
                <Pastilla texto={m.es_dueno_principal ? 'Dueño principal' : ROL_LABEL[m.rol]} tono={m.es_dueno_principal ? 'gold' : 'plain'} />
                {m.status === 'pending' && <Pastilla texto="Invitación pendiente" tono="muted" />}
              </span>
              <span className="hidden text-sm text-[#666] sm:block">
                {esAdmin ? `Todas (${activo.bodas.length})` : bodas.length === 0 ? 'Ninguna' : bodas.length === 1 ? bodas[0].name : `${bodas.length} bodas`}
              </span>
              {m.es_dueno_principal
                ? <Pastilla texto="Eres tú" tono="muted" />
                : <button onClick={() => setFicha(m)} className="rounded-md px-2 py-1 text-sm font-semibold text-[#666] transition hover:bg-[#f5f5f5] hover:text-[#1D1E20]">Editar</button>}
            </div>
          )
        })}
        <div className="border-t border-[#e8e8e8] bg-[#f8f8f8] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#999]">Clientes · no ocupan asiento</div>
        {activo.clientes.length === 0 && (
          <p className="border-t border-[#e8e8e8] px-3 py-4 text-center text-xs text-[#aaa]">Todavía no has invitado clientes.</p>
        )}
        {activo.clientes.map(c => (
          <div key={c.id} className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#e8e8e8] px-3 py-2.5 sm:grid-cols-[34px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: tono(c.email) }}>{iniciales(null, c.email)}</span>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#1D1E20]">{c.email}</span></span>
            <span className="hidden gap-1 sm:flex"><Pastilla texto="Cliente" tono="teal" />{c.status === 'pending' && <Pastilla texto="Invitación pendiente" tono="muted" />}</span>
            <span className="hidden truncate text-sm text-[#666] sm:block">{c.eventName}</span>
            <a href={`/events/${c.eventId}/configuracion?tab=equipo`} className="rounded-md px-2 py-1 text-sm font-semibold text-[#666] transition hover:bg-[#f5f5f5] hover:text-[#1D1E20]">Editar</a>
          </div>
        ))}
      </div>

      {activo.miembros.length <= 1 && activo.plan === 'free' && (
        <p className="mt-3 flex items-center gap-2 text-xs text-[#888]"><Users size={14} /> Tu plan Free es solo para ti. Con Pro puedes agregar personas a tu equipo.</p>
      )}

      {alta && <AltaPersonaModal open onClose={() => setAlta(false)} workspace={activo} onHecho={() => recargar()} />}
      {cliente && <InvitarClienteModal open onClose={() => setCliente(false)} workspace={activo} onHecho={() => recargar()} />}
      {ficha && <FichaMiembroModal open onClose={() => setFicha(null)} workspace={activo} miembro={ficha} onHecho={() => recargar()} />}
    </div>
  )
}
