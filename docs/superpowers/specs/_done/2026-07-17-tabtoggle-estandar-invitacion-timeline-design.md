# Estándar TabToggle: secciones vs vistas (Invitación + Timeline)

**Fecha:** 2026-07-17
**Tipo:** Ajuste de UI / sistema de diseño
**Alcance:** dos archivos de código, en dos pasos
(`app/events/[id]/invitacion/page.tsx`, luego `app/events/[id]/timeline/page.tsx`)

## Problema

Dentro de una feature, hoy conviven dos componentes distintos para moverse entre
sub-secciones, y se usan de forma inconsistente:

- **Switcher negro** (`bg-[#1D1E20] text-white`): Invitación (Diseño / Enviar) y
  Timeline (Tareas / Calendario / Itinerario).
- **Toggle pastilla** (`TabToggle`, `app/components/ui/TabToggle.tsx`): Mesa de
  regalos (Regalos / Recibidos / Configuración).

Dos problemas concretos:

1. El switcher negro contradice la regla del proyecto ("negro `#1D1E20` solo para
   dropdowns de filtro").
2. Ambas features **mezclan secciones distintas con vistas del mismo contenido**
   en el mismo control:
   - En Invitación, "cómo entra la gente" (acceso) vive escondido dentro de la
     pestaña "Enviar", mezclado con el reparto de links.
   - En Timeline, "Itinerario" (el Day-Of, una sección con vida propia) está
     metido a la fuerza como si fuera una tercera **vista** de las tareas, junto a
     Lista y Calendario. No es una vista de las tareas: es otra sección.

## Principio de diseño

Dos controles, dos propósitos distintos, y **pueden anidarse**:

- **`TabToggle` (toggle pastilla) = navegar entre SECCIONES distintas** de una
  feature (contenidos/propósitos diferentes), incluida "Configuración". Es el
  estándar.
- **Switcher negro `#1D1E20` = alternar entre VISTAS del mismo contenido** (mismos
  datos, distinta representación).

Una feature puede tener ambos anidados: el `TabToggle` separa las secciones y,
dentro de una sección, el switcher negro alterna sus vistas.

Se descartó la alternativa "ícono de engrane + modal" para la configuración porque
**ese patrón no existe en ninguna parte de la app** — introducirlo sería inventar
una convención nueva.

---

## Paso 1 — Invitación

Un archivo: `app/events/[id]/invitacion/page.tsx`.

Hoy: switcher negro con dos pestañas (Diseño / Enviar). "Enviar" renderiza
`<AccesoPanel>` (cómo entra la gente) **+** `<RepartoLinks>` (reparto de links)
juntos.

Cambio:

1. **Reemplazar la barra negra** (hoy ~líneas 269-282) por `<TabToggle>` de
   `@/app/components/ui/TabToggle`.
2. **Pasar de 2 a 3 pestañas:** `Diseño` · `Enviar` · `Configuración`.
   - Iconos Lucide: `LayoutGrid` · `Send` · `Settings` (agregar `Settings` al
     import).
   - Ampliar `TabKey` de `'diseno' | 'enviar'` a `'diseno' | 'enviar' | 'config'`.
   - Definir el array `TABS: TabItem[]`.
3. **Repartir el contenido de "Enviar":**
   - **Enviar** → solo `<RepartoLinks>` (repartir los links: la acción de enviar).
   - **Configuración** → `<AccesoPanel>` (cómo entra la gente). Se mueve entero,
     sin partirse; su link público compartido viaja con el acceso porque solo
     existe cuando el evento es público.

Comportamiento heredado (aceptado):

- En mobile, `TabToggle` es inline/centrado (como Mesa de regalos), ya no ancho
  completo. Consistente.
- El FAB "Vista previa" sigue condicionado a `activeTab === 'diseno'`.
- La pestaña inicial sigue siendo `'diseno'`.

---

## Paso 2 — Timeline

Un archivo: `app/events/[id]/timeline/page.tsx`.

Hoy: un único switcher negro con tres botones — `Tareas` (que en realidad es
`view='lista'`), `Calendario` (`view='calendario'`) e `Itinerario`
(`view='itinerario'`). Los filtros/búsqueda/"Generar plan"/"Agregar" se muestran
cuando `view !== 'itinerario'`; cuando es itinerario se muestra
`<ItineraryToolbar>`. El cuerpo renderiza `<ListView>` / `<CalendarView>` /
`<ItineraryView>` según la vista.

Modelo nuevo, de dos niveles:

```
Timeline
├─ TabToggle (secciones)        →  [ Tareas ]  [ Itinerario ]
├─ Tareas    → switcher negro   →  Lista | Calendario   (+ filtros, Generar plan, Agregar)
└─ Itinerario → su propia sección (ItineraryToolbar + ItineraryView)
```

Cambio:

1. **Introducir estado de sección**, p.ej. `section: 'tareas' | 'itinerario'`
   (default `'tareas'`), controlado por un `<TabToggle>` con dos entradas:
   - `Tareas` (icono `LayoutList`), `Itinerario` (icono `Clock`).
2. **Reducir el switcher negro a dos vistas de tareas:** `view: 'lista' |
   'calendario'` (quitar `'itinerario'` del union). Renombrar el botón "Tareas"
   del switcher a **"Lista"** (ya no tiene sentido "Tareas > Tareas" dentro de la
   sección Tareas). El switcher negro solo se muestra en la sección Tareas.
3. **Reubicar toolbars y cuerpo por sección:**
   - **Sección Tareas:** switcher negro Lista/Calendario + toolbar de
     filtros/búsqueda/Generar plan/Agregar + cuerpo `<ListView>` /
     `<CalendarView>`.
   - **Sección Itinerario:** `<ItineraryToolbar>` + cuerpo `<ItineraryView>`.
     Itinerario queda con su propio lienzo para crecer al Day-Of.
4. Ajustar el hook `useItinerary(...)` para que se active con
   `section === 'itinerario'` en vez de `view === 'itinerario'`.

Notas:

- Itinerario ya tiene componente y toolbar propios (`ItineraryView`,
  `ItineraryToolbar`), así que la extracción es limpia; no se rediseña su interior
  en este paso, solo se le da su sección.
- Revisar que las stats/StatsCollapse y el header superior sigan coherentes con la
  nueva sección activa.

---

## Fuera de alcance

- Rediseñar el interior de `AccesoPanel`, `RepartoLinks`, `ItineraryView` o
  `ItineraryToolbar` — solo se reubican.
- Convertir Itinerario en un ítem de nav propio (sigue viviendo dentro de
  Timeline, como sección).
- Migrar el resto de la app al estándar `TabToggle`. El principio queda
  documentado; futuras migraciones son trabajo explícito aparte.
- Mesa de regalos no se toca (ya cumple el estándar).

## Orden de implementación

Un paso a la vez. **Paso 1 (Invitación) primero** — es el más chico y ya estaba
scopeado. **Paso 2 (Timeline) después** — es una restructura mayor del header.
Cada paso se verifica antes de pasar al siguiente.

## Verificación (manual — features con I/O de Supabase)

**Paso 1 — Invitación:**
1. `localhost:3000` → evento → Invitación.
2. Toggle con tres pestañas estilo pastilla, ícono teal en la activa.
3. Diseño: sub-tabs y preview intactos.
4. Enviar: solo reparto de links, sin el bloque de acceso.
5. Configuración: aparece "cómo entra la gente" y guarda correctamente.
6. Mobile: toggle centrado sin desbordar; FAB de preview solo en Diseño.

**Paso 2 — Timeline:**
1. Evento → Timeline.
2. Toggle pastilla con dos secciones: Tareas / Itinerario.
3. Sección Tareas: switcher negro Lista/Calendario, filtros, Generar plan,
   Agregar, y las tarjetas de tarea. Cambiar entre Lista y Calendario funciona.
4. Sección Itinerario: su toolbar y su vista; sin el switcher de vistas de tareas
   ni los filtros de tareas.
5. Mobile: ambos controles caben y no desbordan.
