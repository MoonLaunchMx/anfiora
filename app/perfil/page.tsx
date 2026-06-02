'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { User, Phone, Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import { ORGANIZADOR_PLANS } from '@/lib/pricing'
import { normalizePlan } from '@/lib/entitlements'

type PlanInfo = {
  label: string
  color: string
  bg: string
  border: string
}

const PLAN_STYLES: Record<string, PlanInfo> = {
  free:   { label: 'Free',   color: '#888',    bg: '#f8f8f8',  border: '#e0e0e0' },
  solo:   { label: 'Solo',   color: '#1a9e88', bg: '#f0fdfb',  border: '#a0e0d0' },
  studio: { label: 'Studio', color: '#1a9e88', bg: '#f0fdfb',  border: '#a0e0d0' },
  agency: { label: 'Agency', color: '#7c3aed', bg: '#f5f3ff',  border: '#c4b5fd' },
  pro:    { label: 'Pro',    color: '#1a9e88', bg: '#f0fdfb',  border: '#a0e0d0' },
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

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }

      setUserId(user.id)
      setEmail(user.email || '')

      // Jalar perfil de tabla users
      const { data } = await supabase
        .from('users')
        .select('full_name, phone, plan')
        .eq('id', user.id)
        .single()

      if (data) {
        setName(data.full_name || '')
        setPhone(data.phone || '')
        setPlan(data.plan || 'free')
      }

      setLoading(false)
    }
    load()
  }, [router])

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

  const normPlan = normalizePlan(plan)
  const planStyle = PLAN_STYLES[normPlan] || PLAN_STYLES.free
  const orgPlan = ORGANIZADOR_PLANS.find(p => p.id === normPlan)
  const planDesc = orgPlan ? `${orgPlan.activeEvents} eventos activos · invitados ilimitados` : 'Tu evento, hasta 50 invitados'

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0] font-sans text-[#1D1E20]">

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#e8e8e8] bg-white">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <button onClick={() => router.push('/dashboard')} className="shrink-0">
            <Image src="/images/Logo-010526newest.svg" alt="Anfiora" width={110} height={45} priority className="object-contain" />
          </button>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-xs text-[#888] transition hover:text-[#48C9B0]"
          >
            <ArrowLeft size={14} />
            Volver
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">

        <div className="mb-6">
          <h1 className="text-xl font-bold text-[#1D1E20] sm:text-2xl">Mi perfil</h1>
          <p className="mt-0.5 text-sm text-[#888]">Gestiona tu información y acceso</p>
        </div>

        <div className="flex flex-col gap-4">

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
                  <p className="text-[11px] text-[#aaa]">{planDesc}</p>
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
                <InputIcon
                  icon={<Phone size={15} />}
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  placeholder="+52 55 1234 5678"
                />
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

        </div>
      </main>
    </div>
  )
}