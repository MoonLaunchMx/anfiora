'use client'

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { panelMaxHeight, visualRect, type ViewportRect } from '@/lib/viewport'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
  '2xl': 'sm:max-w-3xl',
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

let openModalIds: string[] = []

function pushOpenModal(id: string) {
  openModalIds = [...openModalIds, id]
}

function popOpenModal(id: string) {
  openModalIds = openModalIds.filter(existing => existing !== id)
}

function isTopmostModal(id: string) {
  return openModalIds[openModalIds.length - 1] === id
}

export function useModalLayer(open: boolean) {
  const id = useId()

  useEffect(() => {
    if (!open) return
    pushOpenModal(id)
    return () => popOpenModal(id)
  }, [open, id])

  return useCallback(() => isTopmostModal(id), [id])
}

const ModalCtx = createContext<{ onClose: () => void; titleId: string } | null>(null)

function useModalCtx(component: string) {
  const ctx = useContext(ModalCtx)
  if (!ctx) throw new Error(`${component} debe usarse dentro de <Modal>`)
  return ctx
}

function useVisualRect(open: boolean) {
  const [rect, setRect] = useState<ViewportRect | null>(null)

  useEffect(() => {
    if (!open) return
    const read = () =>
      setRect(prev => {
        const next = visualRect(window.visualViewport, {
          width: window.innerWidth,
          height: window.innerHeight,
        })
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width &&
          prev.height === next.height
        ) {
          return prev
        }
        return next
      })
    read()
    const vv = window.visualViewport
    vv?.addEventListener('resize', read)
    vv?.addEventListener('scroll', read)
    window.addEventListener('resize', read)
    return () => {
      vv?.removeEventListener('resize', read)
      vv?.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
    }
  }, [open])

  return rect
}

let scrollLockCount = 0
let scrollLockY = 0
let scrollLockPrev: { position: string; top: string; width: string; overflow: string } | null = null

function useScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return
    const body = document.body
    if (scrollLockCount === 0) {
      scrollLockY = window.scrollY
      scrollLockPrev = {
        position: body.style.position,
        top: body.style.top,
        width: body.style.width,
        overflow: body.style.overflow,
      }
      body.style.position = 'fixed'
      body.style.top = `-${scrollLockY}px`
      body.style.width = '100%'
      body.style.overflow = 'hidden'
    }
    scrollLockCount += 1
    return () => {
      scrollLockCount -= 1
      if (scrollLockCount === 0 && scrollLockPrev) {
        body.style.position = scrollLockPrev.position
        body.style.top = scrollLockPrev.top
        body.style.width = scrollLockPrev.width
        body.style.overflow = scrollLockPrev.overflow
        window.scrollTo(0, scrollLockY)
        scrollLockPrev = null
      }
    }
  }, [open])
}

function useFocusTrap(
  open: boolean,
  mounted: boolean,
  panelRef: React.RefObject<HTMLDivElement | null>
) {
  useEffect(() => {
    if (!open || !mounted) return
    const opener = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    if (!panel) return

    const first = panel.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel).focus({ preventScroll: true })

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        n => n.offsetParent !== null
      )
      if (nodes.length === 0) {
        e.preventDefault()
        return
      }
      const firstNode = nodes[0]
      const lastNode = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === firstNode) {
        e.preventDefault()
        lastNode.focus()
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault()
        firstNode.focus()
      }
    }

    panel.addEventListener('keydown', onKeyDown)
    return () => {
      panel.removeEventListener('keydown', onKeyDown)
      opener?.focus?.({ preventScroll: true })
    }
  }, [open, mounted, panelRef])
}

export function Modal({
  open,
  onClose,
  size = 'md',
  labelledBy,
  children,
}: {
  open: boolean
  onClose: () => void
  size?: ModalSize
  labelledBy?: string
  children: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const generatedId = useId()
  const titleId = labelledBy ?? `${generatedId}-title`
  const rect = useVisualRect(open)
  const [mounted, setMounted] = useState(false)
  const isTopModal = useModalLayer(open)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])
  useScrollLock(open)
  useFocusTrap(open, mounted, panelRef)

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopModal()) onClose()
    },
    [onClose, isTopModal]
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, handleEscape])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <ModalCtx.Provider value={{ onClose, titleId }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={
              rect
                ? {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    right: 'auto',
                    bottom: 'auto',
                  }
                : undefined
            }
            className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
            onClick={onClose}
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              style={rect ? { maxHeight: `${panelMaxHeight(rect.height)}px` } : undefined}
              className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl outline-none sm:rounded-2xl ${SIZE_CLASS[size]}`}
              onClick={e => e.stopPropagation()}
            >
              {children}
            </motion.div>
          </motion.div>
        </ModalCtx.Provider>
      )}
    </AnimatePresence>,
    document.body
  )
}

function Header({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose?: () => void
  children?: React.ReactNode
}) {
  const ctx = useModalCtx('Modal.Header')
  const close = onClose ?? ctx.onClose
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#f0f0f0] px-5 py-4">
      <div className="min-w-0 flex-1">
        <h2 id={ctx.titleId} className="truncate text-base font-bold text-[#1D1E20]">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-[#888]">{subtitle}</p>}
        {children}
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Cerrar"
        className="-mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#aaa] transition hover:bg-[#f5f5f5] hover:text-[#1D1E20]"
      >
        <X size={16} />
      </button>
    </div>
  )
}

function Body({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  useModalCtx('Modal.Body')
  return <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-4 ${className}`}>{children}</div>
}

function Footer({ children }: { children: React.ReactNode }) {
  useModalCtx('Modal.Footer')
  return (
    <div
      className="flex shrink-0 items-center gap-2.5 border-t border-[#f0f0f0] bg-white px-5 py-3.5"
      style={{ paddingBottom: 'calc(0.875rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {children}
    </div>
  )
}

Modal.Header = Header
Modal.Body = Body
Modal.Footer = Footer
