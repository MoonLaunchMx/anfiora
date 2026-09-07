'use client'
import { Suspense, useEffect, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Bell, ChevronDown, Clock, CreditCard, User, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Cargando } from '@/app/components/ui/Cargando'
import { miMembresia } from '@/lib/workspace/cliente'
import { resumenAsientos } from '@/lib/workspace/asientos'
import { etiquetaPlan } from '@/lib/workspace/planes'
import type { RolWorkspace, WorkspaceListado, WorkspaceResumen } from '@/lib/workspace/tipos'
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext'

const EVENTOS_TERMINADOS = new Set(['cancelled', 'completed', 'archived'])

function iniciales(texto: string): string {
  const partes = texto.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '??'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

function rolTexto(activo: WorkspaceResumen): string {
  if (activo.esDuenoPrincipal) return 'dueño principal'
  if (activo.miRol === 'dueno') return 'dueño'
  return 'administrador'
}

function tituloMovil(pathname: string): string {
  if (pathname.startsWith('/configuracion/perfil')) return 'Perfil'
  if (pathname.startsWith('/configuracion/notificaciones')) return 'Notificaciones'
  if (pathname.startsWith('/configuracion/equipo')) return 'Equipo'
  return 'Configuración'
}

function WorkspaceSwitch({
  activo, workspaces, variant,
}: {
  activo: WorkspaceResumen
  workspaces: WorkspaceListado[]
  variant: 'pill' | 'boton'
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const puedeCambiar = workspaces.length > 1

  const lista = open && puedeCambiar && (
    <div className={`absolute top-full z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-lg ${variant === 'pill' ? 'left-0' : 'right-0'}`}>
      {workspaces.map(w => (
        <button
          key={w.id}
          onClick={() => { setOpen(false); router.push(`${pathname}?ws=${w.id}`) }}
          className={`flex w-full items-center px-3.5 py-2.5 text-left text-sm transition ${w.id === activo.id ? 'bg-[#f0fdfb] font-semibold text-[#1a9e88]' : 'text-[#1D1E20] hover:bg-[#f8f8f8]'}`}
        >
          {w.name}
        </button>
      ))}
    </div>
  )

  if (variant === 'pill') {
    return (
      <div className="relative">
        <button
          onClick={() => puedeCambiar && setOpen(o => !o)}
          className={`flex items-center gap-2 rounded-lg border border-[#e8e8e8] px-2.5 py-[5px] text-[13px] font-medium text-[#1D1E20] ${puedeCambiar ? 'cursor-pointer hover:border-[#48C9B0]' : 'cursor-default'}`}
        >
          {activo.name}
          {puedeCambiar && <ChevronDown size={14} className="text-[#999]" />}
        </button>
        {lista}
      </div>
    )
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-[10px] border border-[#e8e8e8] px-3 py-2 text-[13px] font-medium text-[#1D1E20] transition hover:border-[#48C9B0]"
      >
        Cambiar de workspace
        <ChevronDown size={14} className="text-[#999]" />
      </button>
      {lista}
    </div>
  )
}

function Cascara({ children }: { children: ReactNode }) {
  const { activo, workspaces, cargando: cargandoWorkspace } = useWorkspace()
  const pathname = usePathname()
  const router = useRouter()

  const [persona, setPersona] = useState<{ nombre: string; email: string } | null>(null)
  const [membresia, setMembresia] = useState<{ rol: RolWorkspace; workspaceName: string } | null>(null)
  const [cargandoPersona, setCargandoPersona] = useState(true)

  useEffect(() => {
    let vivo = true
    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }
      const { data } = await supabase.from('users').select('full_name').eq('id', user.id).single()
      const [membresiaActual] = await Promise.all([miMembresia()])
      if (!vivo) return
      setPersona({ nombre: data?.full_name || '', email: user.email || '' })
      setMembresia(membresiaActual)
      setCargandoPersona(false)
    }
    cargar()
    return () => { vivo = false }
  }, [router])

  const cargando = cargandoWorkspace || cargandoPersona
  const esAdmin = !cargando && (activo !== null || workspaces.length > 0)
  const esIndice = pathname === '/configuracion'
  const bloqueadoWorkspace = !cargando && !esAdmin && pathname.startsWith('/configuracion/equipo')

  if (cargando) return <Cargando pantallaCompleta mensaje="Cargando" />

  const nombrePersona = persona?.nombre || persona?.email || ''
  const eventosActivos = activo ? activo.bodas.filter(b => !EVENTOS_TERMINADOS.has(b.event_status ?? '')).length : 0
  const asientos = activo ? resumenAsientos(activo.plan, activo.miembros) : null
  const asientosTexto = asientos
    ? asientos.ocupados > asientos.incluidos
      ? `${asientos.ocupados} asientos · ${asientos.extra} extra`
      : `${asientos.ocupados} de ${asientos.incluidos} asientos usados`
    : ''

  const CUENTA_ITEMS = [
    { href: '/configuracion/perfil', label: 'Perfil', Icon: User },
    { href: '/configuracion/notificaciones', label: 'Notificaciones', Icon: Bell },
  ]
  const WORKSPACE_ITEMS: { href: string | null; label: string; Icon: typeof Users }[] = [
    { href: '/configuracion/equipo', label: 'Equipo', Icon: Users },
    { href: null, label: 'Actividad', Icon: Clock },
    { href: null, label: 'Plan y facturación', Icon: CreditCard },
  ]

  return (
    <div className="flex h-[100dvh] flex-col bg-white font-sans text-[#1D1E20]">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e8e8e8] bg-white px-4 lg:px-5">
        <div className="flex items-center gap-3">
          <Image src="/images/isotipo.png" alt="Anfiora" width={22} height={22} className="h-[22px] w-auto object-contain" />
          {esAdmin && activo && (
            <>
              <div className="h-5 w-px bg-[#e8e8e8]" />
              <WorkspaceSwitch activo={activo} workspaces={workspaces} variant="pill" />
            </>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard" className="text-[13px] text-[#666] transition hover:text-[#1D1E20]">Eventos</Link>
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#e1f5ee] text-[12px] font-semibold text-[#04342C]">
            {iniciales(nombrePersona)}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden w-[248px] shrink-0 flex-col gap-[22px] overflow-y-auto border-r border-[#e8e8e8] bg-[#f8f5f0] px-3.5 py-6 lg:flex">
          <nav className="flex flex-col gap-0.5">
            <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wide text-[#999]">Tu cuenta</p>
            {CUENTA_ITEMS.map(({ href, label, Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-left text-sm transition ${active ? 'bg-white font-semibold text-[#1D1E20] shadow-[inset_0_0_0_1px_#e8e8e8]' : 'text-[#666] hover:bg-white/60'}`}
                >
                  <Icon size={16} className={active ? 'text-[#48C9B0]' : 'text-[#888]'} />
                  {label}
                </button>
              )
            })}
          </nav>

          {esAdmin && (
            <nav className="flex flex-col gap-0.5">
              <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wide text-[#999]">Workspace</p>
              {WORKSPACE_ITEMS.map(({ href, label, Icon }) => {
                if (!href) {
                  return (
                    <div key={label} className="flex items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-sm text-[#666]">
                      <Icon size={16} className="text-[#888]" />
                      <span className="flex-1">{label}</span>
                      <span className="rounded-full bg-[#f2f2f2] px-2 py-0.5 text-[10px] font-semibold text-[#999]">Pronto</span>
                    </div>
                  )
                }
                const active = pathname.startsWith(href)
                return (
                  <button
                    key={href}
                    onClick={() => router.push(href)}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-left text-sm transition ${active ? 'bg-white font-semibold text-[#1D1E20] shadow-[inset_0_0_0_1px_#e8e8e8]' : 'text-[#666] hover:bg-white/60'}`}
                  >
                    <Icon size={16} className={active ? 'text-[#48C9B0]' : 'text-[#888]'} />
                    {label}
                  </button>
                )
              })}
            </nav>
          )}

          {esAdmin && activo && (
            <div className="mt-auto rounded-[10px] border border-[#e8e8e8] bg-white p-3">
              <p className="mb-1 text-xs font-semibold text-[#1D1E20]">Plan {etiquetaPlan(activo.plan)}</p>
              <p className="text-xs leading-[1.5] text-[#666]">{asientosTexto}</p>
            </div>
          )}
        </aside>

        {/* Columna de contenido */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {!esIndice && (
            <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[#e8e8e8] px-4 lg:hidden">
              <button onClick={() => router.push('/configuracion')} className="text-[#1D1E20]">
                <ArrowLeft size={20} />
              </button>
              <span className="text-base font-semibold text-[#1D1E20]">{tituloMovil(pathname)}</span>
            </div>
          )}

          <div className="flex-1 px-4 py-4 lg:px-10 lg:pb-10 lg:pt-7">
            <div className="mb-6 hidden items-start justify-between gap-6 border-b border-[#e8e8e8] pb-5 lg:flex">
              {esAdmin && activo ? (
                <>
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#1D1E20] text-[15px] font-semibold text-white">
                      {iniciales(activo.name)}
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-semibold tracking-tight text-[#1D1E20]">{activo.name}</span>
                        <span className="rounded-full bg-[#e1f5ee] px-2 py-0.5 text-[11px] font-semibold text-[#04342C]">{etiquetaPlan(activo.plan)}</span>
                      </div>
                      <p className="text-[13px] text-[#666]">
                        Eres {rolTexto(activo)} · {eventosActivos} evento{eventosActivos === 1 ? '' : 's'} activo{eventosActivos === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  {workspaces.length > 1 && <WorkspaceSwitch activo={activo} workspaces={workspaces} variant="boton" />}
                </>
              ) : (
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#f8f5f0] text-[15px] font-semibold text-[#1D1E20]">
                    {iniciales(nombrePersona)}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xl font-semibold tracking-tight text-[#1D1E20]">{nombrePersona}</span>
                    {membresia && membresia.rol === 'colaborador' && (
                      <p className="text-[13px] text-[#666]">Colaborador en {membresia.workspaceName}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {bloqueadoWorkspace ? (
              <div className="rounded-xl border border-[#e8e8e8] bg-[#f8f8f8] p-4">
                <p className="mb-1 text-sm font-semibold text-[#1D1E20]">Equipo y facturación</p>
                <p className="text-[13px] leading-[1.5] text-[#666]">
                  Los administra el dueño del workspace. Si necesitas acceso a otro evento, pídeselo.
                </p>
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConfiguracionLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Cargando mensaje="Cargando" pantallaCompleta />}>
      <WorkspaceProvider>
        <Cascara>{children}</Cascara>
      </WorkspaceProvider>
    </Suspense>
  )
}
