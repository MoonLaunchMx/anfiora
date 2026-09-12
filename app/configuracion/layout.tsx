'use client'
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Bell, ChevronDown, Clock, CreditCard, Pencil, Tags, User, Users, X } from 'lucide-react'
import { Aviso } from '@/app/components/ui/Aviso'
import { Cargando } from '@/app/components/ui/Cargando'
import { miMembresia, patchJson, perfilConFoto } from '@/lib/workspace/cliente'
import { usuarioActual } from '@/lib/workspace/sesion'
import { borrarImagenAnterior, subirImagen } from '@/lib/workspace/subir'
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

// El cuadro del header ES el control: es donde el logo va a salir, asi que es
// donde se cambia. Mismo gesto que Slack y Notion con el icono del workspace.
function LogoWorkspace({ activo, onCambio }: { activo: WorkspaceResumen; onCambio: () => void }) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(t)
  }, [error])

  const guardar = async (url: string | null, file?: File) => {
    setSubiendo(true)
    setError(null)
    try {
      let nueva = url
      if (file) {
        const r = await subirImagen('logos', activo.id, file)
        if (r.error) { setError(r.error); setSubiendo(false); return }
        nueva = r.url!
      }
      await patchJson('/api/workspace', { workspaceId: activo.id, logoUrl: nueva })
      await borrarImagenAnterior('logos', activo.id, activo.logoUrl)
      onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el logo')
    }
    setSubiendo(false)
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => input.current?.click()}
        disabled={subiendo}
        title={activo.logoUrl ? 'Cambiar el logo' : 'Subir el logo de tu empresa'}
        className="group relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-xl bg-[#1D1E20] text-[22px] font-semibold text-white transition hover:opacity-90"
      >
        {activo.logoUrl
          ? <img src={activo.logoUrl} alt={activo.name} className="h-full w-full object-cover" />
          : iniciales(activo.name)}
        <span className="absolute inset-0 hidden items-center justify-center bg-black/45 text-[11px] font-semibold text-white group-hover:flex">
          {subiendo ? '' : 'Cambiar'}
        </span>
      </button>

      {activo.logoUrl && !subiendo && (
        <button
          onClick={() => guardar(null)}
          title="Quitar el logo"
          className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#e8e8e8] bg-white text-[#888] shadow-sm transition hover:text-[#cc3333]"
        >
          <X size={11} />
        </button>
      )}

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) guardar(null, f) }}
      />

      {/* Mismo aviso que la foto de perfil: uno solo para toda la app. Se va
          a los 6 segundos y ademas se puede cerrar. */}
      {error && (
        <div className="absolute left-0 top-[52px] z-20 w-64">
          <Aviso tono="error" mensaje={error} onCerrar={() => setError(null)} className="shadow-sm" />
        </div>
      )}
    </div>
  )
}

// El nombre del workspace nace del nombre de quien lo creo, asi que casi
// siempre hay que cambiarlo. Se edita donde se lee, sin mandar a otra pantalla.
function NombreWorkspace({ activo, onCambio }: { activo: WorkspaceResumen; onCambio: () => void }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(activo.name)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const guardar = async () => {
    const limpio = valor.trim()
    if (limpio === activo.name) { setEditando(false); return }
    setGuardando(true)
    setError(null)
    try {
      await patchJson('/api/workspace', { workspaceId: activo.id, name: limpio })
      setEditando(false)
      onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
    setGuardando(false)
  }

  const cancelar = () => { setValor(activo.name); setError(null); setEditando(false) }

  if (!editando) {
    return (
      <button
        onClick={() => { setValor(activo.name); setEditando(true) }}
        title="Cambiar el nombre del workspace"
        className="group flex items-center gap-1.5 text-left text-xl font-semibold tracking-tight text-[#1D1E20]"
      >
        {activo.name}
        <Pencil size={13} className="shrink-0 text-[#c4c4c4] opacity-0 transition group-hover:opacity-100" />
      </button>
    )
  }

  return (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-1.5">
        <input
          value={valor}
          onChange={e => setValor(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') guardar()
            if (e.key === 'Escape') cancelar()
          }}
          autoFocus
          maxLength={60}
          className="w-[220px] rounded-lg border border-[#e8e8e8] px-2.5 py-1 text-xl font-semibold tracking-tight text-[#1D1E20] outline-none focus:border-[#48C9B0]"
        />
        <button
          onClick={guardar}
          disabled={guardando || valor.trim().length < 2}
          className="rounded-lg bg-[#48C9B0] px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-50"
        >
          {guardando ? 'Guardando' : 'Guardar'}
        </button>
        <button onClick={cancelar} className="px-1.5 text-[13px] font-medium text-[#888] transition hover:text-[#555]">
          Cancelar
        </button>
      </span>

      {error && <span className="text-[11px] text-[#cc3333]">{error}</span>}
    </span>
  )
}

// El eslogan vive por su cuenta, debajo del nombre. Cuando esta vacio deja una
// invitacion discreta a escribirlo: antes solo se descubria entrando a editar
// el nombre, y ahi nadie lo iba a encontrar.
function Eslogan({ activo, onCambio }: { activo: WorkspaceResumen; onCambio: () => void }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(activo.tagline ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abrir = () => { setValor(activo.tagline ?? ''); setError(null); setEditando(true) }
  const cancelar = () => { setValor(activo.tagline ?? ''); setError(null); setEditando(false) }

  const guardar = async () => {
    const frase = valor.trim()
    if (frase === (activo.tagline ?? '')) { setEditando(false); return }
    setGuardando(true)
    setError(null)
    try {
      await patchJson('/api/workspace', { workspaceId: activo.id, tagline: frase })
      setEditando(false)
      onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
    setGuardando(false)
  }

  if (editando) {
    return (
      <span className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <input
            value={valor}
            onChange={e => setValor(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') cancelar() }}
            autoFocus
            maxLength={90}
            placeholder="Bodas que se sienten tuyas"
            className="w-full max-w-[520px] rounded-lg border border-[#e8e8e8] px-2.5 py-1 text-[13px] text-[#1D1E20] outline-none placeholder:text-[#bbb] focus:border-[#48C9B0] sm:w-[460px]"
          />
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-lg bg-[#48C9B0] px-3 py-1 text-[12px] font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-50"
          >
            {guardando ? 'Guardando' : 'Guardar'}
          </button>
          <button onClick={cancelar} className="px-1 text-[12px] font-medium text-[#888] transition hover:text-[#555]">
            Cancelar
          </button>
        </span>
        {error && <span className="text-[11px] text-[#cc3333]">{error}</span>}
      </span>
    )
  }

  if (!activo.tagline) {
    return (
      <button
        onClick={abrir}
        className="w-fit text-[13px] font-medium text-[#a8a8a2] transition hover:text-[#1a9e88]"
      >
        Agregar eslogan
      </button>
    )
  }

  return (
    <button
      onClick={abrir}
      title="Cambiar el eslogan"
      className="group flex w-fit items-center gap-1.5 text-left"
    >
      <span className="max-w-[38ch] text-[13px] italic leading-snug text-[#8a8a85] sm:max-w-[70ch]">{activo.tagline}</span>
      <Pencil size={12} className="shrink-0 text-[#c4c4c4] opacity-0 transition group-hover:opacity-100" />
    </button>
  )
}

function Cascara({ children }: { children: ReactNode }) {
  const { activo, workspaces, cargando: cargandoWorkspace, recargar } = useWorkspace()
  const pathname = usePathname()
  const router = useRouter()

  const [persona, setPersona] = useState<{ nombre: string; email: string; foto: string | null } | null>(null)
  const [membresia, setMembresia] = useState<{ rol: RolWorkspace; workspaceName: string } | null>(null)
  const [cargandoPersona, setCargandoPersona] = useState(true)

  useEffect(() => {
    let vivo = true
    const cargar = async () => {
      const user = await usuarioActual()
      if (!user) { router.replace('/'); return }
      const perfil = await perfilConFoto(user.id)
      const membresiaActual = await miMembresia(user.id)
      if (!vivo) return
      setPersona({ nombre: perfil.nombre, email: user.email || '', foto: perfil.foto })
      setMembresia(membresiaActual)
    }
    // Si algo aqui revienta, la espera TIENE que terminar igual. El candado de
    // sesion de Supabase rechaza con AbortError cuando dos efectos se lo pelean,
    // y sin este finally la pantalla se quedaba en "Cargando" para siempre en
    // vez de dibujarse con las iniciales.
    cargar()
      .catch(e => console.error('No se pudo cargar la persona:', e))
      .finally(() => { if (vivo) setCargandoPersona(false) })
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
    // El catalogo de categorias es del workspace, no del perfil: es una
    // pantalla entera y por eso vive en el nav, no como renglon en Perfil.
    { href: '/ajustes/categorias', label: 'Categorías', Icon: Tags },
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
          {persona?.foto
            ? <img src={persona.foto} alt="" className="h-[30px] w-[30px] shrink-0 rounded-full object-cover" />
            : (
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#e1f5ee] text-[12px] font-semibold text-[#04342C]">
                {iniciales(nombrePersona)}
              </span>
            )}
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
            <div className="mt-auto flex flex-col gap-1 rounded-[10px] border border-[#e8e8e8] bg-white p-3">
              <p className="text-xs font-semibold text-[#1D1E20]">Plan {etiquetaPlan(activo.plan)}</p>
              <p className="text-xs leading-[1.5] text-[#666]">{asientosTexto}</p>
              <p className="text-xs leading-[1.5] text-[#999]">
                Eres {rolTexto(activo)} · {eventosActivos} evento{eventosActivos === 1 ? '' : 's'} activo{eventosActivos === 1 ? '' : 's'}
              </p>
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
                    <LogoWorkspace activo={activo} onCambio={recargar} />
                    <div className="flex flex-col gap-1">
                      <NombreWorkspace activo={activo} onCambio={recargar} />
                      <Eslogan activo={activo} onCambio={recargar} />
                    </div>
                  </div>
                  {workspaces.length > 1 && <WorkspaceSwitch activo={activo} workspaces={workspaces} variant="boton" />}
                </>
              ) : (
                <div className="flex items-center gap-3.5">
                  {persona?.foto
                    ? <img src={persona.foto} alt="" className="h-11 w-11 shrink-0 rounded-[10px] object-cover" />
                    : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#f8f5f0] text-[15px] font-semibold text-[#1D1E20]">
                        {iniciales(nombrePersona)}
                      </div>
                    )}
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
