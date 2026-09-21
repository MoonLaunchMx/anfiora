'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Aviso } from '@/app/components/ui/Aviso'
import { Modal } from '@/app/components/ui/Modal'
import { Lock, Eye, EyeOff, ChevronDown, X } from 'lucide-react'
import { ROLES, getRole, Role } from '@/lib/roles'
import PhoneInput from '@/app/components/ui/PhoneInput'
import { borrarImagenAnterior, subirImagen } from '@/lib/workspace/subir'
import { usuarioActual } from '@/lib/workspace/sesion'

function inicialesDe(texto: string): string {
  const partes = texto.trim().split(/[\s@.]+/).filter(Boolean)
  if (partes.length === 0) return '??'
  return partes.slice(0, 2).map(p => p[0]!.toUpperCase()).join('')
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
  const [enviandoRecuperar, setEnviandoRecuperar] = useState(false)
  // El enlace de recuperar solo se ofrece DESPUES de que la contraseña actual
  // fallo: antes es ruido para quien si se la sabe.
  const [falloActual, setFalloActual] = useState(false)
  const [confirmarRecuperar, setConfirmarRecuperar] = useState(false)

  const [avatar, setAvatar]         = useState<string | null>(null)
  const [subiendoFoto, setSubiendo] = useState(false)
  const [fotoMsg, setFotoMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const inputFoto = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const user = await usuarioActual()
      if (!user) { router.replace('/'); return }

      setUserId(user.id)
      setEmail(user.email)

      // Un solo viaje. `avatar_url` llega con la migracion del Tramo 5, asi que
      // si la columna no existe todavia se reintenta sin ella. Dos consultas en
      // serie alargaban la ventana donde el candado de sesion de Supabase se
      // pelea y dejaba la pantalla colgada.
      const conFoto = await supabase.from('users').select('full_name, phone, role, avatar_url').eq('id', user.id).maybeSingle()
      const fila = conFoto.error
        ? (await supabase.from('users').select('full_name, phone, role').eq('id', user.id).maybeSingle()).data
        : conFoto.data

      if (fila) {
        const f = fila as { full_name?: string | null; phone?: string | null; role?: string | null; avatar_url?: string | null }
        setName(f.full_name || '')
        setPhone(f.phone || '')
        setRole(f.role || '')
        setAvatar(f.avatar_url ?? null)
      }
    }
    // La espera termina pase lo que pase: si la carga revienta, el formulario
    // se dibuja vacio y se puede reintentar, en vez de quedarse en "Cargando".
    load()
      .catch(e => console.error('No se pudo cargar el perfil:', e))
      .finally(() => setLoading(false))
  }, [router])

  const guardarFoto = async (url: string | null) => {
    const anterior = avatar
    const { error } = await supabase.from('users').update({ avatar_url: url }).eq('id', userId)
    if (error) {
      setFotoMsg({ type: 'error', text: 'No se pudo guardar la foto. Intenta de nuevo.' })
      return false
    }
    setAvatar(url)
    await borrarImagenAnterior('avatars', userId, anterior)
    return true
  }

  const handleFoto = async (file: File | undefined) => {
    if (!file) return
    setSubiendo(true)
    setFotoMsg(null)
    const { url, error } = await subirImagen('avatars', userId, file)
    if (error) {
      setFotoMsg({ type: 'error', text: error })
      setSubiendo(false)
      return
    }
    if (await guardarFoto(url!)) setFotoMsg({ type: 'success', text: 'Foto actualizada' })
    setSubiendo(false)
  }

  const handleQuitarFoto = async () => {
    setSubiendo(true)
    setFotoMsg(null)
    if (await guardarFoto(null)) setFotoMsg({ type: 'success', text: 'Foto quitada' })
    setSubiendo(false)
  }

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

  // Cerrar tambien limpia: si vuelve a abrir, no se encuentra su intento
  // anterior a medias ni el error de la vez pasada.
  const cerrarCambioPass = () => {
    setShowPasswordForm(false)
    setCurrentPass(''); setNewPass(''); setConfirmPass('')
    setPassMsg(null)
    setFalloActual(false)
  }

  // La salida cuando no recuerda la actual: el mismo correo de recuperacion de
  // la pantalla de entrar, pedido desde aqui. No se dice si el correo existe o
  // no, aunque aqui ya sabemos quien es: el mensaje es el mismo siempre.
  const recuperarPass = async () => {
    setEnviandoRecuperar(true)
    setPassMsg(null)
    setConfirmarRecuperar(false)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    })
    setPassMsg(error
      ? { type: 'error', text: 'No se pudo enviar el correo. Intenta de nuevo en un momento.' }
      : { type: 'success', text: `Te mandamos un correo a ${email} con el enlace para ponerte una nueva.` })
    setEnviandoRecuperar(false)
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
      setFalloActual(true)
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

      {roleMsg && <Aviso tono={roleMsg.type === 'success' ? 'exito' : 'error'} mensaje={roleMsg.text} />}

      <div className="flex max-w-[900px] flex-wrap items-center gap-4">
        {/* Mismo gesto que el logo del workspace: el cuadro ES el control, y al
            pasar el mouse dice que se puede cambiar. */}
        <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => inputFoto.current?.click()}
          disabled={subiendoFoto}
          title={avatar ? 'Cambiar tu foto' : 'Subir tu foto'}
          className="group relative block h-16 w-16 overflow-hidden rounded-full"
        >
          {avatar
            ? <img src={avatar} alt="Tu foto" className="h-full w-full object-cover" />
            : (
              <span className="flex h-full w-full items-center justify-center bg-[#e1f5ee] text-lg font-semibold text-[#04342C]">
                {inicialesDe(name || email)}
              </span>
            )}
          <span className="absolute inset-0 hidden items-center justify-center bg-black/45 text-[10px] font-semibold text-white group-hover:flex">
            {subiendoFoto ? 'Subiendo' : 'Cambiar'}
          </span>
        </button>
        {avatar && !subiendoFoto && (
          <button
            type="button"
            onClick={handleQuitarFoto}
            title="Quitar la foto"
            className="absolute -right-1 -top-1 flex h-[20px] w-[20px] items-center justify-center rounded-full border border-[#e8e8e8] bg-white text-[#888] shadow-sm transition hover:text-[#cc3333]"
          >
            <X size={12} />
          </button>
        )}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-[#1D1E20]">Tu foto</p>
          <p className="text-[11.5px] text-[#999]">Si no subes una, se usan tus iniciales. JPG, PNG o WEBP hasta 4 MB.</p>
          <div className="mt-1 flex flex-wrap gap-2">
          </div>
        </div>
        <input
          ref={inputFoto}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => { handleFoto(e.target.files?.[0]); e.target.value = '' }}
        />
      </div>

      {fotoMsg && <div className="max-w-[900px]"><Aviso tono={fotoMsg.type === 'success' ? 'exito' : 'error'} mensaje={fotoMsg.text} /></div>}

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

      {profileMsg && <div className="max-w-[900px]"><Aviso tono={profileMsg.type === 'success' ? 'exito' : 'error'} mensaje={profileMsg.text} /></div>}

      <button
        onClick={handleSaveProfile}
        disabled={savingProfile}
        className={`w-fit rounded-lg border-none px-6 py-2.5 text-sm font-semibold text-white transition-colors
          ${savingProfile
            ? 'cursor-not-allowed bg-[#9ee0d4]'
            : 'cursor-pointer bg-[#48C9B0] hover:bg-[#3ab89f]'
          }`}
      >
        {savingProfile ? 'Guardando' : 'Guardar'}
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

          {passMsg && <div className="mt-4"><Aviso tono={passMsg.type === 'success' ? 'exito' : 'error'} mensaje={passMsg.text} /></div>}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={handleChangePassword}
              disabled={savingPass || !currentPass || !newPass || !confirmPass}
              className={`rounded-lg border-none px-6 py-2.5 text-sm font-semibold text-white transition-colors
                ${savingPass || !currentPass || !newPass || !confirmPass
                  ? 'cursor-not-allowed bg-[#9ee0d4]'
                  : 'cursor-pointer bg-[#48C9B0] hover:bg-[#3ab89f]'
                }`}
            >
              {savingPass ? 'Cambiando' : 'Cambiar contraseña'}
            </button>
            <button
              type="button"
              onClick={cerrarCambioPass}
              className="rounded-lg border border-[#e8e8e8] px-4 py-2.5 text-sm font-medium text-[#888] transition hover:text-[#555]"
            >
              Cancelar
            </button>
          </div>

          {/* Solo aparece cuando la actual fallo. Ofrecerlo antes es ruido para
              quien si se la sabe. */}
          {falloActual && (
            <button
              type="button"
              onClick={() => setConfirmarRecuperar(true)}
              className="mt-3 text-[12.5px] font-medium text-[#1a9e88] transition hover:text-[#48C9B0]"
            >
              ¿No recuerdas tu contraseña actual?
            </button>
          )}
        </div>
      )}

      {/* Mandar un correo es una accion que sale de la app: se confirma antes,
          y se dice a que direccion va. */}
      <Modal open={confirmarRecuperar} onClose={() => setConfirmarRecuperar(false)} size="sm">
        <Modal.Header
          title="Recuperar tu contraseña"
          subtitle="Te mandamos un enlace para ponerte una nueva."
        />
        <Modal.Body>
          <p className="text-[13.5px] leading-relaxed text-[#666]">
            El correo va a <span className="font-semibold text-[#1D1E20]">{email}</span>. El enlace sirve una vez y caduca en una hora.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={() => setConfirmarRecuperar(false)}
            className="ml-auto rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#888] transition hover:bg-[#f5f5f5]"
          >
            Cancelar
          </button>
          <button
            onClick={recuperarPass}
            disabled={enviandoRecuperar}
            className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-60"
          >
            {enviandoRecuperar ? 'Enviando' : 'Enviar el correo'}
          </button>
        </Modal.Footer>
      </Modal>

      <div className="flex max-w-[900px] flex-col gap-2.5 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#999]">Más opciones</p>
        {/* Categorias salio de aqui: es una pantalla entera, no una accion, y
            ademas el catalogo es del workspace. Vive en el nav lateral. */}
        <div className="overflow-hidden rounded-xl border border-[#e8e8e8]">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <span>
              <span className="block text-sm font-semibold text-[#1D1E20]">Ayuda y feedback</span>
              <span className="block text-[11.5px] text-[#999]">Una idea, un error o una nota. Leemos todo</span>
            </span>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('anfiora:open-feedback'))}
              className="shrink-0 rounded-lg border border-[#e8e8e8] px-3.5 py-1.5 text-[13px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]"
            >
              Enviar
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-[#e8e8e8] px-4 py-3.5">
            <span>
              <span className="block text-sm font-semibold text-[#1D1E20]">Cerrar sesión</span>
              <span className="block text-[11.5px] text-[#999]">En este dispositivo</span>
            </span>
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-lg border border-[#e8e8e8] px-3.5 py-1.5 text-[13px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]"
            >
              Salir
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
