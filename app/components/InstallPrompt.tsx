'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { X, Download, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'anfiora_install_dismissed'
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000
const ENGAGEMENT_MS = 30 * 1000
const AUTHED_PREFIXES = ['/dashboard', '/events', '/perfil', '/admin']

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY)
  } catch {
    return null
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    // navegador con almacenamiento bloqueado (modo privado, proteccion de rastreo)
  }
}

export default function InstallPrompt() {
  const pathname = usePathname()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [eligibleByTime, setEligibleByTime] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    if (standalone) return

    const raw = readDismissed()
    if (raw && Date.now() - Number(raw) < COOLDOWN_MS) return
    setDismissed(false)

    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua)
    const safari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)
    if (ios && safari) setIsIOS(true)

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setDeferred(null)
      setDismissed(true)
      writeDismissed()
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    const timer = setTimeout(() => setEligibleByTime(true), ENGAGEMENT_MS)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      clearTimeout(timer)
    }
  }, [])

  const onAuthedRoute = AUTHED_PREFIXES.some((p) => pathname?.startsWith(p))
  const eligible = onAuthedRoute || eligibleByTime
  const visible = !dismissed && eligible && (deferred !== null || isIOS)

  const remember = () => {
    setDismissed(true)
    writeDismissed()
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    remember()
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-2xl border border-[var(--border-strong)] bg-white p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)]">
          <img src="/icons/icon-192x192.png" alt="Anfiora" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text)]">Instala Anfiora</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-sec)]">
            {isIOS
              ? 'Toca Compartir y luego "Agregar a pantalla de inicio".'
              : 'Tenla a un toque en tu pantalla de inicio, sin abrir el navegador.'}
          </p>
        </div>
        <button
          onClick={remember}
          aria-label="Cerrar"
          className="shrink-0 rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)]"
        >
          <X size={18} />
        </button>
      </div>

      {isIOS ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[var(--surface)] py-2.5 text-xs font-medium text-[var(--text-sec)]">
          <Share size={15} />
          Compartir
          <span className="text-[var(--text-muted)]">→</span>
          Agregar a inicio
        </div>
      ) : (
        <button
          onClick={install}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#48C9B0' }}
        >
          <Download size={16} />
          Instalar app
        </button>
      )}
    </div>
  )
}
