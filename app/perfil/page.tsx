'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { User, Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft, ChevronDown, Bell, MessageSquarePlus } from 'lucide-react'
import { ROLES, getRole, Role } from '@/lib/roles'
import PhoneInput from '@/app/components/ui/PhoneInput'
import { PUSH_TYPES, type PushType, type NotificationPrefs } from '@/lib/types'
import { readPrefs, withPref } from '@/lib/notifications/prefs'

type PlanInfo = {
  label: string
  color: string
  bg: string
  border: string
}

const PLAN_STYLES: Record<string, PlanInfo> = {
  free:   { label: 'Free',   color: '#888',    bg: '#f8f8f8',  border: '#e0e0e0' },
  pro:    { label: 'Pro',    color: '#1a9e88', bg: '#f0fdfb',  border: '#a0e0d0' },
  agency: { label: 'Agency', color: '#7c3aed', bg: '#f5f3ff',  border: '#c4b5fd' },
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const output = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[#555]">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-[#aaa]">{hint}</p>}
    </div>
  )
}

function InputIcon({
  icon, type, value, onChange, placeholder, disabled, rightSlot,
}: {
  icon: React.ReactNode
  type: string
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  disabled?: boolean
  rightSlot?: React.ReactNode
}) {
  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 text-[#bbb]">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full rounded-[10px] border py-2.5 pl-9 pr-10 text-sm text-[#1D1E20] outline-none transition placeholder:text-[#c0c0c0]
          ${disabled
            ? 'border-[#f0f0f0] bg-[#f8f8f8] text-[#aaa] cursor-not-allowed'
            : 'border-[#e0e0e0] bg-[#f8f8f8] focus:border-[#48C9B0] focus:ring-2 focus:ring-[#48C9B0]/20'
          }`}
      />
      {rightSlot && <span className="absolute right-3">{rightSlot}</span>}
    </div>
  )
}

function Toast({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs
      ${type === 'success'
        ? 'border-[#a0e0c0] bg-[#f0fff6] text-[#2a7a50]'
        : 'border-[#ffc0c0] bg-[#fff0f0] text-[#cc3333]'
      }`}
    >
      {type === 'success'
        ? <CheckCircle size={14} className="shrink-0" />
        : <AlertCircle size={14} className="shrink-0" />
      }
      {message}
    </div>
  )
}

export default function PerfilPage() {
  const router = useRouter()

  // Usuario
  const [userId, setUserId]     = useState('')
  const [email, setEmail]       = useState('')
  const [name, setName]         = useState('')
  const [phone, setPhone]       = useState('')
  const [plan, setPlan]         = useState('free')
  const [loading, setLoading]   = useState(true)

  const [role, setRole]               = useState<string>('')
  const [editingRole, setEditingRole] = useState(false)
  const [savingRole, setSavingRole]   = useState(false)
  const [roleMsg, setRoleMsg]         = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Perfil
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Contraseña
  const [currentPass, setCurrentPass]   = useState('')
  const [newPass, setNewPass]           = useState('')
  const [confirmPass, setConfirmPass]   = useState('')
  const [showCurrent, setShowCurrent]   = useState(false)
  const [showNew, setShowNew]           = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [savingPass, setSavingPass]     = useState(false)
  const [passMsg, setPassMsg]           = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Notificaciones push
  const [pushSupported, setPushSupported]   = useState(true)
  const [pushEnabled, setPushEnabled]       = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [pushBusy, setPushBusy]             = useState(false)
  const [pushMsg, setPushMsg]               = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [prefs, setPrefs]                   = useState<NotificationPrefs>({})
  const [prefsBusy, setPrefsBusy]           = useState<PushType | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }

      setUserId(user.id)
      setEmail(user.email || '')

      // Jalar perfil de tabla users
      const { data } = await supabase
        .from('users')
        .select('full_name, phone, plan, role, settings')
        .eq('id', user.id)
        .single()

      if (data) {
        setName(data.full_name || '')
        setPhone(data.phone || '')
        setPlan(data.plan || 'free')
        setRole(data.role || '')
        setPrefs(readPrefs(data.settings))
      }

      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    if (!supported) {
      setPushSupported(false)
      return
    }

    setPushPermission(Notification.permission)

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushEnabled(!!sub))
      .catch(() => setPushEnabled(false))
  }, [])

  const handleChangeRole = async (newRole: Role) => {
    setSavingRole(true)
    setRoleMsg(null)
    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId)
    if (error) {
      setRoleMsg({ type: 'error', text: 'No se pudo cambiar el tipo de perfil.' })
    } else {
      setRole(newRole)
      setEditingRole(false)
      setRoleMsg({ type: 'success', text: 'Tipo de perfil actualizado' })
    }
    setSavingRole(false)
  }

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      setProfileMsg({ type: 'error', text: 'El nombre no puede estar vacío' })
      return
    }
    setSavingProfile(true)
    setProfileMsg(null)

    const { error } = await supabase
      .from('users')
      .update({ full_name: name.trim(), phone: phone.trim() || null })
      .eq('id', userId)

    if (error) {
      setProfileMsg({ type: 'error', text: 'No se pudo guardar. Intenta de nuevo.' })
    } else {
      // Sincronizar metadata de auth también
      await supabase.auth.updateUser({ data: { full_name: name.trim() } })
      // Solo RELLENA los eventos que no tengan nombre de planner. Desde el 8-ago
      // ese campo se edita por evento en Configuracion (un planner puede
      // presentarse distinto en cada uno), asi que pisarlo todo desde aqui le
      // borraria lo que puso a mano. El filtro cubre null Y cadena vacia: hay
      // filas viejas guardadas como ''.
      await supabase
        .from('events')
        .update({ planner_name: name.trim() })
        .eq('user_id', userId)
        .or('planner_name.is.null,planner_name.eq.')
      setProfileMsg({ type: 'success', text: 'Perfil actualizado correctamente' })
    }
    setSavingProfile(false)
  }

  const handleChangePassword = async () => {
    setPassMsg(null)
    if (!newPass || !confirmPass) {
      setPassMsg({ type: 'error', text: 'Completa todos los campos' })
      return
    }
    if (newPass.length < 8) {
      setPassMsg({ type: 'error', text: 'La contraseña debe tener mínimo 8 caracteres' })
      return
    }
    if (newPass !== confirmPass) {
      setPassMsg({ type: 'error', text: 'Las contraseñas no coinciden' })
      return
    }

    setSavingPass(true)

    // Verificar contraseña actual reautenticando
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email, password: currentPass,
    })

    if (signInError) {
      setPassMsg({ type: 'error', text: 'La contraseña actual es incorrecta' })
      setSavingPass(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPass })

    if (error) {
      setPassMsg({ type: 'error', text: 'No se pudo cambiar la contraseña. Intenta de nuevo.' })
    } else {
      setPassMsg({ type: 'success', text: 'Contraseña cambiada correctamente' })
      setCurrentPass(''); setNewPass(''); setConfirmPass('')
    }
    setSavingPass(false)
  }

  const enablePush = async () => {
    setPushMsg(null)
    setPushBusy(true)
    try {
      const permission = await Notification.requestPermission()
      setPushPermission(permission)
      if (permission !== 'granted') {
        setPushMsg({ type: 'error', text: 'Permiso de notificaciones bloqueado. Actívalo desde los ajustes del navegador.' })
        setPushBusy(false)
        return
      }

      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        setPushMsg({ type: 'error', text: 'Falta configuración del servidor. Intenta más tarde.' })
        setPushBusy(false)
        return
      }

      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }))

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
      })

      if (!res.ok) throw new Error('subscribe failed')

      setPushEnabled(true)
      setPushMsg({ type: 'success', text: 'Notificaciones activadas en este dispositivo' })
    } catch {
      setPushMsg({ type: 'error', text: 'No se pudieron activar las notificaciones. Intenta de nuevo.' })
    }
    setPushBusy(false)
  }

  const disablePush = async () => {
    setPushMsg(null)
    setPushBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ endpoint }),
        })
      }
      setPushEnabled(false)
      setPushMsg({ type: 'success', text: 'Notificaciones desactivadas en este dispositivo' })
    } catch {
      setPushMsg({ type: 'error', text: 'No se pudieron desactivar. Intenta de nuevo.' })
    }
    setPushBusy(false)
  }

  const sendTestPush = async () => {
    setPushMsg(null)
    setPushBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!res.ok) throw new Error('test failed')
      setPushMsg({ type: 'success', text: 'Enviamos una notificación de prueba a este dispositivo.' })
    } catch {
      setPushMsg({ type: 'error', text: 'No se pudo enviar la prueba. Intenta de nuevo.' })
    }
    setPushBusy(false)
  }

  const togglePref = async (type: PushType) => {
    const next = prefs[type] === false
    const previous = prefs
    setPrefsBusy(type)
    setPushMsg(null)
    setPrefs({ ...prefs, [type]: next })

    const { data: row } = await supabase.from('users').select('settings').eq('id', userId).single()
    const { data: updated, error } = await supabase
      .from('users')
      .update({ settings: withPref(row?.settings, type, next) })
      .eq('id', userId)
      .select('id')

    // Un UPDATE filtrado por RLS no da error, devuelve cero filas: hay que contarlas.
    if (error || !updated || updated.length === 0) {
      setPrefs(previous)
      setPushMsg({ type: 'error', text: 'No se pudo guardar la preferencia. Intenta de nuevo.' })
    }
    setPrefsBusy(null)
  }

  const planStyle = PLAN_STYLES[plan] || PLAN_STYLES.free
  const currentRole = getRole(role)
  const CurrentIcon = currentRole?.icon

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-[#f8f5f0] font-sans text-[#1D1E20]">

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#e8e8e8] bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <button onClick={() => { window.location.href = '/dashboard' }} className="shrink-0">
            <Image src="/images/Logo-010526newest.svg" alt="Anfiora" width={110} height={45} priority className="h-8 w-auto object-contain" />
          </button>
          <button
            onClick={() => { window.location.href = '/dashboard' }}
            className="flex items-center gap-1.5 text-xs text-[#888] transition hover:text-[#48C9B0]"
          >
            <ArrowLeft size={14} />
            Volver
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">

        <div className="mb-6">
          <h1 className="text-xl font-bold text-[#1D1E20] sm:text-2xl">Mi perfil</h1>
          <p className="mt-0.5 text-sm text-[#888]">Gestiona tu información y acceso</p>
        </div>

        <div className="flex flex-col gap-4">

          {/* ── Identidad ── */}
          <section className="rounded-2xl border border-[#e8e8e8] bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f0fdfb] text-base font-bold text-[#1a9e88]">
                  {(name || email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1D1E20]">{name || 'Tu perfil'}</p>
                  <p className="truncate text-xs text-[#888]">{email}</p>
                </div>
              </div>

              <div className="relative shrink-0">
                <button
                  onClick={() => setEditingRole(p => !p)}
                  className="flex items-center gap-2 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-semibold text-[#555] transition hover:border-[#48C9B0]"
                >
                  {currentRole && CurrentIcon ? (
                    <>
                      <CurrentIcon size={14} className="text-[#1a9e88]" />
                      {currentRole.shortLabel}
                    </>
                  ) : (
                    <span className="text-[#aaa]">Sin definir</span>
                  )}
                  <ChevronDown size={13} className="text-[#bbb]" />
                </button>

                {editingRole && (
                  <div className="absolute right-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
                    {ROLES.map(r => {
                      const Icon = r.icon
                      const active = r.value === role
                      return (
                        <button
                          key={r.value}
                          onClick={() => handleChangeRole(r.value)}
                          disabled={savingRole}
                          className={'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#f8f8f8] disabled:opacity-50 ' + (active ? 'bg-[#f0fdfb]' : '')}
                        >
                          <Icon size={16} className={active ? 'text-[#1a9e88]' : 'text-[#999]'} />
                          <div>
                            <p className="text-sm font-medium text-[#1D1E20]">{r.shortLabel}</p>
                            <p className="text-[11px] text-[#888]">{r.description}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {roleMsg && (
              <div className="mt-4">
                <Toast type={roleMsg.type} message={roleMsg.text} />
              </div>
            )}
          </section>

          {/* ── Plan actual ── */}
          <section className="rounded-2xl border border-[#e8e8e8] bg-white p-5 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-[#1D1E20]">Plan actual</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-bold"
                  style={{ background: planStyle.bg, borderColor: planStyle.border, color: planStyle.color }}
                >
                  {planStyle.label[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1D1E20]">Plan {planStyle.label}</p>
                  <p className="text-[11px] text-[#aaa]">
                    {plan === 'free'   && '1 evento · 30 invitados'}
                    {plan === 'pro'    && 'Eventos ilimitados · WhatsApp · IA'}
                    {plan === 'agency' && 'Todo Pro + número dedicado'}
                  </p>
                </div>
              </div>
              {plan === 'free' && (
                <span
                  className="rounded-full border px-3 py-1 text-[11px] font-semibold"
                  style={{ background: planStyle.bg, borderColor: planStyle.border, color: planStyle.color }}
                >
                  {planStyle.label}
                </span>
              )}
            </div>
          </section>

          {/* ── Notificaciones ── */}
          <section className="rounded-2xl border border-[#e8e8e8] bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-[#48C9B0]" />
              <h2 className="text-sm font-semibold text-[#1D1E20]">Notificaciones</h2>
            </div>
            <p className="mt-1 text-[12px] text-[#aaa]">
              Recibe avisos en este dispositivo cuando pase algo importante en tus eventos.
            </p>

            {!pushSupported ? (
              <p className="mt-4 text-xs text-[#888]">
                Este navegador no admite notificaciones. En iPhone o iPad necesitas instalar Anfiora como app desde Safari para activarlas.
              </p>
            ) : (
              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1D1E20]">Activar en este dispositivo</p>
                  <p className="text-[11px] text-[#aaa]">
                    {pushPermission === 'denied'
                      ? 'Permiso bloqueado. Habilítalo desde los ajustes del navegador.'
                      : pushEnabled
                        ? 'Estás recibiendo notificaciones aquí.'
                        : 'Las notificaciones están desactivadas aquí.'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pushEnabled}
                  disabled={pushBusy || pushPermission === 'denied'}
                  onClick={() => (pushEnabled ? disablePush() : enablePush())}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
                    ${pushEnabled ? 'bg-[#48C9B0]' : 'bg-[#d8d8d8]'}
                    ${pushBusy || pushPermission === 'denied' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
                      ${pushEnabled ? 'translate-x-5' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            )}

            {pushSupported && pushEnabled && (
              <button
                type="button"
                onClick={sendTestPush}
                disabled={pushBusy}
                className={`mt-4 rounded-[10px] border border-[#e0e0e0] bg-white px-4 py-2 text-xs font-semibold text-[#555] transition
                  ${pushBusy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-[#48C9B0] hover:text-[#48C9B0]'}`}
              >
                Enviar notificación de prueba
              </button>
            )}

            {pushSupported && (
              <div className={`mt-6 border-t border-[#f0f0f0] pt-5 ${pushEnabled ? '' : 'opacity-50'}`}>
                <p className="text-xs font-semibold text-[#555]">Qué quieres recibir</p>
                <div className="mt-3 flex flex-col gap-3">
                  {PUSH_TYPES.map(({ type, label, hint }) => {
                    const on = prefs[type] !== false
                    const disabled = !pushEnabled || prefsBusy !== null
                    return (
                      <div key={type} className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm text-[#1D1E20]">{label}</p>
                          <p className="text-[11px] text-[#aaa]">{hint}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={label}
                          disabled={disabled}
                          onClick={() => togglePref(type)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
                            ${on ? 'bg-[#48C9B0]' : 'bg-[#d8d8d8]'}
                            ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
                              ${on ? 'translate-x-5' : 'translate-x-1'}`}
                          />
                        </button>
                      </div>
                    )
                  })}
                </div>
                {!pushEnabled && (
                  <p className="mt-3 text-[11px] text-[#aaa]">
                    Activa las notificaciones en este dispositivo para elegir qué recibir.
                  </p>
                )}
              </div>
            )}

            {pushMsg && (
              <div className="mt-4">
                <Toast type={pushMsg.type} message={pushMsg.text} />
              </div>
            )}
          </section>

          {/* ── Información personal ── */}
          <section className="rounded-2xl border border-[#e8e8e8] bg-white p-5 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-[#1D1E20]">Información personal</h2>

            <div className="flex flex-col gap-4">
              <Field label="Nombre completo">
                <InputIcon
                  icon={<User size={15} />}
                  type="text"
                  value={name}
                  onChange={setName}
                  placeholder="Ana García"
                />
              </Field>

              <Field label="Correo electrónico" hint="El correo no se puede cambiar por ahora">
                <InputIcon
                  icon={<User size={15} />}
                  type="email"
                  value={email}
                  disabled
                />
              </Field>

              <Field label="WhatsApp" hint="Lo usaremos para verificación en el futuro">
                <PhoneInput value={phone} onChange={setPhone} placeholder="55 1234 5678" />
              </Field>
            </div>

            {profileMsg && (
              <div className="mt-4">
                <Toast type={profileMsg.type} message={profileMsg.text} />
              </div>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className={`mt-5 w-full rounded-[10px] border-none py-3 text-sm font-semibold text-white transition-colors
                ${savingProfile
                  ? 'cursor-not-allowed bg-[#9ee0d4]'
                  : 'cursor-pointer bg-[#48C9B0] hover:bg-[#3ab89f]'
                }`}
            >
              {savingProfile ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </section>

          {/* ── Cambiar contraseña ── */}
          <section className="rounded-2xl border border-[#e8e8e8] bg-white p-5 sm:p-6">
            <h2 className="mb-1 text-sm font-semibold text-[#1D1E20]">Cambiar contraseña</h2>
            <p className="mb-4 text-[12px] text-[#aaa]">Mínimo 8 caracteres</p>

            <div className="flex flex-col gap-4">
              <Field label="Contraseña actual">
                <InputIcon
                  icon={<Lock size={15} />}
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPass}
                  onChange={setCurrentPass}
                  placeholder="••••••••"
                  rightSlot={
                    <button
                      onClick={() => setShowCurrent(p => !p)}
                      className="cursor-pointer border-none bg-transparent text-[#bbb] transition-colors hover:text-[#888]"
                    >
                      {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  }
                />
              </Field>

              <Field label="Nueva contraseña">
                <InputIcon
                  icon={<Lock size={15} />}
                  type={showNew ? 'text' : 'password'}
                  value={newPass}
                  onChange={setNewPass}
                  placeholder="••••••••"
                  rightSlot={
                    <button
                      onClick={() => setShowNew(p => !p)}
                      className="cursor-pointer border-none bg-transparent text-[#bbb] transition-colors hover:text-[#888]"
                    >
                      {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  }
                />
              </Field>

              <Field label="Confirmar nueva contraseña">
                <InputIcon
                  icon={<Lock size={15} />}
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPass}
                  onChange={setConfirmPass}
                  placeholder="••••••••"
                  rightSlot={
                    <button
                      onClick={() => setShowConfirm(p => !p)}
                      className="cursor-pointer border-none bg-transparent text-[#bbb] transition-colors hover:text-[#888]"
                    >
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  }
                />
              </Field>
            </div>

            {passMsg && (
              <div className="mt-4">
                <Toast type={passMsg.type} message={passMsg.text} />
              </div>
            )}

            <button
              onClick={handleChangePassword}
              disabled={savingPass || !currentPass || !newPass || !confirmPass}
              className={`mt-5 w-full rounded-[10px] border-none py-3 text-sm font-semibold text-white transition-colors
                ${savingPass || !currentPass || !newPass || !confirmPass
                  ? 'cursor-not-allowed bg-[#9ee0d4]'
                  : 'cursor-pointer bg-[#48C9B0] hover:bg-[#3ab89f]'
                }`}
            >
              {savingPass ? 'Cambiando...' : 'Cambiar contraseña'}
            </button>
          </section>

          {/* ── Ayuda y feedback ── */}
          <section className="rounded-2xl border border-[#e8e8e8] bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <MessageSquarePlus size={16} className="text-[#48C9B0]" />
              <h2 className="text-sm font-semibold text-[#1D1E20]">Ayuda y feedback</h2>
            </div>
            <p className="mt-1 text-[12px] text-[#aaa]">
              Cuéntanos una idea, reporta un error o mándanos una nota. Leemos todo.
            </p>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('anfiora:open-feedback'))}
              className="mt-4 rounded-[10px] border border-[#e0e0e0] bg-white px-4 py-2 text-xs font-semibold text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
            >
              Enviar feedback
            </button>
          </section>

        </div>
      </main>
    </div>
  )
}