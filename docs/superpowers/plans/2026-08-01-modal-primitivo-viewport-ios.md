# Primitivo de Modal + base de viewport iOS — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ningún modal de Anfiora se corte en iPhone — ni por la barra de Safari ni por el teclado — y que sea imposible volver a escribir uno que sí se corte.

**Architecture:** Un primitivo `<Modal>` en `app/components/ui/Modal.tsx` se vuelve el único dueño del overlay, el alto disponible, el scroll y la accesibilidad. Los 18 archivos con modales a mano migran a él. Una función pura en `lib/viewport.ts` calcula el alto (testeable sin DOM) y un script en `scripts/viewport-audit.mjs` tumba el build si alguien vuelve a escribir un modal a mano.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Framer Motion, Lucide React, Vitest.

## Global Constraints

- **Idioma de la UI:** español **con acentos**. Solo los mensajes de commit van sin acentos ni ñ.
- **Sin emojis** en ninguna UI.
- **Solo Tailwind**, con exactamente dos excepciones justificadas y ninguna más:
  1. El alto calculado del panel (`style={{ maxHeight: '<n>px' }}`) — es dinámico, no puede ser una clase.
  2. `env(safe-area-inset-*)` — no tiene equivalente en Tailwind.

  Cualquier otro `style` inline es un defecto.
- **Botones CTA en teal `#48C9B0`.** Negro `#1D1E20` solo para dropdowns de filtro.
- **Sin paquetes nuevos.** Todo se construye con lo que ya está en `package.json`.
- **Sin comentarios** salvo cuando el porqué no es obvio.
- **Commits convencionales:** `feat:`, `fix:`, `refactor:`, `docs:`, `test:`.
- **Inputs a 16px mínimo** (`text-base`, nunca `text-sm`) en cualquier campo dentro de un modal. Abajo de 16px, Safari iOS hace zoom automático al enfocar.
- **No bloquear el zoom.** Nunca `maximumScale` ni `userScalable: false`.
- **Nunca `git push`** sin permiso explícito de Diego.
- La rama de trabajo es `feat/modal-primitivo-viewport-ios`. **Verificar `git branch --show-current` antes de cada commit** — otro agente puede cambiar de rama a media sesión.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/viewport.ts` | **Crear.** Cálculo puro del alto del panel. Sin DOM, sin React. |
| `lib/viewport.test.ts` | **Crear.** Tests Vitest de lo anterior. |
| `app/components/ui/Modal.tsx` | **Crear.** El primitivo: overlay, alto, scroll, foco, accesibilidad. |
| `app/layout.tsx` | **Modificar.** Agregar `export const viewport`. |
| `app/events/[id]/layout.tsx` | **Modificar.** Safe area en el bottom nav. |
| `app/components/ui/ConfirmModal.tsx` | **Modificar.** Solo trampa de foco. |
| 18 archivos con modales | **Modificar.** Migrar al primitivo. |
| `scripts/viewport-audit.mjs` | **Crear.** El candado. |
| `scripts/viewport-audit.test.mjs` | **Crear.** Tests del candado. |
| `package.json` | **Modificar.** Enganchar el candado al build. |

---

## Task 1: Cálculo puro del alto del panel

**Files:**
- Create: `lib/viewport.ts`
- Test: `lib/viewport.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `panelMaxHeight(visualHeight: number, ratio?: number): number` — devuelve píxeles enteros. `MODAL_HEIGHT_RATIO = 0.92`.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/viewport.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MODAL_HEIGHT_RATIO, panelMaxHeight } from './viewport'

describe('panelMaxHeight', () => {
  it('toma el 92% del alto visible por defecto', () => {
    expect(panelMaxHeight(1000)).toBe(920)
  })

  it('respeta un ratio explicito', () => {
    expect(panelMaxHeight(1000, 0.5)).toBe(500)
  })

  it('redondea a entero para no producir medios pixeles', () => {
    expect(panelMaxHeight(667)).toBe(614)
  })

  it('nunca devuelve negativo si el teclado deja cero espacio', () => {
    expect(panelMaxHeight(0)).toBe(0)
    expect(panelMaxHeight(-50)).toBe(0)
  })

  it('sostiene un minimo usable cuando el teclado casi no deja lugar', () => {
    expect(panelMaxHeight(180)).toBe(180)
  })

  it('expone el ratio como constante', () => {
    expect(MODAL_HEIGHT_RATIO).toBe(0.92)
  })
})
```

Nota sobre el quinto test: con 180px visibles, el 92% daría 165px, pero por debajo de 200px el panel debe usar **todo** el espacio disponible — recortarlo más solo esconde contenido cuando ya casi no hay.

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- lib/viewport.test.ts`
Expected: FAIL — `Failed to resolve import "./viewport"`

- [ ] **Step 3: Escribir la implementación mínima**

Crear `lib/viewport.ts`:

```ts
export const MODAL_HEIGHT_RATIO = 0.92

const FULL_HEIGHT_THRESHOLD = 200

export function panelMaxHeight(visualHeight: number, ratio = MODAL_HEIGHT_RATIO): number {
  if (!Number.isFinite(visualHeight) || visualHeight <= 0) return 0
  if (visualHeight <= FULL_HEIGHT_THRESHOLD) return Math.round(visualHeight)
  return Math.round(visualHeight * ratio)
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npm test -- lib/viewport.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add lib/viewport.ts lib/viewport.test.ts
git commit -m "feat(viewport): calculo puro del alto del panel de modal"
```

---

## Task 2: Base de viewport en el layout raíz + safe area del bottom nav

**Files:**
- Modify: `app/layout.tsx` (agregar `export const viewport` junto al `export const metadata` de la línea 14)
- Modify: `app/events/[id]/layout.tsx` (bottom nav mobile)

**Interfaces:**
- Consumes: nada.
- Produces: `env(safe-area-inset-*)` empieza a devolver valores reales en toda la app. Task 3 depende de esto.

- [ ] **Step 1: Agregar el viewport al layout raíz**

En `app/layout.tsx`, agregar el import del tipo y el export **inmediatamente antes** de `export const metadata`:

```tsx
import type { Metadata, Viewport } from 'next'
```

```tsx
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
}
```

`viewportFit: 'cover'` es obligatorio: sin él `env(safe-area-inset-*)` devuelve 0 y el pie del modal no tendría respiro. `interactiveWidget` hace que Chrome en Android encoja la página con el teclado; Safari iOS no lo respeta de fiar y por eso Task 3 mide el viewport a mano.

No agregar `maximumScale` ni `userScalable`.

- [ ] **Step 2: Verificar que la app sigue levantando**

Run: `npm run dev`
Abrir `http://localhost:3000/dashboard`. Expected: la app carga igual que antes. En desktop no debe verse ningún cambio.

- [ ] **Step 3: Dar respiro al bottom nav**

En `app/events/[id]/layout.tsx`, localizar el contenedor del bottom nav mobile (el que tiene `fixed bottom-0` y `lg:hidden`). Agregarle respiro de safe area:

```tsx
style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
```

Es la única excepción a "solo Tailwind" fuera del alto del panel: `env()` no tiene clase de Tailwind.

Si el nav ya trae un `pb-*`, conservarlo — el `paddingBottom` del `style` lo reemplaza, así que en su lugar usar:

```tsx
style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
```

ajustando `0.5rem` al valor que tuviera el `pb-*` original.

- [ ] **Step 4: Verificar el nav**

Run: `npm run dev`
Abrir `/events/<algún-id>` en el navegador con el emulador móvil (DevTools → iPhone). Expected: el nav se ve idéntico en el emulador (ahí `env()` es 0). La verificación real es en iPhone y ocurre en el checkpoint de Task 7.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add app/layout.tsx "app/events/[id]/layout.tsx"
git commit -m "feat(viewport): declara viewport-fit cover y da respiro al bottom nav"
```

---

## Task 3: El primitivo Modal

**Files:**
- Create: `app/components/ui/Modal.tsx`

**Interfaces:**
- Consumes: `panelMaxHeight`, `MODAL_HEIGHT_RATIO` de `lib/viewport.ts` (Task 1).
- Produces:
  - `Modal` con props `{ open: boolean; onClose: () => void; size?: ModalSize; labelledBy?: string; children: React.ReactNode }`
  - `Modal.Header` con props `{ title: string; subtitle?: string; onClose?: () => void; children?: React.ReactNode }`
  - `Modal.Body` con props `{ children: React.ReactNode; className?: string }`
  - `Modal.Footer` con props `{ children: React.ReactNode }`
  - `type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'`

- [ ] **Step 1: Crear el primitivo**

Crear `app/components/ui/Modal.tsx`:

```tsx
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
```

Notas de diseño, para que no se "corrijan" por accidente:

- `min-h-0` en `Body` es obligatorio. Sin él, un hijo flex se niega a encogerse por debajo de su contenido y el scroll interno no funciona.
- `max-h-[92dvh]` en clase es el **respaldo**: si `visualViewport` no existe, el modal sigue midiendo bien. El `style` con píxeles lo pisa cuando sí hay medición.
- El `z-[300]` queda por debajo del `z-[400]` de `ConfirmModal` a propósito: una confirmación disparada desde un modal debe pintarse encima.
- **Sobre la animación de salida:** el `AnimatePresence` interno solo la reproduce si `<Modal>` sigue montado y `open` pasa a `false`. Los modales actuales se montan y desmontan desde el padre (`{showModal && <SupplierModal ... />}`), así que la salida no se va a ver. Es el comportamiento que ya tienen hoy todos menos `SupplierDetailModal`. **No corregirlo en esta migración**: cambiar 18 padres a `open={showModal}` es un refactor aparte y no aporta al problema del viewport. Se anota como deuda menor.

- [ ] **Step 2: Verificar que compila y que el tipado cierra**

Run: `npm run lint`
Expected: sin errores en `app/components/ui/Modal.tsx`.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add app/components/ui/Modal.tsx
git commit -m "feat(modal): primitivo Modal con alto real, scroll interno y trampa de foco"
```

---

## Task 3.5: Sacar los selectores de fecha y hora de la caja del modal

**Files:**
- Modify: `app/components/ui/DatePicker.tsx:153-154`
- Modify: `app/components/ui/TimePicker.tsx:153-154`

**Interfaces:**
- Consumes: `useModalLayer` de `app/components/ui/Modal.tsx` (Task 3).
- Produces: nada nuevo. Las props públicas de ambos componentes no cambian.

**Por qué existe esta tarea.** Se agregó durante la ejecución, con decisión explícita de Diego, tras un hallazgo de la revisión de la Task 3.

Un panel con `transform` de Framer Motion se convierte en el bloque contenedor de sus descendientes `position: fixed`. Ambos selectores renderizan su capa **inline** como `fixed inset-0 z-[200]`, sin portal. Al migrar `NewEventModal` (Task 10), que embebe los dos, el calendario a pantalla completa quedaría **recortado dentro del modal** y sujeto a su `overflow-hidden`.

`ColorPicker.tsx:125` tiene el mismo patrón pero **queda fuera de alcance**: solo lo usa `vestimenta/DressCodeEditor.tsx`, que es una página, no un modal de la migración. No tocarlo.

- [ ] **Step 1: Portalizar DatePicker**

Agregar los imports:

```tsx
import { useState, useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useModalLayer } from '@/app/components/ui/Modal'
```

Dentro del componente, antes del `return`:

```tsx
const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
useModalLayer(open)
```

Y a nivel de módulo, fuera del componente:

```tsx
const emptySubscribe = () => () => {}
```

Usar `useSyncExternalStore` y **no** `useState` + `useEffect(() => setMounted(true), [])`: el segundo dispara la regla `react-hooks/set-state-in-effect` y obligaría a suprimirla. Esta forma pasa el lint limpia.

Reemplazar la apertura del bloque de la línea 153-154:

```tsx
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
```

por:

```tsx
      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[350] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
```

Y cerrar el bloque con `, document.body)` en vez de `)`. Cuidado al localizar el cierre correcto: es el que cierra ese `<div>` externo, no uno interno.

**El `z-[350]` es deliberado.** La escala del proyecto es: `Modal` = 300, selectores = 350, `ConfirmModal` = 400. Al portalizar, el selector pasa a ser hermano del modal en el DOM, así que necesita un z mayor que 300 para pintarse encima. Con el `z-[200]` original quedaría **debajo** del modal, que es peor que el bug que estamos arreglando.

- [ ] **Step 2: Portalizar TimePicker**

Exactamente el mismo cambio en `app/components/ui/TimePicker.tsx`, mismas líneas, mismo `z-[350]`.

Ojo: este archivo tiene un `<style jsx global>` dentro del bloque que se portaliza. Se mueve con él sin problema; no lo saques.

- [ ] **Step 3: Verificar que compila y tipa**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx eslint app/components/ui/DatePicker.tsx app/components/ui/TimePicker.tsx`
Expected: exit 0, sin salida. Si aparece `react-hooks/set-state-in-effect`, el Step 1 se implementó con `useState` en vez de `useSyncExternalStore` — corregirlo, no suprimir la regla.

- [ ] **Step 4: Verificar las tres páginas que también usan estos selectores**

Los selectores no viven solo en modales. Verificar que estas tres siguen funcionando igual:

Run: `npm run dev`

1. `/events/<id>/configuracion` — abrir el selector de fecha del evento
2. `/events/<id>/invitacion` — abrir cualquier selector del editor
3. `/events/<id>/timeline` — nueva tarea, abrir el selector de fecha

Expected: el selector abre centrado y cubre la pantalla, igual que antes. Se cierra al hacer clic fuera. La fecha elegida se guarda.

- [ ] **Step 5: Verificar que Escape no atraviesa**

Con `npm run dev`, abrir `/events/<id>/timeline` → nueva tarea → abrir el selector de fecha → presionar Escape.
Expected: se cierra **solo el selector**, no la tarea. Si se cierran los dos, la llamada a `useModalLayer(open)` del Step 1 no se aplicó.

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add app/components/ui/DatePicker.tsx app/components/ui/TimePicker.tsx
git commit -m "fix(pickers): DatePicker y TimePicker se pintan fuera de la caja del modal"
```

---

## Task 4: Piloto 1 — SupplierModal (anatomía A limpia)

**Files:**
- Modify: `app/events/[id]/proveedores/SupplierModal.tsx:87-92` (shell) y su pie al final del archivo.

**Interfaces:**
- Consumes: `Modal` de `app/components/ui/Modal.tsx` (Task 3).
- Produces: el patrón de migración que usan las Tasks 5 a 10.

Es el caso fácil: ya tiene la anatomía correcta. La migración es reemplazar el andamio, no reestructurar.

- [ ] **Step 1: Reemplazar el shell**

Agregar el import:

```tsx
import { Modal } from '@/app/components/ui/Modal'
```

Reemplazar el bloque de apertura (líneas 87-95 aprox., desde `return (` hasta el cierre del div de header) por:

```tsx
  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header title="Nuevo proveedor" subtitle="Captura lo esencial, completa después" />
      <Modal.Body>
```

Borrar el `<X size={16} />` y su botón — el `Modal.Header` ya lo trae.

- [ ] **Step 2: Reemplazar el cierre**

El pie actual (`<div className="flex shrink-0 items-center justify-end gap-2 border-t ...">`) pasa a:

```tsx
      </Modal.Body>
      <Modal.Footer>
        <button
          onClick={onClose}
          disabled={submitting}
          className="ml-auto rounded-lg px-4 py-2 text-xs font-medium text-[#666] transition hover:bg-[#f0f0f0] disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
        >
          {submitting ? 'Guardando...' : 'Guardar proveedor'}
        </button>
      </Modal.Footer>
    </Modal>
  )
```

El `ml-auto` del primer botón conserva la alineación a la derecha que tenía el `justify-end` original.

- [ ] **Step 3: Subir los inputs a 16px**

Buscar en el archivo todos los `text-sm` y `text-xs` que estén en un `<input>`, `<select>` o `<textarea>` y cambiarlos a `text-base`. **Solo en campos de captura** — las etiquetas y los botones se quedan como están.

Run: `grep -n "text-\(xs\|sm\)" "app/events/[id]/proveedores/SupplierModal.tsx"` para localizarlos.

- [ ] **Step 4: Verificar en el navegador**

Run: `npm run dev`
Abrir `/events/<id>/proveedores` → botón de nuevo proveedor.
Expected: el modal se ve igual que antes en desktop. Escape lo cierra. Al cerrarlo, el foco vuelve al botón que lo abrió. El fondo no scrollea con el modal abierto.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add "app/events/[id]/proveedores/SupplierModal.tsx"
git commit -m "refactor(proveedores): SupplierModal migrado al primitivo Modal"
```

---

## Task 5: Piloto 2 — SupplierDetailModal (complejo, sin pie, con animación propia)

**Files:**
- Modify: `app/events/[id]/proveedores/SupplierDetailModal.tsx:300-330` (shell)

**Interfaces:**
- Consumes: `Modal` (Task 3).
- Produces: demuestra que el primitivo sirve sin `Modal.Footer` y sin perder animación.

Este archivo tiene su propia animación de Framer Motion y **no tiene pie**. El primitivo ya trae la misma animación (`spring`, `damping: 30`, `stiffness: 300`), así que se borra la local.

- [ ] **Step 1: Reemplazar el shell**

Agregar el import de `Modal`. Reemplazar las líneas 300-327 (los dos `motion.div` y el bloque HEADER) por:

```tsx
    <Modal open onClose={onClose} size="2xl">
      <Modal.Header title={name || 'Sin nombre'} subtitle={BUDGET_CATEGORY_LABELS[category]} />
      <Modal.Body className="space-y-7 py-5">
```

El original mostraba la categoría **arriba** del nombre. `Modal.Header` pone el subtítulo abajo. Es un cambio menor y deliberado: unifica la jerarquía con el resto de los modales. Si al verlo se decide conservar el orden original, se usa el slot `children` de `Modal.Header` en vez del prop `subtitle`.

- [ ] **Step 2: Reemplazar el cierre**

Al final del componente, el cierre de los `motion.div` y del `AnimatePresence` externo pasa a:

```tsx
      </Modal.Body>
    </Modal>
```

Si el archivo envolvía todo en un `<AnimatePresence>` propio, borrarlo: el primitivo trae el suyo.

- [ ] **Step 3: Quitar los imports que quedaron huérfanos**

`motion`, `AnimatePresence` y `X` probablemente ya no se usen en este archivo.

Run: `npm run lint`
Expected: si quedaron imports sin usar, ESLint los marca. Borrarlos.

- [ ] **Step 4: Subir los inputs a 16px**

Run: `grep -n "text-\(xs\|sm\)" "app/events/[id]/proveedores/SupplierDetailModal.tsx"`
Cambiar a `text-base` solo los que estén en `<input>`, `<select>` o `<textarea>`.

- [ ] **Step 5: Verificar en el navegador**

Run: `npm run dev`
Abrir `/events/<id>/proveedores` → clic en una tarjeta de proveedor.
Expected: el modal entra con la misma animación de resorte. Las pestañas internas funcionan. El contenido scrollea. En desktop conserva su ancho (`max-w-3xl`).

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add "app/events/[id]/proveedores/SupplierDetailModal.tsx"
git commit -m "refactor(proveedores): SupplierDetailModal migrado al primitivo Modal"
```

---

## Task 6: Piloto 3 — TaskModal (anatomía B, requiere reestructurar)

**Files:**
- Modify: `app/events/[id]/timeline/TaskModal.tsx:213-215` (shell) y el pie al final del archivo.

**Interfaces:**
- Consumes: `Modal` (Task 3).
- Produces: el patrón de reestructuración que reusan las Tasks 9 (MomentModal, GenerateItineraryModal, invitados, mesas).

**Este es el caso que justifica el proyecto.** El panel completo scrollea (`max-h-[92vh] overflow-y-auto`), el header es `sticky top-0` y el pie es `sticky bottom-0` **dentro** del área que scrollea. En iPhone el fondo del panel cae fuera de pantalla, y un pie pegado al fondo del panel cae con él.

- [ ] **Step 1: Reemplazar el shell**

Agregar el import de `Modal`. Reemplazar las líneas 213-215:

```tsx
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
```

por:

```tsx
  return (
    <Modal open onClose={onClose} size="lg">
      <Modal.Header title={editTask ? 'Editar tarea' : 'Nueva tarea'} />
      <Modal.Body className="[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
```

Las clases de ocultar la barra de scroll se conservan, pero ahora aplican al cuerpo, que es el que scrollea.

- [ ] **Step 2: Borrar el header viejo**

Borrar el bloque completo `{/* Header */}` con su `sticky top-0` y su botón de cerrar (líneas 217-225 aprox.). El `Modal.Header` ya lo cubre.

- [ ] **Step 3: Convertir el pie sticky en pie real**

Reemplazar el bloque `{/* Footer sticky */}` del final por:

```tsx
      </Modal.Body>
      <Modal.Footer>
        {editTask && (
          <button
            onClick={handleDelete}
            className="px-4 py-2.5 text-sm text-[#cc3333] border border-[#ffc0c0] rounded-xl hover:bg-[#fff0f0] transition-colors"
          >
            Eliminar
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 py-2.5 text-sm border border-[#e0e0e0] rounded-xl text-[#888] hover:bg-[#f8f8f8] transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!form.title.trim() || !form.task_date || saving}
          className="flex-[2] py-2.5 text-sm bg-[#48C9B0] text-white rounded-xl font-semibold disabled:opacity-40 hover:bg-[#3ab89f] transition-colors"
        >
          {saving ? 'Guardando...' : editTask ? 'Guardar cambios' : 'Agregar tarea'}
        </button>
      </Modal.Footer>
    </Modal>
  )
```

Se le quitó `sticky bottom-0 bg-white border-t border-[#f0f0f0] px-5 py-4` — todo eso lo pone `Modal.Footer`.

- [ ] **Step 4: Subir los inputs a 16px**

Run: `grep -n "text-\(xs\|sm\)" "app/events/[id]/timeline/TaskModal.tsx"`
Cambiar a `text-base` los que estén en `<input>`, `<select>` o `<textarea>`. Este archivo tiene varios `<select>` — todos cuentan.

- [ ] **Step 5: Verificar en el navegador**

Run: `npm run dev`
Abrir `/events/<id>/timeline` → nueva tarea, y también editar una existente.
Expected: los tres botones del pie (Eliminar solo al editar) quedan fijos abajo. El cuerpo scrollea por dentro. El `AnimatePresence` interno del bloque de recordatorio sigue funcionando.

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add "app/events/[id]/timeline/TaskModal.tsx"
git commit -m "refactor(timeline): TaskModal migrado al primitivo y reestructurado a pie anclado"
```

---

## Task 7: CHECKPOINT — verificación de Diego en iPhone real

**Files:** ninguno. Esta tarea no escribe código.

**Este es el único punto de riesgo real del plan.** No continuar a Task 8 sin el visto bueno.

- [ ] **Step 1: Levantar preview**

Empujar la rama y esperar el preview de Vercel. **Pedir permiso a Diego antes de hacer push** — es su regla.

- [ ] **Step 2: Diego verifica en su iPhone**

Lista, sobre los tres pilotos (nuevo proveedor, detalle de proveedor, nueva tarea):

1. Se llega al botón de guardar sin que lo tape la barra de Safari
2. Con el teclado abierto, el último campo sigue visible
3. Enfocar un campo no dispara zoom automático
4. El fondo no scrollea con el modal abierto
5. Escape cierra y el foco vuelve al elemento que lo abrió (probar en desktop)
6. En la PWA instalada, el pie no queda bajo la barra de gestos
7. El bottom nav no queda pisado por la barra de gestos en la PWA

- [ ] **Step 3: Decisión**

Si algo falla, **parar** y corregir el primitivo (Task 3) antes de migrar los 15 archivos restantes. Corregir el primitivo cuesta un archivo; corregirlo después de las tandas cuesta dieciséis.

---

## Task 8: Tanda 1 — proveedores y presupuesto (4 archivos)

**Files:**
- Modify: `app/events/[id]/proveedores/SupplierReviewModal.tsx:87`
- Modify: `app/events/[id]/presupuesto/BudgetItemModal.tsx:88`
- Modify: `app/events/[id]/presupuesto/BudgetCategoriesModal.tsx:59`
- Modify: `app/events/[id]/presupuesto/page.tsx:676`

**Interfaces:**
- Consumes: `Modal` (Task 3) y el patrón validado en Tasks 4-6.
- Produces: nada nuevo.

**Procedimiento por archivo** (el mismo para las tres tandas):

1. Leer el archivo completo antes de tocarlo.
2. Agregar `import { Modal } from '@/app/components/ui/Modal'`.
3. Identificar la anatomía: si el panel tiene `overflow-y-auto` es B (reestructurar como en Task 6); si el cuerpo lo tiene, es A (reemplazo directo como en Task 4).
4. Reemplazar overlay + panel por `<Modal open onClose={...} size={...}>`.
5. Reemplazar el header y su botón de cerrar por `<Modal.Header title=... />`.
6. Envolver el contenido en `<Modal.Body>`.
7. Envolver los botones de acción en `<Modal.Footer>`, quitándoles el `sticky`/`border-t`/`px`/`py` que ahora pone el primitivo.
8. Mapear el ancho: `max-w-sm`→`sm`, `max-w-md`→`md`, `max-w-lg`→`lg`, `max-w-2xl`→`xl`, `max-w-3xl`→`2xl`.
9. Subir los `<input>`, `<select>` y `<textarea>` a `text-base`.
10. Borrar imports huérfanos (`X`, `motion`, `AnimatePresence`).

- [ ] **Step 1: Migrar SupplierReviewModal**

Anatomía A, `max-h-[90vh]`, `max-w-md` → `size="md"`. Aplicar el procedimiento.

- [ ] **Step 2: Migrar BudgetItemModal**

Anatomía A, `max-h-[90vh]`, `max-w-md` → `size="md"`. Aplicar el procedimiento.

- [ ] **Step 3: Migrar BudgetCategoriesModal**

Anatomía A, `max-h-[85vh]`, `max-w-md` → `size="md"`. Ojo: este trae `onClick={e => e.stopPropagation()}` en el panel, que el primitivo ya hace — borrarlo.

- [ ] **Step 4: Migrar el modal de presupuesto/page.tsx**

Anatomía A, `max-h-[90vh]`, `max-w-lg` → `size="lg"`. Está embebido en la página, no es un componente aparte.

- [ ] **Step 5: Verificar los cuatro en el navegador**

Run: `npm run dev`
Abrir `/events/<id>/presupuesto` (nueva partida, editar categorías, el modal de la página) y `/events/<id>/proveedores` (marcar contratado → dispara el review).
Expected: los cuatro se ven igual en desktop, con pie fijo y cuerpo con scroll.

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add "app/events/[id]/proveedores/SupplierReviewModal.tsx" "app/events/[id]/presupuesto/"
git commit -m "refactor(presupuesto,proveedores): tanda 1 migrada al primitivo Modal"
```

---

## Task 9: Tanda 2 — timeline, invitados y mesas (4 archivos, el resto de anatomía B)

**Files:**
- Modify: `app/events/[id]/timeline/MomentModal.tsx:83`
- Modify: `app/events/[id]/timeline/GenerateItineraryModal.tsx:77`
- Modify: `app/events/[id]/page.tsx:609,671,2043`
- Modify: `app/events/[id]/mesas/page.tsx:471,1680`

**Interfaces:**
- Consumes: `Modal` (Task 3) y el patrón de reestructuración de Task 6.
- Produces: nada nuevo.

Esta tanda concentra los modales de anatomía B restantes. **Todos requieren reestructurarse**, no solo reemplazar el shell. Seguir el procedimiento de Task 8, con el paso 3 resolviendo siempre en "anatomía B".

- [ ] **Step 1: Migrar MomentModal**

`max-h-[92vh] overflow-y-auto` en el panel → anatomía B. `sm:max-w-lg` → `size="lg"`. Conservar las clases de ocultar scrollbar, moviéndolas a `Modal.Body`.

- [ ] **Step 2: Migrar GenerateItineraryModal**

`max-h-[92vh]` con `overflow-hidden` y `flex flex-col` → anatomía A en realidad; verificar al leerlo. `sm:max-w-md` → `size="md"`.

- [ ] **Step 3: Migrar los tres modales de events/[id]/page.tsx**

Líneas 609 y 671 (`max-w-2xl`, `maxHeight: '90vh'` en `style`) → `size="xl"`. Línea 2043 (`max-w-md`, `maxHeight: '90vh', overflowY: 'auto'` en `style`) → `size="md"`, anatomía B.

**Ojo con los dropdowns:** las líneas 1662, 2139 y 2161 del mismo archivo usan `max-h-[60vh]` / `max-h-[55vh]` pero **no son modales** — son listas desplegables y áreas con scroll. No migrarlas al primitivo. Sí cambiarles `vh` por `dvh`, porque el candado de Task 13 las va a marcar.

- [ ] **Step 4: Migrar los dos modales de mesas/page.tsx**

Línea 471 (`max-w-md`, `maxHeight:'80vh'`) → `size="md"`. Línea 1680 (`max-w-md`, `maxHeight:'90vh'`, `overflow-y-auto` en el panel) → `size="md"`, anatomía B.

- [ ] **Step 5: Verificar los seis en el navegador**

Run: `npm run dev`
Abrir `/events/<id>/timeline` (momento del itinerario, generar itinerario), `/events/<id>` (agregar invitado, editar invitado, el tercer modal) y `/events/<id>/mesas` (crear mesa, asignar invitado).
Expected: los seis con pie fijo. Los dropdowns de invitados siguen funcionando igual.

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add "app/events/[id]/timeline/" "app/events/[id]/page.tsx" "app/events/[id]/mesas/page.tsx"
git commit -m "refactor(timeline,invitados,mesas): tanda 2 migrada y anatomia B reestructurada"
```

---

## Task 10: Tanda 3 — mesa de regalos, playlist, invitación, onboarding y alta de evento (7 archivos)

**Files:**
- Modify: `app/events/[id]/mesa-regalos/AddGiftModal.tsx:147`
- Modify: `app/events/[id]/mesa-regalos/PaymentMethodModal.tsx:134`
- Modify: `app/mesa/[token]/page.tsx:417`
- Modify: `app/events/[id]/playlist/AddSongModal.tsx:113`
- Modify: `app/events/[id]/invitacion/BlockEditor.tsx:247,288`
- Modify: `app/components/OnboardingModal.tsx:64`
- Modify: `app/components/NewEventModal.tsx:585-586`

**Interfaces:**
- Consumes: `Modal` (Task 3) y el procedimiento de Task 8.
- Produces: nada nuevo.

- [ ] **Step 1: Migrar los tres de mesa de regalos**

Los tres son anatomía A con `max-h-[90vh]` y `max-w-md` → `size="md"`. `app/mesa/[token]/page.tsx` es **página pública** — verificar que sigue funcionando sin sesión.

- [ ] **Step 2: Migrar AddSongModal**

Anatomía A, `max-h-[85vh]`, `max-w-md` → `size="md"`.

- [ ] **Step 3: Migrar BlockEditor**

Tiene **dos** contenedores: línea 247 (`max-h-[70vh] overflow-y-auto`, es un área interna, **no** un modal — solo cambiar `vh` por `dvh`) y línea 288 (el modal real, `max-h-[88vh] sm:max-h-[85vh]`, `sm:max-w-lg` → `size="lg"`).

- [ ] **Step 4: Migrar OnboardingModal**

`maxHeight: '92vh'` en `style`. Verificar si tiene pie; si no, omitir `Modal.Footer`.

- [ ] **Step 5: Migrar NewEventModal**

El más delicado de la tanda: usa `fixed inset-x-4 bottom-4 top-[4vh]` en vez del patrón de overlay normal, y es un flujo de **cuatro pasos**. `max-w-lg` → `size="lg"`. Verificar que los botones de navegación entre pasos queden en `Modal.Footer` y que sigan visibles en el paso de herramientas — hay un commit previo (`0fdd450`) que arregló justo eso.

- [ ] **Step 6: Verificar los siete en el navegador**

Run: `npm run dev`
Abrir: mesa de regalos (agregar regalo, método de pago), la página pública de mesa, playlist (agregar canción), invitación (editor de bloques), y disparar el alta de evento desde el dashboard.
Expected: los siete se ven igual en desktop. El alta de evento navega entre sus cuatro pasos con los botones siempre visibles.

- [ ] **Step 7: Commit**

```bash
git branch --show-current
git add "app/events/[id]/mesa-regalos/" "app/mesa/" "app/events/[id]/playlist/AddSongModal.tsx" "app/events/[id]/invitacion/BlockEditor.tsx" app/components/OnboardingModal.tsx app/components/NewEventModal.tsx
git commit -m "refactor(regalos,playlist,invitacion,onboarding): tanda 3 migrada al primitivo Modal"
```

---

## Task 11: Pantallas de alto completo y trampa de foco en ConfirmModal

**Files:**
- Modify: `app/dashboard/page.tsx:531`
- Modify: `app/events/[id]/layout.tsx:520,714`
- Modify: `app/mensajes/page.tsx:318`
- Modify: `app/components/ui/ConfirmModal.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: deja `app/` limpio para que el candado de Task 13 pueda pasar.

Las pantallas de alto completo **se remiden, no se reestructuran** — está fuera de alcance por spec.

- [ ] **Step 1: Cambiar h-screen por dvh en las tres pantallas**

`app/dashboard/page.tsx:531`: `flex h-screen flex-col` → `flex h-[100dvh] flex-col`
`app/events/[id]/layout.tsx:520`: `flex h-screen flex-col` → `flex h-[100dvh] flex-col`
`app/events/[id]/layout.tsx:714`: `h-[calc(100vh-64px)]` → `h-[calc(100dvh-64px)]`
`app/mensajes/page.tsx:318`: `flex flex-col h-screen` → `flex flex-col h-[100dvh]`

Los `h-screen` de pantallas de carga (`app/events/[id]/layout.tsx:421`, `app/admin/page.tsx:202`, `app/perfil/page.tsx:351`) también, por consistencia y para que el candado pase.

- [ ] **Step 2: Barrer los min-h-screen restantes**

Run: `grep -rn "min-h-screen\|h-screen" app/`
Cambiar cada uno a `min-h-[100dvh]` / `h-[100dvh]`. Son páginas públicas y de carga; el cambio es de una palabra y no altera el diseño.

- [ ] **Step 3: Agregar trampa de foco a ConfirmModal**

En `app/components/ui/ConfirmModal.tsx`, dentro del `useEffect` que ya escucha `keydown` (líneas 30-38), agregar el manejo de `Tab`. El panel necesita una ref:

```tsx
const panelRef = useRef<HTMLDivElement>(null)
```

Y dentro del `onKey` existente:

```tsx
      if (e.key === 'Tab') {
        const panel = panelRef.current
        if (!panel) return
        const nodes = Array.from(
          panel.querySelectorAll<HTMLElement>('button:not([disabled])')
        )
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
```

Poner `ref={panelRef}` en el div del panel (línea 45) y enfocar el botón de cancelar al abrir.

- [ ] **Step 4: Verificar**

Run: `npm run dev`
Expected: el dashboard, el layout de eventos y mensajes se ven igual. En un `useConfirm`, Tab cicla entre Cancelar y Eliminar sin salirse del modal.

- [ ] **Step 5: Commit**

Nunca `git add app/` a secas: hay otros agentes trabajando en este mismo checkout y un `add` amplio se lleva su trabajo. Listar los archivos tocados uno por uno:

```bash
git branch --show-current
git status --short
git add app/dashboard/page.tsx "app/events/[id]/layout.tsx" app/mensajes/page.tsx app/components/ui/ConfirmModal.tsx
git add <los demas archivos que el Step 2 haya tocado, uno por uno>
git commit -m "fix(viewport): pantallas de alto completo a dvh y trampa de foco en ConfirmModal"
```

---

## Task 12: El candado — script de auditoría

**Files:**
- Create: `scripts/viewport-audit.mjs`
- Test: `scripts/viewport-audit.test.mjs`
- Modify: `vitest.config.ts:7`

**Interfaces:**
- Consumes: nada.
- Produces: `auditSource(relativePath: string, source: string): Violation[]` donde `Violation = { file: string; line: number; rule: string; snippet: string }`. Ejecutable como CLI.

- [ ] **Step 0: Hacer que Vitest vea los tests de `scripts/`**

`vitest.config.ts` hoy solo incluye `lib/**/*.test.ts` y `app/**/*.test.ts`. Sin este paso, el test del auditor **existe pero nunca corre** — que es exactamente el modo de fallo que este candado busca evitar.

En `vitest.config.ts`, línea 7:

```ts
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts', 'scripts/**/*.test.mjs'],
```

El script se queda en `.mjs` a propósito: `prebuild` lo corre con node pelado, sin cargador de TypeScript.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `scripts/viewport-audit.test.mjs`:

```js
import { describe, expect, it } from 'vitest'
import { auditSource } from './viewport-audit.mjs'

describe('auditSource', () => {
  it('marca vh en una clase de Tailwind', () => {
    const v = auditSource('app/x.tsx', 'const a = <div className="max-h-[90vh]" />')
    expect(v).toHaveLength(1)
    expect(v[0].rule).toBe('vh')
    expect(v[0].line).toBe(1)
  })

  it('marca vh dentro de un style inline', () => {
    const v = auditSource('app/x.tsx', 'style={{ maxHeight: "90vh" }}')
    expect(v).toHaveLength(1)
  })

  it('marca h-screen y min-h-screen', () => {
    const v = auditSource('app/x.tsx', '<div className="min-h-screen" />\n<div className="h-screen" />')
    expect(v).toHaveLength(2)
    expect(v.every(x => x.rule === 'h-screen')).toBe(true)
  })

  it('no marca dvh, svh ni lvh', () => {
    expect(auditSource('app/x.tsx', 'className="max-h-[92dvh] h-[100svh] min-h-[50lvh]"')).toHaveLength(0)
  })

  it('marca un bottom sheet escrito a mano', () => {
    const src = '<div className="fixed inset-0 z-50">\n<div className="rounded-t-2xl bg-white">'
    const v = auditSource('app/x.tsx', src)
    expect(v.some(x => x.rule === 'modal-a-mano')).toBe(true)
  })

  it('no marca el propio primitivo', () => {
    const src = '<div className="fixed inset-0 z-[300]">\n<div className="rounded-t-2xl">'
    expect(auditSource('app/components/ui/Modal.tsx', src)).toHaveLength(0)
  })

  it('no marca los archivos en lista blanca', () => {
    expect(auditSource('app/globals.css', 'top: -6vh;')).toHaveLength(0)
    expect(auditSource('app/page.tsx', 'className="min-h-screen"')).toHaveLength(0)
  })

  it('reporta el numero de linea correcto', () => {
    const v = auditSource('app/x.tsx', 'linea uno\nlinea dos\nmax-h-[90vh]')
    expect(v[0].line).toBe(3)
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm test -- scripts/viewport-audit.test.mjs`
Expected: FAIL — no se resuelve el import.

- [ ] **Step 3: Escribir el script**

Crear `scripts/viewport-audit.mjs`:

```js
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ALLOWLIST = [
  ['app/globals.css', 'animaciones decorativas del landing, vh es correcto ahi'],
  ['app/page.tsx', 'landing publica de alto completo'],
  ['app/[segment]/SegmentClient.tsx', 'landing de nicho de alto completo'],
  ['app/components/ui/Modal.tsx', 'el primitivo, unico autorizado a montar un overlay'],
  ['app/components/ui/ConfirmModal.tsx', 'primitivo de confirmacion'],
]

const VH = /(?<![a-z])(\d+(?:\.\d+)?)vh(?![a-z])/
const SCREEN = /\b(?:min-)?h-screen\b/
const OVERLAY = /fixed\s+inset-0/
const SHEET = /rounded-t-2xl/

function isAllowed(file) {
  const norm = file.split(sep).join('/')
  return ALLOWLIST.some(([path]) => norm === path)
}

export function auditSource(file, source) {
  if (isAllowed(file)) return []
  const lines = source.split('\n')
  const out = []

  lines.forEach((text, i) => {
    if (VH.test(text)) out.push({ file, line: i + 1, rule: 'vh', snippet: text.trim() })
    if (SCREEN.test(text)) out.push({ file, line: i + 1, rule: 'h-screen', snippet: text.trim() })
  })

  const hasOverlay = lines.some(l => OVERLAY.test(l))
  const hasSheet = lines.some(l => SHEET.test(l))
  if (hasOverlay && hasSheet) {
    const line = lines.findIndex(l => SHEET.test(l)) + 1
    out.push({ file, line, rule: 'modal-a-mano', snippet: lines[line - 1].trim() })
  }

  return out
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (/\.(tsx?|css)$/.test(entry)) acc.push(full)
  }
  return acc
}

function main() {
  const root = process.cwd()
  const files = walk(join(root, 'app'))
  const violations = files.flatMap(f => auditSource(relative(root, f), readFileSync(f, 'utf8')))

  console.log(`viewport-audit: ${files.length} archivos revisados en app/`)

  if (violations.length === 0) {
    console.log('viewport-audit: limpio')
    return
  }

  console.error(`\nviewport-audit: ${violations.length} violaciones\n`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]  ${v.snippet.slice(0, 90)}`)
  }
  console.error(`
Usa dvh en vez de vh, y el primitivo <Modal> de app/components/ui/Modal.tsx
en vez de escribir un overlay a mano. Si la excepcion es legitima, agregala
a ALLOWLIST en scripts/viewport-audit.mjs con el motivo escrito.
`)
  process.exit(1)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
```

El conteo de archivos revisados se imprime siempre, a propósito: un auditor que no dice cuánto cubrió no se puede distinguir de uno que no cubrió nada.

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npm test -- scripts/viewport-audit.test.mjs`
Expected: PASS, 8 tests. Si Vitest reporta "No test files found", el Step 0 no se aplicó.

- [ ] **Step 5: Correr el auditor contra la app real**

Run: `node scripts/viewport-audit.mjs`
Expected: `limpio`, con el conteo de archivos revisados. Si marca algo, arreglarlo — las Tasks 4-11 debieron dejarlo limpio.

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add scripts/viewport-audit.mjs scripts/viewport-audit.test.mjs
git commit -m "feat(candado): auditor de viewport que prohibe vh y modales a mano"
```

---

## Task 13: Enganchar el candado al build

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: `scripts/viewport-audit.mjs` (Task 12).
- Produces: `npm run build` falla si el auditor encuentra violaciones.

- [ ] **Step 1: Agregar los scripts**

En `package.json`, en `"scripts"`:

```json
"viewport-audit": "node scripts/viewport-audit.mjs",
"prebuild": "node scripts/viewport-audit.mjs"
```

`prebuild` lo corre npm automáticamente antes de `build`, así que también protege el deploy de Vercel sin tocar su configuración.

- [ ] **Step 2: Verificar que el build pasa**

Run: `npm run build`
Expected: el auditor imprime `limpio` y el build sigue hasta completarse.

- [ ] **Step 3: Verificar que el candado de verdad muerde**

Introducir a mano una violación temporal en cualquier archivo de `app/`, por ejemplo `className="max-h-[90vh]"`.

Run: `npm run build`
Expected: FAIL. El auditor lista la violación con archivo y línea, y el build no arranca.

Revertir la violación temporal.

- [ ] **Step 4: Commit**

```bash
git branch --show-current
git add package.json
git commit -m "feat(candado): el auditor de viewport corre en prebuild"
```

---

## Task 14: Verificación final en iPhone y cierre

**Files:** ninguno.

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: todo verde, incluidos los tests de `lib/viewport.test.ts` y `scripts/viewport-audit.test.mjs`.

Run: `npm run lint`
Expected: sin errores.

Run: `npm run build`
Expected: auditor limpio, build completo.

- [ ] **Step 2: Verificación de Diego en iPhone sobre preview**

Pedir permiso para push, esperar preview. Recorrer los **18 modales** con la lista de Task 7. Prestar atención especial a:

- El alta de evento (`NewEventModal`), por sus cuatro pasos
- El detalle de proveedor (`SupplierDetailModal`), por sus pestañas
- La página pública de mesa de regalos, que se abre sin sesión
- La PWA instalada, para el bottom nav y el pie de los modales

- [ ] **Step 3: Archivar el spec**

Mover el spec a `_done/` según la convención del repo:

```bash
git mv docs/superpowers/specs/2026-08-01-modal-primitivo-viewport-ios-design.md docs/superpowers/specs/_done/
git mv docs/superpowers/plans/2026-08-01-modal-primitivo-viewport-ios.md docs/superpowers/plans/_done/
git commit -m "docs: archiva spec y plan del primitivo Modal"
```

- [ ] **Step 4: Actualizar el changelog**

Agregar una entrada en `lib/changelog.ts` y subir `CURRENT_VERSION`, para que el `WhatsNewModal` lo anuncie. Texto orientado al usuario, no al desarrollador: los modales ahora se ven completos en el celular.

- [ ] **Step 5: Merge**

Usar el skill `superpowers:finishing-a-development-branch`. **No hacer push a main sin permiso explícito de Diego.**

---

## Notas de riesgo

| Riesgo | Dónde se contiene |
|---|---|
| El primitivo no aguanta un caso extremo | Task 7, antes de migrar 15 archivos |
| Reestructurar anatomía B cambia el aspecto | Tasks 6 y 9, verificación visual explícita |
| `viewport-fit=cover` descuadra algo en PWA | Task 7, pasos 6 y 7 |
| El auditor da falsos positivos en dropdowns | Task 9 paso 3 los identifica: se remiden, no se migran |
| Otro agente cambia de rama a media sesión | `git branch --show-current` antes de cada commit |
