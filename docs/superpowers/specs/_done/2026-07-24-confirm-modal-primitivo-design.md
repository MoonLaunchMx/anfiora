# Confirm modal primitivo (`useConfirm()`) — diseño

**Fecha:** 2026-07-24
**Estado:** aprobado, listo para implementar

## Problema

Los borrados de invitado usan `window.confirm()` nativo (feo, inconsistente con el
resto de la UI). En `app/events/[id]/page.tsx` hay 3 casos:

1. `deleteGuest` — `"¿Eliminar este invitado?"` (solo cuando NO hay chat; si hay
   chat ya sale el modal rico `deleteChatModal`).
2. `deletePartyMember` — `"¿Eliminar este acompañante?"`.
3. `bulkDelete` — mensaje dinámico con conteo + nota de conversaciones.

Además, grupo/tag/chat cada uno rodó su propio modal inline porque nunca existió un
primitivo de confirmación reutilizable. Construir ese primitivo ahora evita seguir
reescribiendo el mismo modal en cada feature futura.

## Solución

Un primitivo **app-wide** basado en promesa: cualquier componente hace
`const confirm = useConfirm()` y luego `if (!(await confirm({...}))) return`,
idéntico en forma al `confirm()` nativo pero con UI propia y consistente.

### Componente nuevo: `app/components/ui/ConfirmModal.tsx` (`'use client'`)

- Exporta `ConfirmProvider` (context) y el hook `useConfirm()`.
- `useConfirm()` devuelve `confirm(opts): Promise<boolean>`.
- `opts`:
  ```ts
  {
    title: string
    message?: React.ReactNode   // ReactNode para poder renderizar listas, no solo texto
    confirmLabel?: string   // default 'Eliminar'
    cancelLabel?: string    // default 'Cancelar'
    tone?: 'danger' | 'default'  // default 'danger'
  }
  ```
- El provider guarda `state | null` con el `resolve` pendiente y renderiza **un
  solo** modal. Cero overhead cuando `state === null`.
- Estilo = el del modal de grupo/tag ya existente: `max-w-xs`, centrado, `z-[400]`,
  título negro `#1D1E20`, subtítulo `#666`.
  - `tone: 'danger'` → botón confirmar rojo `#cc3333` (hover `#b82e2e`).
  - `tone: 'default'` → botón confirmar teal `#48C9B0`.
- Cierre: backdrop, `Escape`, o botón Cancelar → `resolve(false)`. Botón confirmar
  → `resolve(true)`. Siempre limpia el `state` al resolver.

### Montaje

Envolver `children` en `app/layout.tsx` dentro de `PostHogProvider` (que ya es
client). Con eso el hook queda disponible en toda la app.

### Call sites (solo hoy)

Reemplazar los 3 `confirm()` en `app/events/[id]/page.tsx`:

| Caso | title | message | confirmLabel |
|---|---|---|---|
| Invitado sin chat | `¿Eliminar este invitado?` | — | `Eliminar` |
| Acompañante | `¿Eliminar este acompañante?` | — | `Eliminar` |
| Bulk (1–5 invitados) | `¿Eliminar estos invitados?` | lista con los nombres + línea de detalle (acompañantes · N con conversación) | `Eliminar` |
| Bulk (> 5 invitados) | `¿Eliminar N invitados?` | línea de detalle (con sus acompañantes · N con conversación) | `Eliminar` |

**Regla de listado del bulk:** si `guestIds.length` está entre 1 y 5, se listan los
nombres (bullets). Si es > 5, solo el conteo en el título. La línea de detalle
(acompañantes sueltos + "N con conversación; sus chats se conservarán") va siempre
que aplique. Si solo hay acompañantes sueltos (0 invitados), el título usa su conteo.

## Fuera de scope (apuntado para después)

- Migrar los modales existentes de grupo/tag/chat al nuevo primitivo. Son UX
  distinta y funcionan; la migración es gratis (mismo API) y opcional.
- No se toca la deuda de lint pre-existente del repo.

## Testing

UI con verificación visual → manual (local → preview). No hay lógica pura nueva que
amerite Vitest; la lógica de borrado ya tiene sus 7 tests.
