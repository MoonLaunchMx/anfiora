'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { CURRENT_LEGAL_VERSION } from '@/lib/legal'
import { Modal } from '@/app/components/ui/Modal'

const EXCLUDED_PATHS = ['/terminos', '/privacidad']

export default function LegalGate() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      try {
        const res = await fetch('/api/legal/status', {
          headers: { Authorization: 'Bearer ' + session.access_token },
        })
        if (!res.ok) return // fail-open
        const data = await res.json()
        if (active && !data.current) {
          setToken(session.access_token)
          setShow(true)
        }
      } catch {
        // fail-open: no bloquear por error transitorio
      }
    }
    check()
    return () => { active = false }
  }, [])

  async function accept() {
    if (!token) return
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/legal/accept', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!res.ok) throw new Error()
      setShow(false)
    } catch {
      setError('No se pudo registrar tu aceptacion. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (!show || EXCLUDED_PATHS.includes(pathname)) return null

  return (
    // sin Modal.Header a proposito: esta puerta no se cierra, no debe tener tache ni cerrarse con Escape
    <Modal open onClose={() => {}} size="md">
      <Modal.Body className="py-6">
        <h2 className="text-lg font-bold text-[#1D1E20]">Actualizamos nuestros terminos</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#777]">
          Para seguir usando Anfiora necesitas aceptar nuestros{' '}
          <Link href="/terminos" target="_blank" className="font-medium text-[#48C9B0]">Terminos y Condiciones</Link>{' '}
          y el{' '}
          <Link href="/privacidad" target="_blank" className="font-medium text-[#48C9B0]">Aviso de Privacidad</Link>{' '}
          (version {CURRENT_LEGAL_VERSION}).
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2.5 text-xs text-[#cc3333]">{error}</div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="flex w-full flex-col">
          <button
            onClick={accept}
            disabled={submitting}
            className={'w-full rounded-[10px] border-none py-3 text-sm font-semibold text-white transition-colors ' +
              (submitting ? 'cursor-not-allowed bg-[#9ee0d4]' : 'cursor-pointer bg-[#48C9B0] hover:bg-[#3ab89f]')}
          >
            {submitting ? 'Un momento...' : 'Acepto y continuo'}
          </button>
          <button
            onClick={logout}
            className="mt-3 w-full cursor-pointer border-none bg-transparent text-[13px] text-[#aaa] transition-colors hover:text-[#555]"
          >
            Cerrar sesion
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  )
}
