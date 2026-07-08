# Feedback en UserMenu + Tours de producto (driver.js)

Fecha: 2026-07-07
Estado: aprobado (brainstorming) — pendiente de plan de implementacion

## Contexto

Anfiora tiene hoy un boton flotante de feedback (`FeedbackWidget`) que aparece
fijo en toda pantalla autenticada. El patron de boton flotante quedo obsoleto en
SaaS: tapa contenido, compite con los CTA de cada pantalla y en mobile se encima
con el bottom-nav y los FAB de WhatsApp.

Ademas, la app tiene muchos modulos (invitados, mesas, timeline, presupuesto,
proveedores, pagos, mensajes, playlist, album, comida, invitacion) y no existe
onboarding guiado. Un usuario nuevo no tiene forma de entender cada seccion.

Este spec cubre dos piezas independientes que comparten el mismo destino (el menu
de usuario):

- **Parte A** — mover feedback al menu de usuario y consolidar ese menu.
- **Parte B** — tours de producto con driver.js (welcome global + guia por modulo).

## Estado actual (lo que ya existe)

- `app/components/FeedbackWidget.tsx` — boton flotante negro (`MessageSquarePlus`)
  que dispara Tally `oblyB5`. Se monta global en `app/layout.tsx:65`. Solo se
  muestra si hay sesion.
- `app/events/[id]/layout.tsx` — contiene `AvatarDropdown` (menu de avatar con
  "Mi perfil" y "Cerrar sesion"). Usa `userName`, `userEmail`, `getInitials`,
  `handleLogout`, estado `avatarOpen`. Existe en dos renders (sidebar desktop
  colapsado/expandido y bottom-nav mobile).
- `app/dashboard/page.tsx` — tiene un boton "Mi perfil" suelto (~linea 612), no un
  menu completo.
- `app/components/WhatsNewModal.tsx` + `lib/changelog.ts` — patron de "visto por
  version" con `localStorage` (`anfiora_seen_version` vs `CURRENT_VERSION`).
- No hay ninguna libreria de tours en el stack.

---

## Parte A — Feedback en el menu de usuario

### Decision

Eliminar el boton flotante y mover feedback a un item dentro del **menu de
usuario (avatar)**, disponible en todas las pantallas autenticadas. Consolidar el
menu hoy semi-duplicado en un solo componente reutilizable `UserMenu`.

### Componente nuevo: `app/components/UserMenu.tsx`

Un solo componente cliente que encapsula el menu de avatar. Reemplaza el
`AvatarDropdown` inline de `events/[id]/layout.tsx` y el boton "Mi perfil" suelto
del dashboard.

Responsabilidad unica: renderizar el avatar (iniciales) + el dropdown con las
acciones de cuenta. No sabe de eventos ni de nav.

Contenido del dropdown (orden):

1. Cabecera: `userName` + `userEmail` (como hoy).
2. **Mi perfil** (`User` icon) — navega a `/perfil`.
3. **Enviar feedback** (`MessageSquarePlus` icon) — dispara Tally `oblyB5`.
4. **Ver guia de esta seccion** (`HelpCircle` icon) — dispara el tour del modulo
   actual (ver Parte B). Solo visible si existe un tour para la ruta actual.
5. Toggle **"Mostrar guias automaticamente"** (ver Parte B) — switch en el menu.
6. Separador.
7. **Cerrar sesion** (`LogOut` icon, rojo) — `handleLogout`.

Props: `{ userName, userEmail }` y callbacks (`onLogout`). El disparo de Tally y
del tour se hace via `data-tally-open` / evento `window`, no requiere logica del
padre.

### Feedback (Tally)

- Se conserva el mismo formulario Tally (`data-tally-open="oblyB5"`, emoji wave).
- El script de Tally (`https://tally.so/widgets/embed.js`) se sigue cargando una
  vez; se mueve del `FeedbackWidget` a donde viva el `UserMenu` (o se deja un
  loader minimo). El item del menu lleva los `data-tally-*`.
- Se pasa `data-page` con el pathname actual (como hoy) para saber desde donde
  reportan.

### Cambios de archivos (Parte A)

- **Crear** `app/components/UserMenu.tsx`.
- **Editar** `app/events/[id]/layout.tsx` — reemplazar `AvatarDropdown` inline por
  `<UserMenu />` en los tres puntos de render (sidebar expandido, colapsado,
  bottom-nav mobile).
- **Editar** `app/dashboard/page.tsx` — reemplazar el boton "Mi perfil" suelto por
  `<UserMenu />`.
- **Editar** `app/layout.tsx` — quitar el `<FeedbackWidget />` global.
- **Borrar** `app/components/FeedbackWidget.tsx` (su logica de auth/tally migra al
  `UserMenu` / loader).

### Fuera de alcance (Parte A)

- No se cambia el formulario de Tally.
- No se agregan menus de usuario a paginas publicas (landing, invitacion, playlist
  publica) — ahi no hay sesion.

---

## Parte B — Tours de producto (driver.js)

### Decision

Onboarding hibrido con **driver.js**: un tour de bienvenida global + una guia
corta por cada modulo. Cobertura completa (todos los modulos tienen guia), con
control total del usuario sobre si las ve.

### Libreria

- `driver.js` (^1.6.0, licencia MIT, ~5 KB, cero dependencias, 100% cliente).
- Requiere instalar 1 paquete — **pedir permiso antes de instalar** (regla del
  repo).
- Se estiliza con CSS (`popoverClass: "anfiora-tour"`) para heredar los tokens de
  marca (`--accent` dorado, botones teal `#48C9B0`, fuentes del sistema). Sin
  colores hardcodeados que rompan el look flat.
- Respeta `prefers-reduced-motion`.

### Arquitectura (3 piezas)

Se replica el patron probado en Cuantix, adaptado a Anfiora.

**1. Pasos como datos puros — `lib/tour/steps.ts`**

Un **registro de tours** (no un solo array). Cada tour:

```ts
type TourStep = {
  element: string | null      // selector data-tour="..." o null = globo centrado
  title: string               // texto en espanol directo (NO i18n — Anfiora es es-only)
  description: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
}

type TourDef = {
  key: string                 // 'welcome' | 'presupuesto' | 'proveedores' | ...
  seenKey: string             // 'anfiora_tour_seen_presupuesto_v1'
  matchPath: (pathname: string) => boolean  // en que ruta vive este tour
  autoStart: boolean          // welcome: true; modulos: sujeto al switch global
  steps: TourStep[]
}

export const TOURS: Record<string, TourDef>
```

Testeable en Node sin DOM (Vitest) — se puede validar que cada tour tenga pasos,
que las seenKey sean unicas y lleven sufijo de version.

Tours a definir:

- `welcome` — 5 a 7 pasos, globos centrados + primeros elementos del nav. Ultimo
  paso con **CTA** ("Agrega tu primer invitado") que navega. Auto-arranca una vez.
- Un tour por modulo, **corto (2 a 4 pasos)**: `invitados`, `mesas`, `timeline`,
  `presupuesto`, `proveedores`, `pagos`, `mensajes`, `playlist`, `album`,
  `comida`, `invitacion`. (Se pueden entregar por olas; el motor no depende de que
  esten todos.)

**2. Controlador — `app/components/tour/ProductTour.tsx`**

- Client component, se monta una vez en `app/events/[id]/layout.tsx` (donde viven
  los modulos). No pinta nada (`return null`).
- Resuelve cada `data-tour` al **nodo visible** en runtime; omite pasos cuyo
  elemento no esta montado **o no es visible** (critico: sidebar desktop y
  bottom-nav mobile coexisten en el DOM).
- Elige el tour segun la ruta actual (`matchPath`).
- **Auto-arranque:**
  - `welcome`: si no esta visto, arranca ~700 ms tras cargar (una vez).
  - modulo: si no esta visto **y** el switch global "guias automaticas" esta
    encendido, arranca ~700 ms tras entrar al modulo (una vez).
- Escucha un evento `window` `anfiora:start-tour` (con `detail.key` opcional) para
  **relanzar on-demand** desde el `UserMenu`. On-demand ignora el estado "visto".
- Marca "visto" en `localStorage` al completar/cerrar (`seenKey`).

**3. Cableado — atributos `data-tour`**

Agregar `data-tour="..."` a los elementos clave (items de nav, botones de "agregar",
HealthBar de presupuesto, toggle de handoff en mensajes, etc.). No invasivo.

### Control del usuario (3 niveles)

1. **Welcome** auto una sola vez (unica cosa que aparece sin pedirla).
2. **Switch global "Mostrar guias automaticamente"** en el `UserMenu` (encendido
   por defecto), en `localStorage` (`anfiora_tours_autostart`, default `true`).
   - Encendido: cada modulo muestra su guia una vez al entrar por primera vez.
   - Apagado: nada aparece solo; el usuario las lanza a mano.
3. **On-demand siempre:** "Ver guia de esta seccion" en el `UserMenu` relanza el
   tour del modulo actual, aunque ya este visto o el switch este apagado.

### Persistencia (sin Supabase)

Todo en `localStorage`, consistente con `WhatsNewModal`:

- `anfiora_tour_seen_<key>_v1` — por tour visto.
- `anfiora_tours_autostart` — switch global (default `true`).
- Sufijo de version por tour permite "reintroducir" un modulo si se rediseña
  (subir a `_v2`), igual que `CURRENT_VERSION` del changelog.

No toca la DB, respeta la regla de "no tablas nuevas".

### Theming (CSS)

- Popover con clase `.anfiora-tour` en `globals.css`.
- Fondo blanco, borde `--border`, texto `--text` / `--text-sec`, boton primario
  teal `#48C9B0`, boton secundario neutro. Radio y sombra consistentes con los
  modales existentes.
- Overlay oscuro semitransparente estandar de driver.js.

### Cambios de archivos (Parte B)

- **Instalar** `driver.js` (con permiso).
- **Crear** `lib/tour/steps.ts` (registro de tours).
- **Crear** `app/components/tour/ProductTour.tsx` (controlador).
- **Editar** `app/globals.css` — estilos `.anfiora-tour`.
- **Editar** `app/events/[id]/layout.tsx` — montar `<ProductTour />`, agregar
  `data-tour` a items de nav.
- **Editar** las paginas de modulo — agregar `data-tour` a elementos clave (por
  ola).
- **Editar** `app/components/UserMenu.tsx` — items "Ver guia de esta seccion" +
  switch "Mostrar guias automaticamente" (dispara evento / escribe localStorage).
- **Crear** test Vitest `lib/tour/steps.test.ts` — valida integridad del registro.

### Fuera de alcance (Parte B)

- No hay analytics de completado de tour en esta version (se puede sumar despues
  via PostHog).
- No hay tours en paginas publicas.
- No se cubren `/admin` ni `/perfil` con tour.

---

## Orden de implementacion sugerido

1. **Parte A** completa (consolidar `UserMenu` + mover feedback + quitar flotante).
   Es autocontenida y de valor inmediato.
2. **Parte B, motor:** instalar driver.js, `steps.ts` con `welcome`, `ProductTour`,
   theming, cableado del welcome, switch + item on-demand en `UserMenu`.
3. **Parte B, olas de modulos:** ir agregando tours de modulo (empezando por los
   mas densos: presupuesto, proveedores, mensajes, timeline) uno o dos por PR.

## Verificacion

- Vitest para `steps.ts` (logica pura).
- Manual local -> preview -> main para UI: menu de usuario en dashboard y evento,
  feedback abre Tally, welcome auto-arranca una vez, switch on/off, on-demand
  relanza, pasos ocultos se omiten en desktop vs mobile.
