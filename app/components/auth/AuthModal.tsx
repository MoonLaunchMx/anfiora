'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft, CheckCircle } from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { getAttribution } from '@/lib/attribution'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTab?: 'login' | 'register'
  lang?: 'es' | 'en'
}

type View = 'login' | 'register' | 'forgot' | 'forgot_sent'

const i18n = {
  es: {
    login: 'Iniciar sesión',
    register: 'Registrarse',
    name: 'Nombre completo',
    namePlaceholder: 'Ana García',
    email: 'Correo electrónico',
    emailPlaceholder: 'ana@ejemplo.com',
    password: 'Contraseña',
    phone: 'WhatsApp (opcional)',
    phonePlaceholder: '+52 55 1234 5678',
    phoneHint: 'Lo usaremos para verificación en el futuro',
    submit_login: 'Entrar',
    submit_register: 'Crear cuenta',
    submit_forgot: 'Enviar instrucciones',
    loading: 'Un momento...',
    error_login: 'Correo o contraseña incorrectos',
    error_register: 'Hubo un problema al crear tu cuenta',
    error_forgot: 'No encontramos ese correo',
    success_register: 'Cuenta creada. Revisa tu correo para confirmar tu cuenta.',
    forgot_title: 'Recuperar contraseña',
    forgot_desc: 'Ingresa tu correo y te enviamos un enlace para restablecer tu contraseña.',
    forgot_sent_title: '¡Listo! Revisa tu correo',
    forgot_sent_desc: 'Si ese correo está registrado, recibirás un enlace en los próximos minutos. Revisa también tu carpeta de spam.',
    back_to_login: 'Volver al inicio de sesión',
    forgot_link: '¿Olvidaste tu contraseña?',
    password_hint: 'Mínimo 8 caracteres',
  },
  en: {
    login: 'Log in',
    register: 'Sign up',
    name: 'Full name',
    namePlaceholder: 'Ana García',
    email: 'Email',
    emailPlaceholder: 'ana@example.com',
    password: 'Password',
    phone: 'WhatsApp (optional)',
    phonePlaceholder: '+1 555 123 4567',
    phoneHint: "We'll use this for verification in the future",
    submit_login: 'Log in',
    submit_register: 'Create account',
    submit_forgot: 'Send instructions',
    loading: 'Just a moment...',
    error_login: 'Incorrect email or password',
    error_register: 'Something went wrong creating your account',
    error_forgot: "We couldn't find that email",
    success_register: 'Account created. Check your email to confirm your account.',
    forgot_title: 'Reset password',
    forgot_desc: "Enter your email and we'll send you a link to reset your password.",
    forgot_sent_title: 'Check your inbox',
    forgot_sent_desc: "If that email is registered, you'll receive a link shortly. Check your spam folder too.",
    back_to_login: 'Back to log in',
    forgot_link: 'Forgot your password?',
    password_hint: 'Minimum 8 characters',
  },
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
  icon, type, value, onChange, placeholder, onKeyDown, rightSlot,
}: {
  icon: React.ReactNode
  type: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  onKeyDown?: (e: React.KeyboardEvent) => void
  rightSlot?: React.ReactNode
}) {
  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 text-[#bbb]">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        className="w-full rounded-[10px] border border-[#e0e0e0] bg-[#f8f8f8] py-2.5 pl-9 pr-10 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0] focus:ring-2 focus:ring-[#48C9B0]/20 placeholder:text-[#c0c0c0]"
      />
      {rightSlot && <span className="absolute right-3">{rightSlot}</span>}
    </div>
  )
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2.5 text-xs text-[#cc3333]">
      {children}
    </div>
  )
}

function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#a0e0c0] bg-[#f0fff6] px-3 py-2.5 text-xs text-[#2a7a50]">
      {children}
    </div>
  )
}

export default function AuthModal({ isOpen, onClose, defaultTab = 'login', lang = 'es' }: AuthModalProps) {
  const [view, setView]                 = useState<View>(defaultTab)
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [name, setName]                 = useState('')
  const [phone, setPhone]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accepted, setAccepted]         = useState(false)

  const t = i18n[lang]

  useEffect(() => { setView(defaultTab) }, [defaultTab])

  const reset = () => {
    setEmail(''); setPassword(''); setName(''); setPhone('')
    setError(''); setSuccess(''); setShowPassword(false); setAccepted(false)
  }

  const handleClose = () => { reset(); onClose() }

  const switchView = (v: View) => { setError(''); setSuccess(''); setView(v) }

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(t.error_login)
    else window.location.href = '/dashboard'
    setLoading(false)
  }

  const handleRegister = async () => {
    if (!name || !email || !password) return
    if (password.length < 8) { setError(t.password_hint); return }
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: name } },
    })
    if (error) {
      setError(t.error_register)
    } else {
      if (data.user) {
        if (phone) {
          await supabase.from('users').update({ phone, full_name: name }).eq('id', data.user.id)
        }
        const attr = getAttribution()
        if (attr) {
          await supabase.from('users').update({
            acquisition_source: attr.acquisition_source,
            utm_source:         attr.utm_source,
            utm_medium:         attr.utm_medium,
            utm_campaign:       attr.utm_campaign,
            utm_content:        attr.utm_content,
            referrer_domain:    attr.referrer_domain,
            device_type:        attr.device_type,
            acquired_at:        attr.acquired_at,
          }).eq('id', data.user.id)
        }
      }
      if (data.session) {
        await fetch('/api/legal/accept', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + data.session.access_token },
        }).catch(() => {})
        window.location.href = '/dashboard'
      } else {
        setSuccess(t.success_register)
      }
    }
    setLoading(false)
  }

  const handleForgot = async () => {
    if (!email) return
    setLoading(true); setError('')
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    })
    // Siempre mostramos éxito — no revelamos si el email existe (seguridad)
    setView('forgot_sent')
    setLoading(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    if (view === 'login') handleLogin()
    else if (view === 'register') handleRegister()
    else if (view === 'forgot') handleForgot()
  }

  const renderContent = () => {
    if (view === 'forgot_sent') {
      return (
        <motion.div
          key="forgot_sent"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 py-4 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#a0e0c0] bg-[#f0fff6]">
            <CheckCircle size={26} className="text-[#48C9B0]" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[#1D1E20]">{t.forgot_sent_title}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#777]">{t.forgot_sent_desc}</p>
          </div>
          <button
            onClick={() => switchView('login')}
            className="mt-2 flex cursor-pointer items-center gap-1.5 border-none bg-transparent text-[13px] font-medium text-[#48C9B0] transition-colors hover:text-[#3ab89f]"
          >
            <ArrowLeft size={14} />
            {t.back_to_login}
          </button>
        </motion.div>
      )
    }

    if (view === 'forgot') {
      return (
        <motion.div
          key="forgot"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-5"
        >
          <div>
            <p className="text-[15px] font-semibold text-[#1D1E20]">{t.forgot_title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#888]">{t.forgot_desc}</p>
          </div>
          <Field label={t.email}>
            <InputIcon
              icon={<Mail size={15} />}
              type="email"
              value={email}
              onChange={setEmail}
              placeholder={t.emailPlaceholder}
              onKeyDown={handleKey}
            />
          </Field>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <button
            onClick={handleForgot}
            disabled={loading || !email}
            className={`w-full rounded-[10px] border-none py-3 text-sm font-semibold text-white transition-colors ${
              loading || !email
                ? 'cursor-not-allowed bg-[#9ee0d4]'
                : 'cursor-pointer bg-[#48C9B0] hover:bg-[#3ab89f]'
            }`}
          >
            {loading ? t.loading : t.submit_forgot}
          </button>
          <button
            onClick={() => switchView('login')}
            className="flex cursor-pointer items-center justify-center gap-1.5 border-none bg-transparent text-[13px] text-[#aaa] transition-colors hover:text-[#555]"
          >
            <ArrowLeft size={13} />
            {t.back_to_login}
          </button>
        </motion.div>
      )
    }

    return (
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        {/* Tabs */}
        <div className="flex rounded-[10px] bg-[#f2f2f2] p-1">
          {(['login', 'register'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => switchView(tab)}
              className={`flex-1 cursor-pointer rounded-[7px] border-none py-2 text-[13px] transition-all ${
                view === tab
                  ? 'bg-[#48C9B0] font-semibold text-white shadow-sm'
                  : 'bg-transparent font-normal text-[#888] hover:text-[#555]'
              }`}
            >
              {tab === 'login' ? t.login : t.register}
            </button>
          ))}
        </div>

        {/* Campos */}
        <div className="flex flex-col gap-3.5">
          {view === 'register' && (
            <Field label={t.name}>
              <InputIcon
                icon={<User size={15} />}
                type="text"
                value={name}
                onChange={setName}
                placeholder={t.namePlaceholder}
                onKeyDown={handleKey}
              />
            </Field>
          )}
          <Field label={t.email}>
            <InputIcon
              icon={<Mail size={15} />}
              type="email"
              value={email}
              onChange={setEmail}
              placeholder={t.emailPlaceholder}
              onKeyDown={handleKey}
            />
          </Field>
          <Field label={t.password} hint={view === 'register' ? t.password_hint : undefined}>
            <InputIcon
              icon={<Lock size={15} />}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              onKeyDown={handleKey}
              rightSlot={
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="cursor-pointer border-none bg-transparent text-[#bbb] transition-colors hover:text-[#888]"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />
          </Field>
          {view === 'register' && (
            <Field label={t.phone} hint={t.phoneHint}>
              <InputIcon
                icon={<Phone size={15} />}
                type="tel"
                value={phone}
                onChange={setPhone}
                placeholder={t.phonePlaceholder}
                onKeyDown={handleKey}
              />
            </Field>
          )}
        </div>

        {view === 'register' && (
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

        {view === 'login' && (
          <button
            onClick={() => switchView('forgot')}
            className="self-end cursor-pointer border-none bg-transparent text-[12px] text-[#aaa] transition-colors hover:text-[#48C9B0]"
          >
            {t.forgot_link}
          </button>
        )}

        {error && <ErrorBanner>{error}</ErrorBanner>}
        {success && <SuccessBanner>{success}</SuccessBanner>}

        <button
          onClick={view === 'login' ? handleLogin : handleRegister}
          disabled={loading || (view === 'register' && !accepted)}
          className={`w-full rounded-[10px] border-none py-3 text-sm font-semibold text-white transition-colors ${
            loading || (view === 'register' && !accepted)
              ? 'cursor-not-allowed bg-[#9ee0d4]'
              : 'cursor-pointer bg-[#48C9B0] hover:bg-[#3ab89f]'
          }`}
        >
          {loading ? t.loading : view === 'login' ? t.submit_login : t.submit_register}
        </button>
      </motion.div>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 z-[100] bg-black/[0.45]"
          />
          <div className="pointer-events-none fixed inset-0 z-[101] flex items-center justify-center px-4">
            <motion.div
              key="modal"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="pointer-events-auto w-full max-w-[460px]"
            >
              <div className="relative rounded-[20px] border border-[#e8e8e8] bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.12)]">

                {/* Botón cerrar */}
                <button
                  onClick={handleClose}
                  className="absolute right-4 top-4 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#e8e8e8] bg-transparent text-[#bbb] transition hover:bg-[#f5f5f5] hover:text-[#555]"
                >
                  ✕
                </button>

              {/* Logo completo */}
              <div className="mb-6 flex justify-center">
                <Image src="/images/Logo-010526newest.svg" alt="Anfiora" width={140} height={56} priority className="object-contain" />
              </div>

                <AnimatePresence mode="wait">
                  {renderContent()}
                </AnimatePresence>

              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}