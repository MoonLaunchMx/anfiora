'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle } from 'lucide-react'

interface ContactSalesModalProps {
  isOpen: boolean
  onClose: () => void
  plan?: string // 'anfitrion' | 'organizador' (de donde se abrio)
}

const EMPLEADOS = ['1-5', '6-20', '21-50', 'Más de 50']
const EVENTOS = ['1-10 al año', '11-30 al año', '31-60 al año', 'Más de 60 al año']
const INVITADOS = ['Menos de 100', '100-300', '300-600', 'Más de 600']
const FUENTES = ['Google', 'Instagram o redes', 'Recomendación', 'Evento o feria', 'Otro']

export default function ContactSalesModal({ isOpen, onClose, plan }: ContactSalesModalProps) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [empleados, setEmpleados] = useState('')
  const [eventos, setEventos] = useState('')
  const [invitados, setInvitados] = useState('')
  const [fuente, setFuente] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setNombre(''); setEmail(''); setEmpresa(''); setEmpleados('')
    setEventos(''); setInvitados(''); setFuente(''); setMensaje(''); setSubmitted(false); setError('')
  }

  const close = () => { reset(); onClose() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!nombre.trim() || !email.trim()) {
      setError('Nombre y correo son obligatorios')
      return
    }
    setSubmitting(true)
    // TODO (Fase 2): enviar a destino real (Supabase lead table / correo / CRM).
    // Por ahora es un stub que confirma la recepcion en el cliente.
    const payload = { nombre, email, empresa, empleados, eventos, invitados, fuente, mensaje, plan }
    console.log('[contacto Sin Limites]', payload)
    await new Promise(r => setTimeout(r, 600))
    setSubmitting(false)
    setSubmitted(true)
  }

  const inputClass =
    'w-full rounded-lg border border-[#e0e0e0] px-3 py-2.5 text-sm text-[#0a0a0a] outline-none transition focus:border-[#48C9B0]'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2 }}
            className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={close} className="absolute right-4 top-4 text-[#999] transition hover:text-[#0a0a0a]">
              <X className="h-5 w-5" />
            </button>

            {submitted ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle className="h-12 w-12 text-[#48C9B0]" strokeWidth={1.5} />
                <h3 className="mt-4 text-lg font-bold text-[#0a0a0a]">¡Gracias, {nombre.split(' ')[0]}!</h3>
                <p className="mt-1.5 text-sm text-[#666]">Recibimos tu solicitud. Te contactamos muy pronto para armar un plan a tu medida.</p>
                <button onClick={close} className="mt-6 rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]">
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-[#0a0a0a]">Hablemos de tu plan a medida</h3>
                <p className="mt-1 text-sm text-[#666]">Cuéntanos un poco de ti y te armamos una propuesta sin límites.</p>

                <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#555]">Nombre completo *</label>
                    <input className={inputClass} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ana García" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#555]">Correo electrónico *</label>
                    <input className={inputClass} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ana@empresa.com" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#555]">Nombre de la empresa</label>
                      <input className={inputClass} value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Eventos García" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#555]">Empleados</label>
                      <select className={inputClass} value={empleados} onChange={e => setEmpleados(e.target.value)}>
                        <option value="">Selecciona</option>
                        {EMPLEADOS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#555]">Eventos</label>
                      <select className={inputClass} value={eventos} onChange={e => setEventos(e.target.value)}>
                        <option value="">Selecciona</option>
                        {EVENTOS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#555]">Invitados promedio</label>
                      <select className={inputClass} value={invitados} onChange={e => setInvitados(e.target.value)}>
                        <option value="">Selecciona</option>
                        {INVITADOS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#555]">¿Cómo te enteraste de nosotros?</label>
                    <select className={inputClass} value={fuente} onChange={e => setFuente(e.target.value)}>
                      <option value="">Selecciona</option>
                      {FUENTES.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#555]">Mensaje</label>
                    <textarea className={`${inputClass} min-h-[80px] resize-none`} value={mensaje} onChange={e => setMensaje(e.target.value)} placeholder="Cuéntanos qué necesitas..." />
                  </div>

                  {error && <p className="text-sm text-[#cc3333]">{error}</p>}

                  <button type="submit" disabled={submitting}
                    className="mt-1 rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-60">
                    {submitting ? 'Enviando...' : 'Enviar solicitud'}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
