'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

type View = 'loading' | 'form' | 'success' | 'error'

export default function ResetPasswordPage() {
  const [view, setView]               = useState<View>('loading')
  const [password, setPassword]       = useState('')
  const [confirm, setConfirm]         = useState('')
  const [showPass, setShowPass]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setView('form')
    })
    const timeout = setTimeout(() => {
      setView(prev => prev === 'loading' ? 'error' : prev)
    }, 8000)
    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  const handleReset = async () => {
    setError('')
    if (password.length < 8) { setError('La contraseña debe tener mínimo 8 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError('Hubo un problema. Intenta solicitar un nuevo enlace.')
    else setView('success')
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f5f0] px-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-[440px] rounded-[20px] border border-[#e8e8e8] bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.10)]"
      >
        <div className="mb-7 flex justify-center">
          <Image src="/images/isotipoylogo.svg" alt="Anfiora" width={140} height={56} priority className="object-contain" />
        </div>

        {/* Loading */}
        {view === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e0e0e0] border-t-[#48C9B0]" />
            <p className="text-sm text-[#888]">Verificando enlace...</p>
          </div>
        )}

        {/* Error */}
        {view === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 py-4 text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#ffc0c0] bg-[#fff0f0]">
              <AlertCircle size={26} className="text-[#cc3333]" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#1D1E20]">Enlace inválido o expirado</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#777]">
                Este enlace ya no es válido. Solicita uno nuevo desde la pantalla de inicio de sesión.
              </p>
            </div>
            <a href="/" className="mt-2 inline-block rounded-[10px] bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3ab89f]">
              Volver al inicio
            </a>
          </motion.div>
        )}

        {/* Éxito */}
        {view === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 py-4 text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#a0e0c0] bg-[#f0fff6]">
              <CheckCircle size={26} className="text-[#48C9B0]" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#1D1E20]">Contraseña actualizada</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#777]">
                Tu contraseña fue cambiada exitosamente. Ya puedes iniciar sesión.
              </p>
            </div>
            <a href="/dashboard" className="mt-2 inline-block rounded-[10px] bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3ab89f]">
              Ir al dashboard
            </a>
          </motion.div>
        )}

        {/* Formulario */}
        {view === 'form' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-5"
          >
            <div>
              <p className="text-[15px] font-semibold text-[#1D1E20]">Nueva contraseña</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#888]">Elige una contraseña segura de mínimo 8 caracteres.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#555]">Contraseña</label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3 text-[#bbb]"><Lock size={15} /></span>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-[10px] border border-[#e0e0e0] bg-[#f8f8f8] py-2.5 pl-9 pr-10 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0] focus:ring-2 focus:ring-[#48C9B0]/20 placeholder:text-[#c0c0c0]"
                />
                <button onClick={() => setShowPass(!showPass)} className="absolute right-3 cursor-pointer border-none bg-transparent text-[#bbb] transition-colors hover:text-[#888]">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#555]">Confirmar contraseña</label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3 text-[#bbb]"><Lock size={15} /></span>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  className="w-full rounded-[10px] border border-[#e0e0e0] bg-[#f8f8f8] py-2.5 pl-9 pr-10 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0] focus:ring-2 focus:ring-[#48C9B0]/20 placeholder:text-[#c0c0c0]"
                />
                <button onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 cursor-pointer border-none bg-transparent text-[#bbb] transition-colors hover:text-[#888]">
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2.5 text-xs text-[#cc3333]">
                {error}
              </div>
            )}

            <button
              onClick={handleReset}
              disabled={loading || !password || !confirm}
              className={`w-full rounded-[10px] border-none py-3 text-sm font-semibold text-white transition-colors ${
                loading || !password || !confirm
                  ? 'cursor-not-allowed bg-[#9ee0d4]'
                  : 'cursor-pointer bg-[#48C9B0] hover:bg-[#3ab89f]'
              }`}
            >
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}