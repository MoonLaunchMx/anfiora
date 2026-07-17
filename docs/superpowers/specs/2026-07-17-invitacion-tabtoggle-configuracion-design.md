# Invitación: TabToggle estándar + pestaña Configuración para el acceso

**Fecha:** 2026-07-17
**Tipo:** Ajuste de UI / sistema de diseño
**Alcance:** un solo archivo de código (`app/events/[id]/invitacion/page.tsx`)

## Problema

Dentro de una feature, hoy conviven dos componentes distintos para moverse entre
sub-secciones:

- **Switcher negro** (`bg-[#1D1E20] text-white`): lo usan Invitación (Diseño /
  Enviar) y Timeline (Lista / Calendario / Itinerario).
- **Toggle pastilla** (`TabToggle`, `app/components/ui/TabToggle.tsx`): lo usa
  Mesa de regalos (Regalos / Recibidos / Configuración).

Esa doble convención genera inconsistencia. Además, el switcher negro contradice
la regla de diseño del proyecto ("negro `#1D1E20` solo para dropdowns de filtro").

En paralelo, la configuración de acceso de la invitación ("cómo entra la gente":
privada/pública, cupo, aprobación, precio, acompañantes) vive escondida dentro de
la pestaña "Enviar", mezclada con el reparto de links. No tiene un lugar propio.

## Decisiones

### Decisión 1 — Componente estándar

- **`TabToggle` (toggle pastilla) es el estándar** para navegar entre **secciones
  distintas** de una feature, incluida "Configuración".
- **El switcher negro `#1D1E20` se reserva para vistas del mismo contenido**
  (mismos datos, distinta representación).

**Consecuencia:** Timeline (Lista / Calendario / Itinerario) *sí* son vistas del
mismo contenido, así que **se queda con el switcher negro** — el principio valida
dejarlo como está. **Timeline no se modifica en este trabajo.**

### Decisión 2 — Ubicación del acceso

"Cómo entra la gente" pasa a ser **su propia pestaña "Configuración"** dentro del
`TabToggle` de la invitación, exactamente como Mesa de regalos.

Se descartó la alternativa "ícono de engrane + modal" porque **ese patrón no
existe en ninguna parte de la app** — introducirlo sería inventar una convención
nueva.

## Cambio a implementar

Un solo archivo: `app/events/[id]/invitacion/page.tsx`.

1. **Reemplazar la barra negra** (hoy líneas ~269-282) por el componente
   `<TabToggle>` de `@/app/components/ui/TabToggle`.

2. **Pasar de 2 a 3 pestañas:** `Diseño` · `Enviar` · `Configuración`.
   - Iconos Lucide: `LayoutGrid` (Diseño) · `Send` (Enviar) · `Settings`
     (Configuración). Agregar `Settings` al import de `lucide-react`.
   - Ampliar el tipo `TabKey` de `'diseno' | 'enviar'` a
     `'diseno' | 'enviar' | 'config'`.
   - Definir el array `TABS: TabItem[]` con esas tres entradas.

3. **Repartir el contenido de la antigua pestaña "Enviar":**
   - **Enviar** → renderiza **solo** `<RepartoLinks eventId={...} event={...} />`
     (repartir los links personales: la acción de enviar).
   - **Configuración** → renderiza `<AccesoPanel eventId={...} event={...} />`
     (cómo entra la gente). `AccesoPanel` se mueve **entero**, sin partirse; su
     link público compartido viaja con el acceso porque solo existe cuando el
     evento es público.

## Comportamiento heredado (aceptado)

- En **mobile**, `TabToggle` es inline/centrado (como Mesa de regalos), ya no
  ocupa el ancho completo como la barra negra actual. Es el comportamiento
  consistente deseado.
- El **FAB "Vista previa"** en mobile sigue condicionado a `activeTab === 'diseno'`
  (sin cambio).
- Al agregar la tercera pestaña, la pestaña inicial sigue siendo `'diseno'`.

## Fuera de alcance

- Timeline y cualquier otra feature.
- Rediseñar el contenido interno de `AccesoPanel` o `RepartoLinks` — solo se
  reubican.
- Migrar el resto de la app al estándar `TabToggle` (el principio queda
  documentado; la migración, si se hace, es trabajo aparte y explícito).

## Verificación

Manual (feature con I/O de Supabase, no hay lógica pura nueva):

1. `localhost:3000` → abrir un evento → Invitación.
2. Confirmar que el toggle muestra tres pestañas con el estilo pastilla y ícono
   teal en la activa.
3. **Diseño**: sub-tabs y preview intactos.
4. **Enviar**: aparece solo el reparto de links, sin el bloque de acceso.
5. **Configuración**: aparece "cómo entra la gente" (modos de acceso, cupo,
   aprobación, precio, acompañantes) y guarda correctamente.
6. Revisar responsivo mobile (toggle centrado, no desborda) y FAB de preview solo
   en Diseño.
