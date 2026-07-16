'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// Guardian de salida del editor de invitacion. El editor registra si tiene
// cambios sin publicar y como publicarlos; el nav pide permiso antes de navegar.
// Fuera del editor no hay guardian registrado, asi que todo pasa directo.

type Guard = { dirty: boolean; publish: () => Promise<void> }

type Ctx = {
  registrar: (g: Guard | null) => void
  // Envuelve una navegacion: si hay cambios sin publicar, abre el aviso; si no, navega.
  salir: (navegar: () => void) => void
}

const SalidaCtx = createContext<Ctx | null>(null)

export function useSalidaGuard(): Ctx | null {
  return useContext(SalidaCtx)
}

export function SalidaGuardProvider({ children }: { children: React.ReactNode }) {
  const guardRef = useRef<Guard | null>(null)
  const [pendiente, setPendiente] = useState<(() => void) | null>(null)
  const [publicando, setPublicando] = useState(false)

  const registrar = useCallback((g: Guard | null) => { guardRef.current = g }, [])

  const salir = useCallback((navegar: () => void) => {
    if (guardRef.current?.dirty) setPendiente(() => navegar)
    else navegar()
  }, [])

  const salirSinPublicar = () => {
    const nav = pendiente
    guardRef.current = null
    setPendiente(null)
    nav?.()
  }

  const publicarYSalir = async () => {
    const g = guardRef.current
    if (!g) { setPendiente(null); return }
    setPublicando(true)
    try { await g.publish() } finally { setPublicando(false) }
    const nav = pendiente
    guardRef.current = null
    setPendiente(null)
    nav?.()
  }

  return (
    <SalidaCtx.Provider value={{ registrar, salir }}>
      {children}
      <AnimatePresence>
        {pendiente && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1D1E20]/40 px-6"
            onClick={() => { if (!publicando) setPendiente(null) }}
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-bold text-[#1D1E20]">Tienes cambios sin publicar</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#666]">
                Lo que editaste todavía no lo ven tus invitados. ¿Publicarlo antes de salir?
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={publicarYSalir}
                  disabled={publicando}
                  className="rounded-lg bg-[#48C9B0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-60"
                >
                  {publicando ? 'Publicando...' : 'Publicar cambios'}
                </button>
                <button
                  onClick={salirSinPublicar}
                  disabled={publicando}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-[#999] transition hover:bg-[#f5f5f5] disabled:opacity-60"
                >
                  Salir sin publicar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SalidaCtx.Provider>
  )
}
