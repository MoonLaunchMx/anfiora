# TabToggle estándar (Invitación + Timeline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estandarizar la navegación entre sub-secciones usando `TabToggle`, reservando el switcher negro para vistas del mismo contenido; y mover "cómo entra la gente" a su pestaña Configuración en Invitación e Itinerario a su propia sección en Timeline.

**Architecture:** Dos cambios de UI independientes, un archivo cada uno. Se reemplaza el switcher negro por el componente compartido `TabToggle` (toggle pastilla) para separar SECCIONES; el switcher negro se conserva solo donde alterna VISTAS del mismo contenido (Lista/Calendario de tareas). Sin cambios de datos ni de schema.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Lucide, componente `app/components/ui/TabToggle.tsx`.

## Global Constraints

- Solo Tailwind CSS, sin inline styles salvo excepción justificada.
- UI con acentos en español (Diseño, Configuración).
- Negro `#1D1E20` solo para el switcher de vistas (Lista/Calendario) y filtros; nunca para navegar secciones.
- Botones CTA en teal `#48C9B0`.
- Iconos Lucide.
- No unit tests para UI: se verifica con `npm run lint`, `npm run build` y a mano en `localhost:3000`.
- Commits convencionales, sin acentos ni ñ.
- Componente estándar: `import { TabToggle, type TabItem } from '@/app/components/ui/TabToggle'`.

---

### Task 1: Invitación — TabToggle de 3 pestañas + acceso en Configuración

**Files:**
- Modify: `app/events/[id]/invitacion/page.tsx`

**Interfaces:**
- Consumes: `TabToggle` (props `tabs: TabItem[]`, `active: string`, `onChange: (key: string) => void`), `TabItem { key, label, shortLabel?, icon: LucideIcon, badge? }`. Componentes existentes `AccesoPanel`, `RepartoLinks` (props `{ eventId, event }`).
- Produces: nada que otra task consuma.

- [ ] **Step 1: Ampliar imports**

En `app/events/[id]/invitacion/page.tsx` línea 6, agregar `Settings` al import de lucide y agregar el import de TabToggle debajo:

```tsx
import { Send, Check, LayoutGrid, Eye, X, Maximize2, Plus, RotateCcw, AlertTriangle, Settings } from 'lucide-react'
import { TabToggle, type TabItem } from '@/app/components/ui/TabToggle'
```

- [ ] **Step 2: Ampliar el tipo de pestaña**

Línea 27, agregar `'config'`:

```tsx
type TabKey = 'diseno' | 'enviar' | 'config'
```

- [ ] **Step 3: Definir el array de pestañas**

Dentro del componente, junto a los demás `const` de render (antes del `return`), agregar:

```tsx
const INVITE_TABS: TabItem[] = [
  { key: 'diseno', label: 'Diseño', icon: LayoutGrid },
  { key: 'enviar', label: 'Enviar', icon: Send },
  { key: 'config', label: 'Configuración', shortLabel: 'Config', icon: Settings },
]
```

- [ ] **Step 4: Reemplazar el switcher negro por TabToggle**

Sustituir el bloque actual (líneas ~269-282, el `<div className="flex w-full overflow-hidden rounded-lg border ...">` con los dos `<button>` Diseño/Enviar) por:

```tsx
<div className="flex w-full justify-center overflow-x-auto sm:w-auto sm:justify-start">
  <TabToggle tabs={INVITE_TABS} active={activeTab} onChange={(k) => setActiveTab(k as TabKey)} />
</div>
```

- [ ] **Step 5: Repartir el cuerpo en tres pestañas**

El cuerpo hoy es un ternario `activeTab === 'diseno' ? (…diseño…) : (…Acceso + Reparto…)` (líneas ~325-384). Dejar el bloque de `diseno` idéntico y reemplazar la rama `else` (líneas ~379-384) por dos ramas:

```tsx
) : activeTab === 'enviar' ? (
  <div className="pt-5">
    <RepartoLinks eventId={eventId} event={event} />
  </div>
) : (
  <div className="pt-5">
    <AccesoPanel eventId={eventId} event={event} />
  </div>
)}
```

(El `<AccesoPanel>` deja de vivir en la pestaña Enviar y ahora es el contenido de Configuración; `<RepartoLinks>` se queda solo en Enviar.)

- [ ] **Step 6: Lint y build**

Run:
```bash
npm run lint && npm run build
```
Expected: sin errores de TypeScript ni ESLint. Si `TabKey` no acepta `'config'` o `INVITE_TABS` marca tipo, revisar Steps 2-3.

- [ ] **Step 7: Verificación manual**

Run: `npm run dev` → abrir `http://localhost:3000` → un evento → Invitación.
Confirmar:
- Toggle con estilo pastilla, tres pestañas, ícono teal en la activa (no barra negra).
- **Diseño**: sub-tabs (Plantillas/Personalizar/Contenido) y preview intactos; FAB "Vista previa" en mobile solo aquí.
- **Enviar**: solo el reparto de links, sin el bloque de acceso.
- **Configuración**: aparece "cómo entra la gente" (privada/pública, cupo, aprobación, precio, acompañantes) y guarda sin error.
- Mobile: el toggle se centra y no desborda.

- [ ] **Step 8: Commit**

```bash
git add app/events/[id]/invitacion/page.tsx
git commit -m "feat(invitacion): TabToggle 3 pestanas, acceso movido a Configuracion"
```

---

### Task 2: Timeline — sección Tareas vs Itinerario (toggle anidado sobre switcher de vistas)

**Files:**
- Modify: `app/events/[id]/timeline/page.tsx`

**Interfaces:**
- Consumes: `TabToggle` / `TabItem` (igual que Task 1). Iconos `LayoutList`, `CalendarDays`, `Clock` (ya importados). Componentes `ListView`, `CalendarView`, `ItineraryView`, `ItineraryToolbar` y el hook `useItinerary(eventId, itinEventInfo, enabled: boolean)`.
- Produces: nada que otra task consuma.

- [ ] **Step 1: Importar TabToggle**

En `app/events/[id]/timeline/page.tsx`, agregar junto a los imports existentes:

```tsx
import { TabToggle, type TabItem } from '@/app/components/ui/TabToggle'
```

- [ ] **Step 2: Separar estado de sección y de vista**

Línea 183, reemplazar el estado de `view` (que hoy incluye `'itinerario'`) por dos estados:

```tsx
const [section, setSection]         = useState<'tareas' | 'itinerario'>('tareas')
const [view, setView]               = useState<'lista' | 'calendario'>('lista')
```

- [ ] **Step 3: Activar el itinerario por sección**

Línea ~202, cambiar la condición del hook de `view` a `section`:

```tsx
const itinerary = useItinerary(eventId, itinEventInfo, section === 'itinerario')
```

- [ ] **Step 4: Definir el array de secciones**

Junto a los `const` de render (antes del `return`), agregar:

```tsx
const TIMELINE_SECTIONS: TabItem[] = [
  { key: 'tareas', label: 'Tareas', icon: LayoutList },
  { key: 'itinerario', label: 'Itinerario', icon: Clock },
]
```

- [ ] **Step 5: Insertar el TabToggle de secciones**

Justo antes del bloque `<div className="mb-3 flex items-center gap-2">` (línea ~505), insertar:

```tsx
<div className="mb-3 flex justify-center overflow-x-auto sm:justify-start">
  <TabToggle tabs={TIMELINE_SECTIONS} active={section} onChange={(k) => setSection(k as 'tareas' | 'itinerario')} />
</div>
```

- [ ] **Step 6: Reestructurar la barra de vistas + toolbars por sección**

Reemplazar TODO el bloque `<div className="mb-3 flex items-center gap-2"> … </div>` (líneas ~505-572, que hoy contiene los 3 botones de vista, los filtros con `view !== 'itinerario'`, y `{view === 'itinerario' && <ItineraryToolbar />}`) por un condicional de sección. La sección Tareas conserva el switcher negro con solo dos botones (Lista/Calendario) y la toolbar de filtros; la sección Itinerario muestra solo su toolbar:

```tsx
{section === 'tareas' ? (
  <div className="mb-3 flex items-center gap-2">
    <div className="flex overflow-hidden rounded-lg border border-[#e0e0e0]">
      <button onClick={() => setView('lista')}
        className={['flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition', view === 'lista' ? 'bg-[#1D1E20] text-white' : 'text-[#888] hover:bg-[#f5f5f5]'].join(' ')}>
        <LayoutList width={13} height={13} /><span className="hidden sm:inline">Lista</span>
      </button>
      <button onClick={() => setView('calendario')}
        className={['flex items-center gap-1.5 border-l border-[#e0e0e0] px-3 py-1.5 text-xs font-medium transition', view === 'calendario' ? 'bg-[#1D1E20] text-white' : 'text-[#888] hover:bg-[#f5f5f5]'].join(' ')}>
        <CalendarDays width={13} height={13} /><span className="hidden sm:inline">Calendario</span>
      </button>
    </div>

    <div className="hidden sm:flex items-center gap-2 flex-1">
      <div className="relative flex-1 max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb]" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar en título o notas..."
          className="w-full border border-[#e0e0e0] rounded-lg pl-8 pr-8 py-1.5 text-xs focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8]" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#bbb] hover:text-[#888]">
            <X size={12} />
          </button>
        )}
      </div>
      <div className="relative">
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="border border-[#e0e0e0] rounded-lg pl-3 pr-8 py-1.5 text-xs appearance-none focus:outline-none focus:border-[#48C9B0] bg-[#f8f8f8] text-[#888]">
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#aaa] pointer-events-none" />
      </div>
      {hasActiveFilters && (
        <button onClick={clearFilters} className="text-xs text-[#aaa] hover:text-[#cc3333] transition-colors whitespace-nowrap">
          Limpiar
        </button>
      )}
    </div>

    <button onClick={() => setShowFilters(true)}
      className={['sm:hidden flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition', hasActiveFilters ? 'border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]' : 'border-[#e0e0e0] text-[#888] hover:bg-[#f5f5f5]'].join(' ')}>
      <SlidersHorizontal width={13} height={13} />Filtrar
      {hasActiveFilters && (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#48C9B0] text-[9px] font-bold text-white">
          {(search ? 1 : 0) + (filterCat ? 1 : 0)}
        </span>
      )}
    </button>

    <div className="ml-auto flex items-center gap-2">
      <button onClick={handleGeneratePlan}
        disabled={!eventInfo?.event_date || generating}
        className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0] disabled:opacity-50">
        <CalendarDays width={13} height={13} />{generating ? 'Generando...' : 'Generar plan'}
      </button>
      <button onClick={() => openNew()}
        className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3ab89f] sm:px-4 sm:text-sm">
        <Plus width={14} height={14} />Agregar
      </button>
    </div>
  </div>
) : (
  <div className="mb-3">
    <ItineraryToolbar itin={itinerary} />
  </div>
)}
```

- [ ] **Step 7: Ajustar el render del cuerpo**

En el bloque del cuerpo (líneas ~575-586), cambiar la condición de itinerario de `view` a `section`:

```tsx
) : section === 'itinerario' ? (
  <ItineraryView itin={itinerary} />
) : view === 'lista' ? <ListView /> : <CalendarView />}
```

- [ ] **Step 8: Lint y build**

Run:
```bash
npm run lint && npm run build
```
Expected: sin errores. Si TypeScript marca que `view` ya no acepta `'itinerario'`, buscar referencias sobrantes: `grep -n "'itinerario'" app/events/[id]/timeline/page.tsx` y confirmar que solo quedan las de `section` (Steps 3, 5, 6, 7) y el texto del subtítulo (línea ~444, que se deja).

- [ ] **Step 9: Verificación manual**

Run: `npm run dev` → evento → Timeline.
Confirmar:
- Arriba, toggle pastilla con dos secciones: **Tareas** / **Itinerario** (ícono teal en la activa).
- **Tareas**: debajo del toggle, el switcher negro **Lista / Calendario**, más filtros/búsqueda, "Generar plan" y "Agregar". Cambiar entre Lista y Calendario funciona; las tarjetas se ven.
- **Itinerario**: su toolbar (`ItineraryToolbar`) y su vista (`ItineraryView`); sin el switcher de vistas de tareas ni los filtros de tareas.
- Mobile: ambos controles caben y no desbordan; el botón "Filtrar" aparece solo en Tareas.

- [ ] **Step 10: Commit**

```bash
git add app/events/[id]/timeline/page.tsx
git commit -m "feat(timeline): separa seccion Tareas de Itinerario con TabToggle"
```

---

## Notas de verificación final

- Ambas tareas son independientes: se pueden revisar y aprobar por separado.
- No hay migración de datos ni cambios de schema; nada que tocar en Supabase.
- El principio (TabToggle = secciones, switcher negro = vistas) queda ejemplificado en ambos archivos para futuras features.
