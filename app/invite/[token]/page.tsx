'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { enmascararCorreo } from '@/lib/workspace/correo-enmascarado'
import { logAction } from '@/lib/audit'
import { AlertCircle, Check, CheckCircle, Loader, Lock, Mail, Eye, EyeOff } from 'lucide-react'

// Esta pantalla se abre casi siempre desde un enlace de WhatsApp, en un
// telefono. Por eso una sola tarjeta centrada sobre el crema de la marca, y la
// misma cascara para todos los estados: el que llega a un enlace cancelado
// merece verse en la misma casa que el que llega a uno bueno.
function Cascara({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-[#f8f5f0] px-4 py-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/isotipoylogo.svg" alt="Anfiora" className="h-12 w-auto max-w-[180px]" />
      <div className="w-full max-w-[420px]">{children}</div>
    </div>
  )
}

function Aviso({ icono, fondo, titulo, children }: {
  icono: ReactNode
  fondo: string
  titulo: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#e8e8e8] bg-white px-6 py-8 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: fondo }}>
        {icono}
      </span>
      <p className="text-base font-semibold text-[#1D1E20]">{titulo}</p>
      {children}
    </div>
  )
}

// Datos seguros de la invitación que devuelve /api/invite/[token]
interface InviteData {
  kind?: 'event' | 'workspace'
  event_id?: string
  email: string
  role?: string
  roleLabel?: string
  event?: {
    name: string
    event_date: string | null
    venue: string | null
  }
  workspace_name?: string
  rol?: string
  rolLabel?: string
  invitado_por?: string | null
  bodas?: { id: string; name: string; event_date?: string | null; venue?: string | null }[]
}

type PageState =
  | 'loading'        // verificando token
  | 'invalid'        // token no existe o ya fue revocado
  | 'already_used'   // ya fue aceptado antes
  | 'auth_required'  // necesita login o registro
  | 'wrong_account'  // sesión con un correo distinto al invitado
  | 'accepting'      // procesando aceptación
  | 'success'        // todo bien
  | 'error'          // algo falló

type AuthMode = 'login' | 'register'

export default function InvitePage() {
  const { token } = useParams()
  const router    = useRouter()

  const [pageState, setPageState]   = useState<PageState>('loading')
  const [invite, setInvite]         = useState<InviteData | null>(null)
  const [authMode, setAuthMode]     = useState<AuthMode>('login')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName]     = useState('')
  const [authError, setAuthError]   = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [accepted, setAccepted]     = useState(false)
  const [usedEventId, setUsedEventId] = useState<string | null>(null)
  const [currentEmail, setCurrentEmail] = useState('')
  const [accountExists, setAccountExists] = useState(false)

  // Al montar: verificar token y sesión activa
  useEffect(() => {
    checkInvite()
  }, [token])

  const checkInvite = async () => {
    // La verificación del token corre en una API route con service role:
    // el navegador nunca lee event_collaborators directo (sin RLS anon).
    let payload: { status: PageState; kind?: 'event' | 'workspace'; invite?: InviteData; event_id?: string | null; account_exists?: boolean }
    try {
      const res = await fetch(`/api/invite/${token}`)
      payload = await res.json()
    } catch {
      setPageState('error'); return
    }

    if (payload.status === 'invalid') { setPageState('invalid'); return }
    if (payload.status === 'already_used') {
      setUsedEventId(payload.event_id ?? null)
      setPageState('already_used'); return
    }
    if (!payload.invite) { setPageState('invalid'); return }

    setInvite({ ...payload.invite, kind: payload.kind })
    const exists = !!payload.account_exists
    setAccountExists(exists)

    // Verificar si hay sesión activa
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      // Solo el correo invitado puede aceptar. Si la sesión es de otro correo,
      // no consumimos la invitación: avisamos y dejamos cambiar de cuenta.
      const sessionEmail = (session.user.email || '').trim().toLowerCase()
      const invitedEmail = (payload.invite.email || '').trim().toLowerCase()
      if (invitedEmail && sessionEmail !== invitedEmail) {
        setCurrentEmail(session.user.email || '')
        setPageState('wrong_account')
        return
      }
      await acceptInvite(session.access_token)
    } else {
      // Pre-llenar email del invitado y mostrar el modo correcto:
      // si ya tiene cuenta -> iniciar sesión; si no -> crear cuenta.
      setEmail(payload.invite.email)
      setAuthMode(exists ? 'login' : 'register')
      setPageState('auth_required')
    }
  }

  const handleSwitchAccount = async () => {
    await supabase.auth.signOut()
    setCurrentEmail('')
    setPassword('')
    setAuthMode(accountExists ? 'login' : 'register')
    setEmail(invite?.email || '')
    setAuthError('')
    setPageState('auth_required')
  }

  const acceptInvite = async (accessToken: string) => {
    setPageState('accepting')

    let result: { ok?: boolean; kind?: 'event' | 'workspace'; event_id?: string | null; role?: string; error?: string; your_email?: string }
    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken },
      })
      result = await res.json()
    } catch {
      setPageState('error'); return
    }

    if (result.error === 'email_mismatch') {
      setCurrentEmail(result.your_email || '')
      setPageState('wrong_account'); return
    }

    if (!result.ok) { setPageState('error'); return }
    if (result.kind !== 'workspace' && !result.event_id) { setPageState('error'); return }

    // Registrar en audit log (solo cuando hay una boda concreta a la que apuntar)
    if (result.event_id) {
      await logAction({
        eventId:     result.event_id,
        action:      'collaborator.accepted',
        entityType:  'collaborator',
        entityLabel: result.role || '',
      })
    }

    setPageState('success')

    // Redirigir al evento (o al dashboard si es un admin de workspace sin boda puntual) después de 2 segundos
    setTimeout(() => {
      router.push(result.event_id ? `/events/${result.event_id}` : '/dashboard')
    }, 2000)
  }

  const handleAuth = async () => {
    setAuthLoading(true)
    setAuthError('')

    if (!invite) return

    if (authMode === 'login') {
      // Intentar login
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setAuthError('Email o contraseña incorrectos'); setAuthLoading(false); return }
      if (!data.session) { setAuthError('Error al iniciar sesión'); setAuthLoading(false); return }
      await acceptInvite(data.session.access_token)

    } else {
      // Registrar cuenta nueva
      if (!fullName.trim()) { setAuthError('Ingresa tu nombre'); setAuthLoading(false); return }
      if (password.length < 6) { setAuthError('La contraseña debe tener al menos 6 caracteres'); setAuthLoading(false); return }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() } },
      })

      if (error) { setAuthError(error.message); setAuthLoading(false); return }
      if (!data.user) { setAuthError('Error al crear cuenta'); setAuthLoading(false); return }

    // Crear perfil en tabla users solo si no existe
    await supabase.from('users').upsert({
    id:        data.user.id,
    email:     data.user.email,
    full_name: fullName.trim(),
    plan:      'free',
    }, { onConflict: 'id', ignoreDuplicates: true })

    if (!data.session) {
      setAuthError('Revisa tu correo para confirmar la cuenta y vuelve a abrir el enlace')
      setAuthLoading(false)
      return
    }

    await fetch('/api/legal/accept', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + data.session.access_token },
    }).catch(() => {})

    await acceptInvite(data.session.access_token)
    }

    setAuthLoading(false)
  }

  const formatDate = (d: string | null) => {
    if (!d) return null
    const [year, month, day] = d.split('T')[0].split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  const ROLE_LABELS: Record<string, string> = {
    admin:  'Administrador',
    editor: 'Editor',
    viewer: 'Solo lectura',
  }

  // Fecha corta para la lista de eventos: "14 jun 2026" cabe en un renglon.
  const fechaCorta = (d: string | null | undefined) => {
    if (!d) return null
    const [year, month, day] = d.split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const iniciales = (texto: string) => {
    const partes = (texto || '').trim().split(/\s+/).filter(Boolean)
    if (partes.length === 0) return '??'
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
    return (partes[0][0] + partes[1][0]).toUpperCase()
  }

  if (pageState === 'loading' || pageState === 'accepting') {
    return (
      <Cascara>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#e8e8e8] bg-white px-6 py-10">
          <Loader size={26} className="animate-spin text-[#48C9B0]" />
          <p className="text-sm text-[#888]">
            {pageState === 'loading' ? 'Verificando invitación...' : 'Entrando...'}
          </p>
        </div>
      </Cascara>
    )
  }

  if (pageState === 'invalid') {
    return (
      <Cascara>
        <Aviso
          fondo="#fdeceb"
          icono={<AlertCircle size={20} className="text-[#c0453d]" />}
          titulo="Este enlace ya no sirve"
        >
          {/* Las invitaciones no caducan solas: lo que pasa de verdad es que
              alguien la cancelo, o que el enlace llego cortado por el chat. */}
          <p className="max-w-[290px] text-sm leading-relaxed text-[#666]">
            Puede que lo hayan cancelado, o que el enlace haya llegado incompleto. Pídele uno nuevo a quien te invitó.
          </p>
        </Aviso>
      </Cascara>
    )
  }

  if (pageState === 'already_used') {
    return (
      <Cascara>
        <Aviso
          fondo="#f0fdfb"
          icono={<Check size={20} className="text-[#48C9B0]" />}
          titulo="Ya habías aceptado esta invitación"
        >
          <p className="max-w-[290px] text-sm leading-relaxed text-[#666]">
            Tu cuenta ya tiene acceso. Entra para verlo.
          </p>
          <button
            onClick={() => router.push(usedEventId ? `/events/${usedEventId}` : '/dashboard')}
            className="mt-3 min-h-[44px] rounded-[10px] bg-[#48C9B0] px-5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
          >
            Iniciar sesión
          </button>
        </Aviso>
      </Cascara>
    )
  }

  if (pageState === 'wrong_account') {
    return (
      <Cascara>
        <Aviso
          fondo="#fff8ec"
          icono={<Mail size={20} className="text-[#b3801a]" />}
          titulo="Esta invitación es para otro correo"
        >
          {/* Su propia cuenta va completa, que ya la conoce. La ajena va
              enmascarada: este enlace viaja por WhatsApp y se reenvia. */}
          <p className="max-w-[300px] text-sm leading-relaxed text-[#666]">
            {currentEmail && <>Estás dentro como <span className="font-semibold text-[#1D1E20]">{currentEmail}</span> y el enlace es para </>}
            {!currentEmail && <>El enlace es para </>}
            <span className="font-semibold text-[#1D1E20]">{enmascararCorreo(invite?.email ?? '')}</span>.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              onClick={handleSwitchAccount}
              className="min-h-[44px] rounded-[10px] bg-[#48C9B0] px-4 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
            >
              Cambiar de cuenta
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="min-h-[44px] rounded-[10px] border border-[#e8e8e8] px-4 text-sm font-semibold text-[#666] transition hover:bg-[#f8f8f8]"
            >
              Volver
            </button>
          </div>
        </Aviso>
      </Cascara>
    )
  }

  if (pageState === 'success') {
    return (
      <Cascara>
        <Aviso
          fondo="#f0fdfb"
          icono={<CheckCircle size={20} className="text-[#48C9B0]" />}
          titulo="Listo, ya estás dentro"
        >
          {/* Decia "ya tienes acceso al evento" incluso cuando la invitacion era
              al workspace completo: a quien entraba a varios le mentia. */}
          <p className="max-w-[290px] text-sm leading-relaxed text-[#666]">
            {invite?.kind === 'workspace' && invite.workspace_name
              ? <>Ahora eres parte de {invite.workspace_name}. Te llevamos adentro...</>
              : <>Ya tienes acceso. Te llevamos al evento...</>}
          </p>
        </Aviso>
      </Cascara>
    )
  }

  if (pageState === 'error') {
    return (
      <Cascara>
        <Aviso
          fondo="#fdeceb"
          icono={<AlertCircle size={20} className="text-[#c0453d]" />}
          titulo="Algo salió mal"
        >
          <p className="max-w-[290px] text-sm leading-relaxed text-[#666]">
            No pudimos procesar tu invitación. Inténtalo de nuevo o escríbele a quien te invitó.
          </p>
          <button
            onClick={() => router.refresh()}
            className="mt-3 min-h-[44px] rounded-[10px] bg-[#48C9B0] px-5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
          >
            Reintentar
          </button>
        </Aviso>
      </Cascara>
    )
  }

  // Estado principal: auth_required. Una sola tarjeta que primero explica a que
  // la invitan y luego pide los datos. El orden importa: nadie deberia crear
  // una cuenta sin haber leido a que esta diciendo que si.
  const esWorkspace = invite?.kind === 'workspace'
  const eventos = invite?.bodas ?? []
  const puedeEnviar = !authLoading && email.trim() && password.trim() && (authMode === 'login' || (accepted && fullName.trim()))

  const campo = 'min-h-[44px] w-full rounded-lg border border-[#e8e8e8] bg-white px-3 text-[15px] text-[#1D1E20] outline-none transition placeholder:text-[#aaa] focus:border-[#48C9B0]'
  const etiqueta = 'mb-1.5 block text-xs font-semibold text-[#666]'

  return (
    <Cascara>
      <div className="flex flex-col gap-4 rounded-2xl border border-[#e8e8e8] bg-white p-6">

        {/* Quien invita y a que */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          {esWorkspace && (
            <span className="mb-1 flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-[#1D1E20] text-[17px] font-semibold text-white">
              {iniciales(invite?.workspace_name ?? '')}
            </span>
          )}
          <p className="text-[13px] text-[#666]">
            {invite?.invitado_por
              ? <>{invite.invitado_por} te invitó a</>
              : <>Te invitaron a</>}
          </p>
          <p className="text-[20px] font-semibold leading-tight tracking-[-0.01em] text-[#1D1E20]">
            {esWorkspace ? invite?.workspace_name : invite?.event?.name}
          </p>
          {!esWorkspace && invite?.event?.event_date && (
            <p className="text-sm text-[#666]">{formatDate(invite.event.event_date)}</p>
          )}
          {!esWorkspace && invite?.event?.venue && (
            <p className="text-sm text-[#666]">{invite.event.venue}</p>
          )}
          <span className="mt-2 rounded-full border border-[#cdeee6] bg-[#f0fdfb] px-2.5 py-[3px] text-xs font-semibold text-[#04342C]">
            {esWorkspace
              ? invite?.rol === 'admin'
                ? 'Entras como administrador, a todos los eventos'
                : `Entras como ${(invite?.rolLabel ?? 'colaborador').toLowerCase()}`
              : `Entras como ${((invite?.role && ROLE_LABELS[invite.role]) || invite?.role || '').toLowerCase()}`}
          </span>
        </div>

        {/* A que eventos entra. Se enseña ANTES del formulario a proposito. */}
        {esWorkspace && invite?.rol !== 'admin' && eventos.length > 0 && (
          <div className="flex flex-col gap-2.5 border-t border-[#f0f0f0] pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#999]">
              {eventos.length === 1 ? 'Vas a entrar a 1 evento' : `Vas a entrar a ${eventos.length} eventos`}
            </p>
            {eventos.map(b => {
              const cuando = fechaCorta(b.event_date)
              const donde = [cuando, b.venue].filter(Boolean).join(' · ')
              return (
                <div key={b.id} className="flex items-start gap-2.5">
                  <span className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full bg-[#48C9B0]" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#1D1E20]">{b.name}</span>
                    {donde && <span className="block truncate text-xs text-[#666]">{donde}</span>}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {esWorkspace && invite?.rol === 'admin' && (
          <p className="border-t border-[#f0f0f0] pt-4 text-[13px] leading-relaxed text-[#666]">
            Entras a todos los eventos de este workspace, también a los que se creen después.
          </p>
        )}

        {/* Los datos */}
        <div className="flex flex-col gap-3 border-t border-[#f0f0f0] pt-4">
          <div>
            <label className={etiqueta}>Tu correo</label>
            <div className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3">
              <span className="min-w-0 truncate text-[15px] text-[#666]">{email}</span>
              <Lock size={15} className="shrink-0 text-[#999]" />
            </div>
          </div>

          {authMode === 'register' && (
            <div>
              <label className={etiqueta}>Tu nombre</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Nombre y apellido"
                className={campo}
              />
            </div>
          )}

          <div>
            <label className={etiqueta}>{authMode === 'register' ? 'Crea una contraseña' : 'Tu contraseña'}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && puedeEnviar && handleAuth()}
                placeholder={authMode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                className={campo + ' pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] transition hover:text-[#555]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {authMode === 'register' && (
            <label className="flex items-start gap-2 text-[12px] leading-snug text-[#777]">
              <input
                type="checkbox"
                checked={accepted}
                onChange={e => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#48C9B0]"
              />
              <span>
                Acepto los{' '}
                <a href="/terminos" target="_blank" rel="noopener noreferrer" className="font-medium text-[#48C9B0]">Términos y Condiciones</a>{' '}
                y el{' '}
                <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-medium text-[#48C9B0]">Aviso de Privacidad</a>.
              </span>
            </label>
          )}

          {authError && <p className="text-xs text-[#cc3333]">{authError}</p>}

          <button
            onClick={handleAuth}
            disabled={!puedeEnviar}
            className="min-h-[48px] w-full rounded-[10px] bg-[#48C9B0] text-[15px] font-semibold text-white shadow-[0_4px_16px_rgba(72,201,176,.35)] transition hover:bg-[#3ab89f] disabled:opacity-40 disabled:shadow-none"
          >
            {authLoading
              ? 'Un momento...'
              : authMode === 'login'
                ? 'Iniciar sesión y entrar'
                : esWorkspace ? 'Crear cuenta y entrar' : 'Entrar al evento'}
          </button>

          <p className="text-center text-[13px] text-[#666]">
            {authMode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button
              onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError('') }}
              className="font-semibold text-[#48C9B0] transition hover:text-[#3ab89f]"
            >
              {authMode === 'login' ? 'Créala aquí' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>
    </Cascara>
  )
}
