'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logAction } from '@/lib/audit'
import { CheckCircle, XCircle, Loader, Eye, EyeOff } from 'lucide-react'

// Datos seguros de la invitación que devuelve /api/invite/[token]
interface InviteData {
  event_id: string
  email: string
  role: string
  roleLabel: string
  event: {
    name: string
    event_date: string | null
    venue: string | null
  }
}

type PageState =
  | 'loading'        // verificando token
  | 'invalid'        // token no existe o ya fue revocado
  | 'already_used'   // ya fue aceptado antes
  | 'auth_required'  // necesita login o registro
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

  // Al montar: verificar token y sesión activa
  useEffect(() => {
    checkInvite()
  }, [token])

  const checkInvite = async () => {
    // La verificacion del token corre en una API route con service role:
    // el navegador nunca lee event_collaborators directo (sin RLS anon).
    let payload: { status: PageState; invite?: InviteData; event_id?: string }
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

    setInvite(payload.invite)

    // Verificar si hay sesión activa
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      // Hay sesión — aceptar directo
      await acceptInvite(session.access_token)
    } else {
      // Pre-llenar email si coincide
      setEmail(payload.invite.email)
      setPageState('auth_required')
    }
  }

  const acceptInvite = async (accessToken: string) => {
    setPageState('accepting')

    let result: { ok?: boolean; event_id?: string; role?: string }
    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken },
      })
      result = await res.json()
    } catch {
      setPageState('error'); return
    }

    if (!result.ok || !result.event_id) { setPageState('error'); return }

    // Registrar en audit log
    await logAction({
      eventId:     result.event_id,
      action:      'collaborator.accepted',
      entityType:  'collaborator',
      entityLabel: result.role || '',
    })

    setPageState('success')

    // Redirigir al evento después de 2 segundos
    setTimeout(() => {
      router.push(`/events/${result.event_id}`)
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
      if (!data.session) { setAuthError('Error al iniciar sesion'); setAuthLoading(false); return }
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
      setAuthError('Revisa tu correo para confirmar la cuenta y vuelve a abrir el link')
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

  // Estados de pantalla completa (sin form)
  if (pageState === 'loading' || pageState === 'accepting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader size={28} className="animate-spin text-[#48C9B0]" />
          <p className="text-sm text-[#888]">
            {pageState === 'loading' ? 'Verificando invitacion...' : 'Aceptando invitacion...'}
          </p>
        </div>
      </div>
    )
  }

  if (pageState === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <XCircle size={48} className="text-[#cc3333]" />
          <h1 className="text-lg font-bold text-[#1D1E20]">Link invalido</h1>
          <p className="text-sm text-[#888]">Este link de invitacion no existe o fue revocado. Pide al organizador que te mande uno nuevo.</p>
          <button onClick={() => router.push('/')}
            className="mt-2 rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]">
            Ir al inicio
          </button>
        </div>
      </div>
    )
  }

  if (pageState === 'already_used') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <CheckCircle size={48} className="text-[#48C9B0]" />
          <h1 className="text-lg font-bold text-[#1D1E20]">Ya tienes acceso</h1>
          <p className="text-sm text-[#888]">Esta invitacion ya fue aceptada. Entra para ver el evento.</p>
          <button onClick={() => router.push(usedEventId ? `/events/${usedEventId}` : '/dashboard')}
            className="mt-2 rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]">
            Ir al evento
          </button>
        </div>
      </div>
    )
  }

  if (pageState === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <CheckCircle size={48} className="text-[#48C9B0]" />
          <h1 className="text-lg font-bold text-[#1D1E20]">Acceso confirmado</h1>
          <p className="text-sm text-[#888]">Ya tienes acceso al evento. Redirigiendo...</p>
        </div>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <XCircle size={48} className="text-[#cc3333]" />
          <h1 className="text-lg font-bold text-[#1D1E20]">Algo salio mal</h1>
          <p className="text-sm text-[#888]">No pudimos procesar tu invitacion. Intenta de nuevo o contacta al organizador.</p>
          <button onClick={() => router.push('/')}
            className="mt-2 rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]">
            Ir al inicio
          </button>
        </div>
      </div>
    )
  }

  // Estado principal: auth_required
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f5f0] px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <img src="/images/isotipoylogo.svg" alt="Anfiora" className="h-16 w-auto max-w-full" />
        </div>

        {/* Card de invitacion */}
        {invite && (
          <div className="mb-4 rounded-xl border border-[#c8ede7] bg-[#f0fdfb] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#48C9B0]">
              Invitacion al evento
            </p>
            <p className="mt-1 text-base font-bold text-[#1D1E20]">
              {invite.event.name}
            </p>
            {invite.event.event_date && (
              <p className="mt-0.5 text-xs text-[#888]">{formatDate(invite.event.event_date)}</p>
            )}
            {invite.event.venue && (
              <p className="text-xs text-[#aaa]">{invite.event.venue}</p>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <span className="rounded-full border border-[#c8ede7] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#1a9e88]">
                {ROLE_LABELS[invite.role] || invite.role}
              </span>
            </div>
          </div>
        )}

        {/* Form auth */}
        <div className="rounded-xl border border-[#e8e8e8] bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-bold text-[#1D1E20]">
            {authMode === 'login' ? 'Inicia sesion para continuar' : 'Crea tu cuenta'}
          </h2>
          <p className="mb-4 text-xs text-[#888]">
            {authMode === 'login'
              ? 'Usa tu cuenta de Anfiora para aceptar la invitacion.'
              : 'Crea una cuenta gratuita para acceder al evento.'}
          </p>

          <div className="flex flex-col gap-3">
            {authMode === 'register' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-[#555]">Nombre completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Ana Garcia"
                  className="w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-[#555]">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#555]">Contrasena</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAuth()}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 pr-10 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
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

            {authError && (
              <p className="text-xs text-[#cc3333]">{authError}</p>
            )}

            <button
              onClick={handleAuth}
              disabled={authLoading || !email.trim() || !password.trim() || (authMode === 'register' && !accepted)}
              className="w-full rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-40"
            >
              {authLoading
                ? 'Procesando...'
                : authMode === 'login' ? 'Ingresar y aceptar invitacion' : 'Crear cuenta y aceptar'}
            </button>
          </div>

          {/* Toggle login/register */}
          <div className="mt-4 border-t border-[#f0f0f0] pt-4 text-center">
            {authMode === 'login' ? (
              <p className="text-xs text-[#888]">
                No tienes cuenta?{' '}
                <button onClick={() => { setAuthMode('register'); setAuthError('') }}
                  className="font-semibold text-[#48C9B0] transition hover:text-[#3ab89f]">
                  Crear una gratis
                </button>
              </p>
            ) : (
              <p className="text-xs text-[#888]">
                Ya tienes cuenta?{' '}
                <button onClick={() => { setAuthMode('login'); setAuthError('') }}
                  className="font-semibold text-[#48C9B0] transition hover:text-[#3ab89f]">
                  Iniciar sesion
                </button>
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}