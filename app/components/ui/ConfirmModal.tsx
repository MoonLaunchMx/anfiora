'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

type ConfirmTone = 'danger' | 'default'

type ConfirmOptions = {
  title: string
  message?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
}

type PendingConfirm = ConfirmOptions & { resolve: (value: boolean) => void }

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>(resolve => setPending({ ...opts, resolve }))
  }, [])

  const close = useCallback((value: boolean) => {
    setPending(prev => { prev?.resolve(value); return null })
  }, [])

  useEffect(() => {
    if (!pending) return
    const opener = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    panel?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Enter') close(true)
      if (e.key === 'Tab') {
        const nodes = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])
        if (nodes.length === 0) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.({ preventScroll: true })
    }
  }, [pending, close])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4" onClick={() => close(false)}>
          <div ref={panelRef} role="dialog" aria-modal="true" className="w-full max-w-xs rounded-2xl border border-[#e8e8e8] bg-white p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[#1D1E20]">{pending.title}</h3>
            {pending.message != null && <div className="mt-1.5 text-xs text-[#666]">{pending.message}</div>}
            <div className="mt-5 flex gap-2.5">
              <button type="button" onClick={() => close(false)} className="flex-1 rounded-lg border border-[#e0e0e0] py-2.5 text-sm text-[#888] transition hover:bg-[#f8f8f8]">
                {pending.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={
                  (pending.tone === 'default'
                    ? 'bg-[#48C9B0] hover:bg-[#3fb7a0]'
                    : 'bg-[#cc3333] hover:bg-[#b82e2e]') +
                  ' flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition'
                }
              >
                {pending.confirmLabel ?? 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>')
  return ctx
}
