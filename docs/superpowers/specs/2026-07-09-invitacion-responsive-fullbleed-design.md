# Invitación pública responsive (full-bleed) + vista completa

Fecha: 2026-07-09
Estado: aprobado (diseño)

## Problema

La página pública del invitado (`/invitacion/[slug]/[token]`) se ve como una tira
móvil angosta en tablet y desktop. La causa es un contenedor clavado a
`max-w-[480px]` centrado en `app/invitacion/[slug]/[token]/InvitacionClient.tsx`,
más secciones que asumen mobile (paddings fijos `px-6`, tarjetas internas
`max-w-sm`, tipografía sin escala por breakpoint). Es la cara del producto ante el
invitado final —lo más parecido al empaque de marca— y hoy se ve rota fuera de
móvil.

## Objetivo

Que la invitación pública se adapte a móvil, tablet y desktop con un layout
**full-bleed**: la portada (y el cierre) ocupan todo el ancho como hero, y el
cuerpo baja centrado en una columna cómoda que crece con el breakpoint. La
narrativa vertical se conserva. Es puro layout/CSS: no cambia schema, lógica de
negocio, RSVP funcional, API, colores, fuentes ni textos.

Extra incluido: un botón **"Abrir vista completa"** en el editor que abre la
invitación real a ancho completo en pestaña nueva, para que el planner tenga un
preview desktop honesto (y para probar el responsive sin devtools).

## Fuera de scope

- Subir imagen de fondo a la portada (otra feature).
- El epic de edición de estilo (fonts/colores/fondo/botones/animaciones).
- Las otras mejoras UI de la invitación (Ellas/Ellos solo-bodas, desacoplar
  playlist/regalos, re-publicar, fotos en grande, post-confirmación).
- El preview desktop **embutido** en el panel del editor (escalado con
  `transform: scale`). Se descarta a propósito: un preview en columna angosta
  miente. El preview desktop honesto es la vista completa en pestaña nueva.

## Diseño

### 1. Primitiva compartida `SectionShell`

Un componente de layout, único lugar donde vive el ancho y el ritmo vertical de
la invitación. Ubicación: `app/components/invitacion/SectionShell.tsx`.

Props:
- `variant: 'hero' | 'band'`
- `bleed?: boolean` — si el fondo debe ir edge-to-edge (hero) o no
- `className?` para el `<section>` externo (fondo, etc.)
- `children`

Responsabilidad: renderizar el `<section>` externo (full-bleed cuando aplica) y
un contenedor interno centrado con `max-width` y `padding` responsivos. Nada de
lógica de negocio.

Anchos de contenido (única fuente de verdad, dentro del Shell):

| variante | móvil | tablet (sm/md) | desktop (lg) |
|---|---|---|---|
| `hero` | full, centrado | ~`max-w-2xl` | ~`max-w-3xl`, título grande |
| `band` | full | ~`max-w-xl` | ~`max-w-2xl` |

Ritmo vertical: el `py` crece con el breakpoint (hoy es fijo y por eso se ve
apretado). El `px` también gana aire en pantallas grandes.

### 2. Aplicar el Shell a las secciones

- **Portada** y **Cierre** → `hero` (full-bleed, su propio fondo crema a todo el
  ancho, título escalado grande en desktop).
- **Saludo, Detalles, Dress code, Itinerario, Enganche, Texto** → `band`.
- **RSVP** → `band` pero acotado al ancho de un formulario cómodo (no se estira a
  todo el ancho en desktop; los formularios anchos se leen mal). Se queda en un
  máximo tipo `max-w-lg`.

Cada sección deja de definir su ancho/padding a mano; los toma del Shell. Las
tarjetas internas que hoy usan `max-w-sm` se sueltan para que respiren dentro del
nuevo ancho, o se suben de tope según la sección.

### 3. Contenedor de página

En `InvitacionClient.tsx` se elimina el wrapper `max-w-[480px]`. El fondo crema
queda a nivel de página (`min-h-screen bg-[#FBF7F0]`), full-bleed real, y el
ancho lo decide cada sección vía Shell.

### 4. Botón "Abrir vista completa" (extra)

- Ruta nueva de preview del dueño: `app/events/[id]/invitacion/preview/page.tsx`.
  Client component, auth por página como el resto (`supabase.auth.getUser()`,
  restringida al dueño/colaborador del evento). Carga el `invite_config` guardado
  + contexto del evento (mismo dato que el editor arma como `sampleCtx`) y
  renderiza `<InvitacionRenderer>` dentro del **mismo contenedor de página
  responsive** que la ruta pública. Sin frame de teléfono. No requiere publicar.
- Botón en el toolbar del editor (`app/events/[id]/invitacion/page.tsx`) que abre
  esa ruta en pestaña nueva (`target="_blank"`).
- El preview del editor con frame de teléfono (`page.tsx:228`) **no se toca**: es
  el WYSIWYG mobile del planner.

## Verificación

Manual en vivo (local → preview Vercel), a tres anchos: móvil (~390px), tablet
(~768px), desktop (~1280px). Revisar cada sección y el flujo RSVP funcional (que
no se rompa nada al cambiar la envoltura). El botón "Abrir vista completa" abre la
ruta correcta a ancho completo. Es UI: no hay lógica pura nueva para Vitest.

## Riesgo

Bajo. Cambio aditivo y reversible: ninguna sección cambia su contenido ni su
comportamiento, solo su envoltura de layout. El Shell centraliza el ancho, así
que un ajuste posterior ("más aire en desktop", "más compacto en tablet") es un
solo cambio en un solo archivo.
