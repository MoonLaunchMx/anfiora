'use client'

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { panelMaxHeight } from '@/lib/viewport'

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

const ModalCtx = createContext<{ onClose: () => void; titleId: string } | null>(null)

function useModalCtx(component: string) {
  const ctx = useContext(ModalCtx)
  if (!ctx) throw new Error(`${component} debe usarse dentro de <Modal>`)
  return ctx
}

function useVisualHeight(open: boolean) {
  const [height, setHeight] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    const read = () => {
      const vv = window.visualViewport
      setHeight(panelMaxHeight(vv ? vv.height : window.innerHeight))
    }
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

  return height
}

function useScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return
    const y = window.scrollY
    const body = document.body
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    body.style.position = 'fixed'
    body.style.top = `-${y}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, y)
    }
  }, [open])
}

function useFocusTrap(open: boolean, panelRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return
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
  }, [open, panelRef])
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
  const maxHeight = useVisualHeight(open)
  const [mounted, setMounted] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])
  useScrollLock(open)
  useFocusTrap(open, panelRef)

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
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
              style={maxHeight ? { maxHeight: `${maxHeight}px` } : undefined}
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
