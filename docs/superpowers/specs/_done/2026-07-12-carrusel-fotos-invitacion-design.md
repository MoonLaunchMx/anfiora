# Carrusel de fotos en la invitacion — Design

Fecha: 2026-07-12
Rama: `feat/invitacion-mobile-editor` (worktree `invitacion-mobile`)
Estado: aprobado por Diego, listo para plan de implementacion.

## Problema / idea

Hoy la invitacion tiene un bloque `media` que muestra **una** imagen o GIF. Diego
quiere poder subir **varias fotos** (hasta ~5) y mostrarlas como **carrusel** con una
animacion "divertida o padre". El carrusel es un bloque nuevo, independiente del dress
code (que ya tiene sus propias fotos con lightbox).

## Objetivo

Una **seccion nueva "Carrusel de fotos"** que el planner agrega como cualquier otro
bloque, sube varias fotos desde el celular (galeria/camara) o URL, y elige el **estilo
de animacion** desde Personalizar. La invitacion publica muestra el carrusel con
auto-avance, swipe y puntitos.

## Decisiones tomadas (con Diego)

- **Estilos seleccionables**, no uno fijo. Viven en **Personalizar** (patron de
  `FondoControls` / `AnimControls`), son **globales** de la invitacion (como el fondo).
- **Set inicial de 4 estilos:** `fundido`, `zoom` (Ken Burns), `deslizar`, `polaroid`.
- **Hasta 8 fotos** por carrusel (el "5" de Diego cabe holgado).
- **Cero migracion de tablas**: todo vive en el doc JSON (`event_settings.invite_config`
  ya existente). Se extiende el schema Zod tolerante a docs viejos.
- Reusa el patron de subida ya implementado (`uploadImageToBucket` -> bucket
  `event-media`, subcarpeta `imagenes/{eventId}/`, policy amplia ya existente).

## Arquitectura

### Schema (`lib/invite/schema.ts`)

Nuevo content y nuevo tipo de seccion:

```ts
const GaleriaContent = z.object({
  fotos: z.array(z.string()).default([]),   // URLs (subidas o pegadas)
  titulo: z.string().default(''),           // titulo opcional arriba del carrusel
})
```

- Agregar `galeria: GaleriaContent` a `CONTENT_BY_TYPE`.
- Agregar la variante al `SectionSchema` discriminated union.
- `SECTION_TYPES` se deriva solo (no tocar).

Estilo del carrusel en el **theme** (global), tolerante a docs viejos:

```ts
// en ThemeSchema
carrusel: z.object({
  estilo: z.enum(['fundido', 'zoom', 'deslizar', 'polaroid']).default('fundido'),
}).default(() => ({ estilo: 'fundido' })),
```

La migracion existente (`InviteDoc` v2, `ThemeSchema.safeParse` con fallback a
`DEFAULT_THEME`) ya cubre docs sin `carrusel`: el `.default` de Zod lo rellena. Verificar
que `DEFAULT_THEME` incluya `carrusel: { estilo: 'fundido' }`.

### Doc helpers (`lib/invite/doc.ts`)

- `emptySection('galeria')` -> `{ fotos: [], titulo: '' }`.
- Las fotos se editan con `updateSectionContent(doc, id, { fotos: nextArray })`
  (mismo mecanismo que el resto; el editor arma el array nuevo y lo pasa entero).

### Section catalog (`lib/invite/section-catalog.ts`)

- Mapear `galeria` a la categoria **Visuales** (junto a `media`/`video`). El `Record`
  tipado obliga a categorizar; tsc falla si se olvida.

### Editor — SectionForm (`app/events/[id]/invitacion/SectionForm.tsx`)

Nuevo `case 'galeria'`:

- **Titulo opcional** (`TextField`).
- **Grid de miniaturas** de `content.fotos`: cada una con boton **quitar** (X) y
  **reordenar** (flechas `‹ ›` o drag; v1 = flechas para mantenerlo simple).
- **Boton "Agregar fotos"**: reusa el patron de `ImageUploadButton` pero **acumula** en
  el array (no reemplaza). Un `<input type="file" accept="image/*" multiple>` permite
  elegir varias de una; cada archivo valida (imagen, <=15 MB) y se sube a
  `imagenes/{eventId}/`; al terminar, `onPatch({ fotos: [...fotos, ...nuevasUrls] })`.
- **Limite 8**: si ya hay 8, se oculta/deshabilita el boton de agregar con nota.
- Generalizar la subida: extraer un `MultiImageUploadField` reutilizable, o un helper
  `uploadImageToBucket` (ya existe) llamado en loop con estado de "Subiendo N…".

### Personalizar — CarruselControls (`app/events/[id]/invitacion/CarruselControls.tsx`)

- Nuevo componente estilo `FondoControls`: galeria de 4 tarjetas (una por estilo) con
  **mini-preview en vivo** y seleccion. Setea `theme.carrusel.estilo`.
- Se monta en `PersonalizarPanel.tsx` como una seccion mas ("Carrusel"), consistente con
  Fondo / Animaciones RSVP / Colores.
- El mini-preview puede usar 2-3 imagenes placeholder para ilustrar el movimiento.

### Renderer — GaleriaSection (`app/components/invitacion/sections/GaleriaSection.tsx`)

- Envuelto en `SectionShell` (variante band full-bleed que crece, como los otros
  bloques visuales). Titulo opcional arriba.
- Marco de foto **4:5** (`object-cover`), esquinas redondeadas, respeta el tema.
- Lee `doc.theme.carrusel.estilo` (via prop, como los demas renderers reciben theme) y
  `content.fotos`.
- **Comportamiento comun a todos los estilos:**
  - Auto-avance cada ~4s (setInterval, limpio al desmontar).
  - Swipe manual (reusar patron de `@dnd-kit`? no — swipe simple con Framer Motion
    `drag="x"` + threshold, o el patron de swipe que ya usa el lightbox del dress code).
  - Puntitos (dots) abajo indicando la foto activa; tap en un dot salta a esa foto.
  - Pausa el auto-avance al interactuar (touch/hover), reanuda despues.
  - Guard `prefers-reduced-motion`: sin auto-avance ni zoom; queda swipe manual estatico.
  - Si hay 0 fotos: no renderiza (o placeholder solo en preview del editor).
  - Si hay 1 foto: la muestra fija, sin dots ni auto-avance.
- **Los 4 estilos** (todos con `AnimatePresence` de Framer Motion):
  - `fundido`: cross-fade (opacity) entre foto saliente y entrante.
  - `zoom`: la foto activa hace un `scale` lento (1.0 -> ~1.12) + leve paneo durante los
    ~4s (Ken Burns); transicion de cambio = fade corto.
  - `deslizar`: slide horizontal (x: 100% -> 0 -> -100%) con snap; direccion segun avance.
  - `polaroid`: cada foto con marco blanco (padding + sombra) y rotacion leve alternada
    (-3deg/+3deg); entra "cayendo" (y desde arriba + rotacion) y sale desvaneciendo.

### Integracion del renderer

- Agregar `galeria` al switch/map del renderer de secciones (donde se enrutan
  `media`/`video`/etc. a su componente), pasando `theme` (o `theme.carrusel.estilo`) y
  `content`.
- `TYPE_LABELS` en `BlockEditor.tsx`: `galeria: 'Carrusel de fotos'`.
- **No singleton**: se pueden agregar varios carruseles (comparten el estilo global del
  theme). No se agrega a `SINGLETON_TYPES`.

## Reuso y consistencia

- Subida de imagenes: mismo bucket/policy que `media` y `audio` (no requiere infra nueva;
  ya confirmado que la policy de `event-media` es amplia por bucket para authenticated).
- Estilo de tarjetas de estilo en Personalizar: copiar el patron visual de
  `FondoControls` (grid, mini-preview, seleccion con borde acento).
- Swipe/gestos: reusar el patron ya probado del lightbox de `DressCodeSection`.

## Datos y persistencia

- Todo en `event_settings.invite_config` (JSONB) via el doc. **Sin cambios de tablas ni
  policies.** Autoguardado ya existente del editor persiste `fotos`, `titulo` y
  `theme.carrusel.estilo`.

## Testing

- **Vitest (logica pura):**
  - Migracion: doc viejo sin `theme.carrusel` -> parsea con `estilo: 'fundido'`.
  - `emptySection('galeria')` -> `{ fotos: [], titulo: '' }`.
  - Helper de agregar/quitar/reordenar foto en el array (si se extrae a funcion pura,
    testearla; p.ej. `addFotos`, `removeFotoAt`, `moveFoto`).
  - Catalogo: `galeria` cae en categoria Visuales (`groupSectionTypes`).
- **Manual (UI + I/O):** subir varias fotos desde el celular, ver el carrusel en preview
  movil y escritorio, probar los 4 estilos, swipe, dots, auto-avance, reduce-motion,
  limite de 8, quitar y reordenar. Flujo local (3010) -> prod.

## Fuera de alcance (v1)

- Captions por foto individual.
- Velocidad/intervalo configurable por el usuario.
- Transiciones 3D tipo "cartas"/coverflow (posible estilo #5 futuro).
- Reordenar por drag-and-drop (v1 usa flechas; dnd puede venir despues).
- Video dentro del carrusel (solo imagenes/GIF).

## Riesgos / notas

- **Peso/performance:** 8 fotos grandes pueden pesar. Mitigacion v1: validar <=15 MB por
  foto (como audio) y `loading="lazy"` en las no activas; optimizacion server-side de
  imagenes queda fuera de v1.
- **Autoplay + reduce-motion:** obligatorio respetar la preferencia del sistema.
- **Estilo global vs por-seccion:** se eligio global (theme) por consistencia con
  Personalizar; si a futuro se quieren estilos distintos por carrusel, mover `estilo` a
  `GaleriaContent` (aditivo, retrocompat).
