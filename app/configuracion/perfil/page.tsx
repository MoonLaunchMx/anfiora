'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ChevronDown, MessageSquarePlus, Tags, ChevronRight, LogOut } from 'lucide-react'
import { ROLES, getRole, Role } from '@/lib/roles'
import PhoneInput from '@/app/components/ui/PhoneInput'

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

function PassInput({
  icon, value, onChange, placeholder, show, onToggleShow,
}: {
  icon: React.ReactNode
  value: string
  onChange: (v: string) => void
  placeholder?: string
  show: boolean
  onToggleShow: () => void
}) {
  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 text-[#bbb]">{icon}</span>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#e8e8e8] bg-white py-2.5 pl-9 pr-10 text-sm text-[#1D1E20] outline-none transition placeholder:text-[#c0c0c0] focus:border-[#48C9B0] focus:ring-2 focus:ring-[#48C9B0]/20"
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3 cursor-pointer border-none bg-transparent text-[#bbb] transition-colors hover:text-[#888]"
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

export default function PerfilPage() {
  const router = useRouter()

  const [userId, setUserId] = useState('')
  const [email, setEmail]   = useState('')
  const [name, setName]     = useState('')
  const [phone, setPhone]   = useState('')
  const [loading, setLoading] = useState(true)

  const [role, setRole]               = useState<string>('')
  const [editingRole, setEditingRole] = useState(false)
  const [savingRole, setSavingRole]   = useState(false)
  const [roleMsg, setRoleMsg]         = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [showPasswordForm, setShowPasswordForm] = useState(false)
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

      const { data } = await supabase
        .from('users')
        .select('full_name, phone, role')
        .eq('id', user.id)
        .single()

      if (data) {
        setName(data.full_name || '')
        setPhone(data.phone || '')
        setRole(data.role || '')
      }

      setLoading(false)
    }
    load()
  }, [router])

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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const currentRole = getRole(role)
  const CurrentIcon = currentRole?.icon

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-[#1D1E20]">Perfil</h3>
          <p className="text-[13px] text-[#666]">Tus datos personales. Se ven en todos los workspaces donde participas.</p>
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

      {roleMsg && <Toast type={roleMsg.type} message={roleMsg.text} />}

      <div className="grid max-w-[900px] grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#666]">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ana García"
            className="rounded-lg border border-[#e8e8e8] px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition placeholder:text-[#c0c0c0] focus:border-[#48C9B0] focus:ring-2 focus:ring-[#48C9B0]/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#666]">Teléfono</label>
          <PhoneInput value={phone} onChange={setPhone} placeholder="55 1234 5678" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#666]">Correo</label>
          <div className="rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2.5 text-sm text-[#999]">{email}</div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#666]">Contraseña</label>
          <button
            type="button"
            onClick={() => setShowPasswordForm(p => !p)}
            className="flex items-center justify-between rounded-lg border border-[#e8e8e8] px-3 py-2.5 text-sm transition hover:border-[#48C9B0]"
          >
            <span className="text-[#999]">••••••••••</span>
            <span className="font-semibold text-[#48C9B0]">Cambiar</span>
          </button>
        </div>
      </div>

      {profileMsg && <div className="max-w-[900px]"><Toast type={profileMsg.type} message={profileMsg.text} /></div>}

      <button
        onClick={handleSaveProfile}
        disabled={savingProfile}
        className={`w-fit rounded-lg border-none px-6 py-2.5 text-sm font-semibold text-white transition-colors
          ${savingProfile
            ? 'cursor-not-allowed bg-[#9ee0d4]'
            : 'cursor-pointer bg-[#48C9B0] hover:bg-[#3ab89f]'
          }`}
      >
        {savingProfile ? 'Guardando...' : 'Guardar'}
      </button>

      {showPasswordForm && (
        <div className="max-w-[900px] rounded-xl border border-[#e8e8e8] p-5">
          <h4 className="mb-1 text-sm font-semibold text-[#1D1E20]">Cambiar contraseña</h4>
          <p className="mb-4 text-[12px] text-[#999]">Mínimo 8 caracteres</p>

          <div className="flex flex-col gap-4">
            <PassInput icon={<Lock size={15} />} value={currentPass} onChange={setCurrentPass} placeholder="Contraseña actual" show={showCurrent} onToggleShow={() => setShowCurrent(p => !p)} />
            <PassInput icon={<Lock size={15} />} value={newPass} onChange={setNewPass} placeholder="Nueva contraseña" show={showNew} onToggleShow={() => setShowNew(p => !p)} />
            <PassInput icon={<Lock size={15} />} value={confirmPass} onChange={setConfirmPass} placeholder="Confirmar nueva contraseña" show={showConfirm} onToggleShow={() => setShowConfirm(p => !p)} />
          </div>

          {passMsg && <div className="mt-4"><Toast type={passMsg.type} message={passMsg.text} /></div>}

          <button
            onClick={handleChangePassword}
            disabled={savingPass || !currentPass || !newPass || !confirmPass}
            className={`mt-5 rounded-lg border-none px-6 py-2.5 text-sm font-semibold text-white transition-colors
              ${savingPass || !currentPass || !newPass || !confirmPass
                ? 'cursor-not-allowed bg-[#9ee0d4]'
                : 'cursor-pointer bg-[#48C9B0] hover:bg-[#3ab89f]'
              }`}
          >
            {savingPass ? 'Cambiando...' : 'Cambiar contraseña'}
          </button>
        </div>
      )}

      <div className="flex max-w-[900px] flex-col gap-3 pt-2">
        <p className="text-[13px] font-semibold text-[#1D1E20]">Sesión</p>
        <div className="flex items-center justify-between rounded-xl border border-[#e8e8e8] px-4 py-3.5">
          <div className="flex items-center gap-3">
            <LogOut size={16} className="text-[#888]" />
            <p className="text-sm font-medium text-[#1D1E20]">Cerrar sesión en este dispositivo</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-[#e8e8e8] px-3.5 py-1.5 text-[13px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]"
          >
            Salir
          </button>
        </div>
      </div>

      <button
        onClick={() => router.push('/ajustes/categorias')}
        className="flex max-w-[900px] items-center justify-between gap-4 rounded-xl border border-[#e8e8e8] p-4 text-left transition hover:border-[#48C9B0]"
      >
        <div className="flex items-center gap-3">
          <Tags size={16} className="text-[#48C9B0]" />
          <div>
            <p className="text-sm font-semibold text-[#1D1E20]">Mis categorías</p>
            <p className="text-[11px] text-[#999]">Cómo agrupas proveedores y presupuesto</p>
          </div>
        </div>
        <ChevronRight size={16} className="shrink-0 text-[#bbb]" />
      </button>

      <div className="max-w-[900px] rounded-xl border border-[#e8e8e8] p-4">
        <div className="flex items-center gap-2">
          <MessageSquarePlus size={16} className="text-[#48C9B0]" />
          <h4 className="text-sm font-semibold text-[#1D1E20]">Ayuda y feedback</h4>
        </div>
        <p className="mt-1 text-[12px] text-[#999]">
          Cuéntanos una idea, reporta un error o mándanos una nota. Leemos todo.
        </p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('anfiora:open-feedback'))}
          className="mt-3 rounded-lg border border-[#e0e0e0] bg-white px-4 py-2 text-xs font-semibold text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
        >
          Enviar feedback
        </button>
      </div>
    </div>
  )
}
