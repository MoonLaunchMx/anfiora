'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { EVENT_TYPES, CATEGORIES } from '@/lib/event-types'
import { Check, ArrowLeft } from 'lucide-react'
import { ROLES, Role } from '@/lib/roles'
import { Modal } from '@/app/components/ui/Modal'

interface OnboardingModalProps {
  open: boolean
  onCompleted: () => void
}

export function OnboardingModal({ open, onCompleted }: OnboardingModalProps) {
  const [step, setStep]       = useState<1 | 2>(1)
  const [role, setRole]       = useState<Role | null>(null)
  const [focus, setFocus]     = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const toggleFocus = (value: string) => {
    setFocus(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
  }

  const selectRole = (r: Role) => { setRole(r); setError(''); setStep(2) }

  const finish = async () => {
    if (!role) { setStep(1); return }
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }
    const { error: upErr } = await supabase
      .from('users').update({ role, event_focus: focus }).eq('id', user.id)
    if (upErr) {
      setError('No pudimos guardar tu información. Intenta de nuevo.')
      setLoading(false)
      return
    }
    localStorage.setItem('gf_welcomed', '1')
    onCompleted()
  }

  const focusTitle = role === 'planner' ? '¿Qué tipos de eventos manejas?' : '¿Qué tipo de evento organizas?'

  // El onboarding no se puede cerrar: sin onClose real, el overlay y Escape no hacen nada
  return (
    <Modal open={open} onClose={() => {}} size="xl">
      <div className="shrink-0 px-6 pt-6">
        <div className="flex items-center gap-2">
          <div className={'h-1.5 flex-1 rounded-full ' + (step >= 1 ? 'bg-[#48C9B0]' : 'bg-[#e0e0e0]')} />
          <div className={'h-1.5 flex-1 rounded-full ' + (step >= 2 ? 'bg-[#48C9B0]' : 'bg-[#e0e0e0]')} />
        </div>
      </div>

      <Modal.Body className="px-6 py-6">
        <AnimatePresence mode="wait">
                  {step === 1 ? (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.18 }}
                    >
                      <h2 className="text-xl font-bold text-[#1D1E20]">Te damos la bienvenida</h2>
                      <p className="mt-1.5 text-sm text-[#777]">Cuéntanos quién eres para personalizar tu experiencia.</p>

                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        {ROLES.map(r => {
                          const Icon = r.icon
                          return (
                            <button
                              key={r.value}
                              onClick={() => selectRole(r.value)}
                              className="group flex flex-col items-start gap-4 rounded-2xl border border-[#e8e8e8] bg-white p-6 text-left transition hover:border-[#48C9B0] hover:bg-[#f0fdfb] active:scale-[0.99]"
                            >
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f4f4f4] transition group-hover:bg-[#d0f5ec]">
                                <Icon size={20} className="text-[#888] transition group-hover:text-[#0F6E56]" />
                              </div>
                              <div>
                                <p className="text-base font-semibold text-[#1D1E20]">{r.label}</p>
                                <p className="mt-1 text-sm text-[#888]">{r.description}</p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.18 }}
                    >
                      <button
                        onClick={() => { setStep(1); setError('') }}
                        className="mb-4 flex items-center gap-1.5 text-xs text-[#888] transition hover:text-[#1D1E20]"
                      >
                        <ArrowLeft size={13} /> Atrás
                      </button>

                      <h2 className="text-xl font-bold text-[#1D1E20]">{focusTitle}</h2>
                      <p className="mt-1.5 text-sm text-[#777]">Puedes elegir varios. Es opcional.</p>

                      <div className="mt-6 flex flex-col gap-6">
                        {CATEGORIES.map(cat => (
                          <div key={cat.value}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#999]">{cat.label}</p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {EVENT_TYPES.filter(t => t.category === cat.value).map(type => {
                                const Icon = type.icon
                                const selected = focus.includes(type.value)
                                return (
                                  <button
                                    key={type.value}
                                    onClick={() => toggleFocus(type.value)}
                                    className={
                                      'relative flex items-center gap-2.5 rounded-xl border p-3 text-left transition active:scale-[0.98] ' +
                                      (selected
                                        ? 'border-[#48C9B0] bg-[#f0fdfb]'
                                        : 'border-[#e8e8e8] bg-white hover:border-[#48C9B0]')
                                    }
                                  >
                                    <Icon size={16} className={selected ? 'text-[#0F6E56]' : 'text-[#999]'} />
                                    <span className="text-sm font-medium text-[#1D1E20]">{type.label}</span>
                                    {selected && (
                                      <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#48C9B0]">
                                        <Check size={11} className="text-white" />
                                      </span>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {error && (
                        <div className="mt-5 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2.5 text-xs text-[#cc3333]">
                          {error}
                        </div>
                      )}

                      <button
                        onClick={finish}
                        disabled={loading}
                        className="mt-8 w-full rounded-xl bg-[#48C9B0] py-3 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-60"
                      >
                        {loading ? 'Guardando...' : 'Continuar'}
                      </button>
                    </motion.div>
                  )}
        </AnimatePresence>
      </Modal.Body>
    </Modal>
  )
}
