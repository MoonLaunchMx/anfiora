'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertCircle, Loader2, X } from 'lucide-react'
import { reportError } from '@/lib/observabilidad/report'
import type { Fallo } from '@/lib/escrituras/fallo'

// El aviso de error de Anfiora: abajo, con lo que no se hizo, el porque en
// palabras y Reintentar cuando reintentar sirve. No se va solo: un error que
// desaparece a los 3 segundos es un error que el planner no alcanza a leer.

type AvisoError = {
  titulo: string
  detalle?: string
  // Devuelve true si el reintento entro. Si vuelve a fallar, quien reintenta
  // levanta su propio aviso con la misma clave y este se reemplaza.
  reintentar?: () => Promise<boolean>
  // Dos avisos con la misma clave no se apilan: el nuevo sustituye al viejo.
  clave?: string
}

type AvisoVivo = AvisoError & { id: number; clave: string; reintentando: boolean }

type Api = {
  error: (a: AvisoError) => void
  // Atajo para un Fallo de lib/escrituras: pone el detalle, decide si hay
  // Reintentar y reporta a Sentry cuando el fallo es nuestro.
  fallo: (a: { titulo: string; fallo: Fallo; reintentar?: () => Promise<boolean>; clave?: string }) => void
  cerrar: (clave: string) => void
}

const ToastContext = createContext<Api | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<AvisoVivo[]>([])
  const seq = useRef(0)

  const error = useCallback((a: AvisoError) => {
    const clave = a.clave ?? a.titulo
    const id = ++seq.current
    setAvisos(prev => [...prev.filter(x => x.clave !== clave), { ...a, id, clave, reintentando: false }])
  }, [])

  const fallo = useCallback<Api['fallo']>(({ titulo, fallo, reintentar, clave }) => {
    // En local no hay Sentry: la consola es el unico lugar donde se ve el error real.
    if (fallo.tipo === 'interno') { console.error('[anfiora] fallo interno:', fallo.tecnico); reportError(fallo.tecnico, { zona: 'planner' }) }
    error({ titulo, detalle: fallo.detalle, reintentar: fallo.reintentable ? reintentar : undefined, clave })
  }, [error])

  const cerrar = useCallback((clave: string) => {
    setAvisos(prev => prev.filter(x => x.clave !== clave))
  }, [])

  const quitarId = (id: number) => setAvisos(prev => prev.filter(x => x.id !== id))

  const reintentar = async (a: AvisoVivo) => {
    if (!a.reintentar) return
    setAvisos(prev => prev.map(x => x.id === a.id ? { ...x, reintentando: true } : x))
    let ok = false
    try { ok = await a.reintentar() } catch { ok = false }
    // Si fallo de nuevo, el reintento ya levanto un aviso nuevo con la misma
    // clave y este id ya no existe: quitarlo es inofensivo.
    if (ok) quitarId(a.id)
    else setAvisos(prev => prev.map(x => x.id === a.id ? { ...x, reintentando: false } : x))
  }

  return (
    <ToastContext.Provider value={{ error, fallo, cerrar }}>
      {children}
      {avisos.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[500] flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {avisos.map(a => (
            <div key={a.id} role="alert" className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-[#e0e0e0] bg-white p-3 shadow-xl">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#cc3333] text-white"><AlertCircle size={13} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#1D1E20]">{a.titulo}</p>
                {a.detalle && <p className="mt-0.5 text-xs text-[#666]">{a.detalle}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {a.reintentar && (
                  <button type="button" onClick={() => reintentar(a)} disabled={a.reintentando} className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-[#1f8a75] hover:bg-[#f0fdfb] disabled:opacity-60">
                    {a.reintentando && <Loader2 size={13} className="animate-spin" />}
                    {a.reintentando ? 'Reintentando…' : 'Reintentar'}
                  </button>
                )}
                <button type="button" onClick={() => quitarId(a.id)} aria-label="Cerrar" className="flex h-7 w-7 items-center justify-center rounded-lg text-[#999] hover:bg-[#f5f5f5] hover:text-[#1D1E20]"><X size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
