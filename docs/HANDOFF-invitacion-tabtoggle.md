# HANDOFF — Invitación reestructurada (TabToggle + header). Adaptar cobro encima.

**Fecha:** 2026-07-17
**Para:** el agente/rama que trabaja el cobro por transferencia (`worktree-cobro-transferencia`) y cualquiera que toque la invitación.
**Rama con estos cambios:** `feat/puerta-publica-invitados` (pusheada a origin).

## Por qué existe esta nota

La invitación (`app/events/[id]/invitacion/page.tsx`) fue **reestructurada** en `feat/puerta-publica-invitados`. La rama `worktree-cobro-transferencia` divergió antes de esto (merge-base `87ca153`) y sigue construyendo sobre la invitación **vieja**. Hay que adaptar el cobro sobre la estructura NUEVA, no al revés: este UI ya está más avanzado y aprobado por Diego.

## Commits de este cambio (en feat/puerta-publica-invitados)

- `dcdf86d` feat(invitacion): TabToggle 3 pestanas, acceso movido a Configuracion
- `57a608b` feat(timeline): separa seccion Tareas de Itinerario con TabToggle
- `4fd4d5c` fix(ui): header invitacion en una fila; botones itinerario a la derecha

Spec: `docs/superpowers/specs/2026-07-17-tabtoggle-estandar-invitacion-timeline-design.md`

## Estructura NUEVA de la invitación (lo que cambió)

1. **El switcher negro se fue.** Ahora la navegación usa el componente compartido `TabToggle` (`@/app/components/ui/TabToggle`), toggle pastilla.
2. **Tres pestañas** en vez de dos: `Diseño` · `Enviar` · **`Configuración`** (`TabKey = 'diseno' | 'enviar' | 'config'`).
3. **`<AccesoPanel>` (cómo entra la gente) YA NO vive en la pestaña "Enviar".** Ahora es el contenido de la pestaña **`Configuración`**. En "Enviar" quedó **solo** `<RepartoLinks>`.
4. **Header en una sola fila** (patrón de `configuracion/page.tsx`): título+estado a la izquierda, `TabToggle` al centro (`sm:flex-1`), y Fecha límite + Descartar + Publicar a la derecha (`sm:shrink-0`). Mobile se apila.

## Qué debe hacer el agente de cobro

El cobro toca justo el acceso. En `worktree-cobro-transferencia`, el commit `9eb90d3` ("prende precio por persona y captura de cuenta en acceso") y compañía modifican el `AccesoPanel` / el flujo de acceso **en su ubicación vieja**.

Pasos sugeridos:

1. **Rebase o merge** de `feat/puerta-publica-invitados` en la rama de cobro (trae la nueva estructura).
2. **Reconciliar `AccesoPanel`**: la captura de precio/CLABE/cuenta que el cobro añadió debe quedar dentro del `AccesoPanel` tal como está hoy — solo que ahora ese panel se renderiza bajo la pestaña **Configuración**, no bajo Enviar. Si el conflicto de merge aparece en `invitacion/page.tsx`, resolver dejando el **render de 3 pestañas** (Diseño/Enviar/Configuración) y `AccesoPanel` en Configuración; el contenido interno del AccesoPanel (precio, CLABE) es del cobro y se conserva.
3. **No reintroducir** el switcher negro ni volver a meter el acceso en "Enviar".

## Principio de diseño a respetar (nuevo estándar de la app)

- **`TabToggle`** = navegar entre **secciones** distintas de una feature (incluida Configuración). Es el estándar.
- **Switcher negro `#1D1E20`** = solo para **vistas del mismo contenido** (p.ej. Lista/Calendario de tareas). Nunca para navegar secciones.
- Si el cobro agrega sub-navegación en la invitación, usar `TabToggle`, no barras negras.
