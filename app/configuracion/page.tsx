'use client'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, ChevronRight, ChevronsUpDown, Clock, CreditCard, User, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { miMembresia } from '@/lib/workspace/cliente'
import { resumenAsientos } from '@/lib/workspace/asientos'
import { etiquetaPlan } from '@/lib/workspace/planes'
import type { RolWorkspace } from '@/lib/workspace/tipos'
import { useWorkspace } from './WorkspaceContext'

function iniciales(texto: string): string {
  const partes = texto.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '??'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

function rolTextoCorto(esDuenoPrincipal: boolean, miRol: string): string {
  if (esDuenoPrincipal) return 'Dueño principal'
  if (miRol === 'dueno') return 'Dueño'
  return 'Administrador'
}

// Deteccion de viewport via useSyncExternalStore: evita el mismatch de
// hidratacion que da matchMedia leido en un useEffect (SSR no conoce el
// ancho real, asi que el snapshot de servidor siempre es "movil").
function suscribirDesktop(callback: () => void) {
  const mq = window.matchMedia('(min-width: 1024px)')
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}
const leerDesktop = () => window.matchMedia('(min-width: 1024px)').matches
const leerDesktopServidor = () => false

export default function ConfiguracionIndexPage() {
  const router = useRouter()
  const { activo, workspaces, cargando: cargandoWorkspace, recargar } = useWorkspace()
  const esDesktop = useSyncExternalStore(suscribirDesktop, leerDesktop, leerDesktopServidor)
  const [nombrePersona, setNombrePersona] = useState('')
  const [membresia, setMembresia] = useState<{ rol: RolWorkspace; workspaceName: string } | null>(null)
  const [selectorAbierto, setSelectorAbierto] = useState(false)

  useEffect(() => {
    if (esDesktop) router.replace('/configuracion/perfil')
  }, [esDesktop, router])

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('users').select('full_name').eq('id', user.id).single()
      setNombrePersona(data?.full_name || user.email || '')
      setMembresia(await miMembresia())
    }
    cargar()
  }, [])

  if (esDesktop || cargandoWorkspace) return null

  const esAdmin = activo !== null || workspaces.length > 0
  const asientos = activo ? resumenAsientos(activo.plan, activo.miembros) : null

  return (
    <div className="flex flex-col gap-5">
      {esAdmin && activo ? (
        <div className="relative rounded-xl border border-[#e8e8e8] p-3.5">
          <button
            onClick={() => workspaces.length > 1 && setSelectorAbierto(o => !o)}
            className="flex w-full items-center gap-3 text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#1D1E20] text-sm font-semibold text-white">
              {iniciales(activo.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[15px] font-semibold text-[#1D1E20]">{activo.name}</span>
                <span className="shrink-0 rounded-full bg-[#e1f5ee] px-[7px] py-[1px] text-[10px] font-semibold text-[#04342C]">{etiquetaPlan(activo.plan)}</span>
              </div>
              <p className="mt-0.5 text-xs text-[#666]">{rolTextoCorto(activo.esDuenoPrincipal, activo.miRol)}</p>
            </div>
            {workspaces.length > 1 && <ChevronsUpDown size={18} className="shrink-0 text-[#999]" />}
          </button>
          {selectorAbierto && workspaces.length > 1 && (
            <div className="mt-2 overflow-hidden rounded-lg border border-[#e8e8e8]">
              {workspaces.map(w => (
                <button
                  key={w.id}
                  onClick={() => { setSelectorAbierto(false); router.push(`/configuracion?ws=${w.id}`); recargar() }}
                  className={`flex w-full items-center px-3.5 py-2.5 text-left text-sm transition ${w.id === activo.id ? 'bg-[#f0fdfb] font-semibold text-[#1a9e88]' : 'text-[#1D1E20] hover:bg-[#f8f8f8]'}`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-[#e8e8e8] p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#f8f5f0] text-sm font-semibold text-[#1D1E20]">
            {iniciales(nombrePersona)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-[#1D1E20]">{nombrePersona}</p>
            {membresia && membresia.rol === 'colaborador' && (
              <p className="mt-0.5 text-xs text-[#666]">Colaborador en {membresia.workspaceName}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#999]">Tu cuenta</p>
        <div className="overflow-hidden rounded-xl border border-[#e8e8e8]">
          <Link href="/configuracion/perfil" className="flex min-h-11 items-center gap-3 border-b border-[#f2f2f2] px-4 py-3.5">
            <User size={18} className="text-[#888]" />
            <span className="flex-1 text-[15px] text-[#1D1E20]">Perfil</span>
            <ChevronRight size={16} className="text-[#ccc]" />
          </Link>
          <Link href="/configuracion/notificaciones" className="flex min-h-11 items-center gap-3 px-4 py-3.5">
            <Bell size={18} className="text-[#888]" />
            <span className="flex-1 text-[15px] text-[#1D1E20]">Notificaciones</span>
            <ChevronRight size={16} className="text-[#ccc]" />
          </Link>
        </div>
      </div>

      {esAdmin && activo && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#999]">Workspace</p>
          <div className="overflow-hidden rounded-xl border border-[#e8e8e8]">
            <Link href="/configuracion/equipo" className="flex min-h-11 items-center gap-3 border-b border-[#f2f2f2] px-4 py-3.5">
              <Users size={18} className="text-[#888]" />
              <span className="flex-1 text-[15px] text-[#1D1E20]">Equipo</span>
              <span className="text-[13px] text-[#999]">{activo.miembros.length}</span>
              <ChevronRight size={16} className="text-[#ccc]" />
            </Link>
            <div className="flex min-h-11 items-center gap-3 border-b border-[#f2f2f2] px-4 py-3.5 opacity-60">
              <Clock size={18} className="text-[#888]" />
              <span className="flex-1 text-[15px] text-[#1D1E20]">Actividad</span>
              <span className="rounded-full bg-[#f2f2f2] px-2 py-0.5 text-[10px] font-semibold text-[#999]">Pronto</span>
            </div>
            <div className="flex min-h-11 items-center gap-3 px-4 py-3.5 opacity-60">
              <CreditCard size={18} className="text-[#888]" />
              <span className="flex-1 text-[15px] text-[#1D1E20]">Plan y facturación</span>
              <span className="rounded-full bg-[#f2f2f2] px-2 py-0.5 text-[10px] font-semibold text-[#999]">Pronto</span>
            </div>
          </div>
        </div>
      )}

      {esAdmin && activo && asientos ? (
        <div className="rounded-xl bg-[#f8f5f0] px-4 py-3.5 text-[13px] leading-[1.5] text-[#666]">
          Plan {etiquetaPlan(activo.plan)} · {asientos.ocupados} de {asientos.incluidos} asientos usados. <span className="font-semibold text-[#48C9B0]">Ver plan</span>
        </div>
      ) : !esAdmin ? (
        <div className="rounded-xl border border-[#e8e8e8] bg-[#f8f8f8] p-4">
          <p className="mb-1 text-sm font-semibold text-[#1D1E20]">Equipo y facturación</p>
          <p className="text-[13px] leading-[1.5] text-[#666]">
            Los administra el dueño del workspace. Si necesitas acceso a otro evento, pídeselo.
          </p>
        </div>
      ) : null}
    </div>
  )
}
