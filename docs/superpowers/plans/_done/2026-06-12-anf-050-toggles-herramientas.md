# ANF-050 — Herramientas por evento (toggles) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada evento muestra en el nav solo las herramientas que le aplican (mesas, regalos, álbum, playlist, comida), con defaults por tipo de evento, paso 3 en el modal de creación, sección en Configuración y guard suave por URL directa.

**Architecture:** Registro único de features en `lib/features.ts` (fuente de verdad para paso 3, Configuración y nav). La resolución `null → legacy / clave ausente → default del tipo / clave presente → tal cual` vive en `resolveFeatures()`. El estado resuelto se carga UNA vez en `EventAccessProvider` (que ya envuelve todas las páginas del evento) y se expone vía `useEventAccess().features` + `updateFeatures()` — el nav del layout filtra con eso y las páginas se protegen con un wrapper `FeatureGuard`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (columna nueva `event_settings.enabled_features JSONB` — el SQL lo corre Diego DESPUÉS del push), Lucide.

**Spec:** `docs/superpowers/specs/2026-06-11-herramientas-por-evento-toggles-design.md`

**Decisiones cerradas con Diego (12-jun):**
- `enabled_features = null` (eventos existentes) → mesas/regalos/album/playlist **ON**, comida **OFF**. Preserva exactamente el nav actual; Comida solo aparece si se activa explícitamente o por default de tipo en eventos nuevos.
- OnboardingModal NO crea eventos (verificado: no toca `events` ni `event_settings`) — sin cambios ahí.

**Reglas del proyecto que aplican:**
- NO hay test suite — verificación por tarea = `npx tsc --noEmit` (rápido) y al final `npm run lint` + `npm run build` + prueba manual en `npm run dev`. **Probar en local ANTES de cualquier push** (instrucción de Diego).
- NO push sin permiso explícito de Diego. NO tocar Supabase — el SQL lo corre él tras el push.
- UI en español CON acentos; commits en inglés SIN acentos. Sin emojis en UI. CTA teal `#48C9B0`. Solo Tailwind. Lucide.
- El executor trabaja en la rama ya creada `feature/ANF-050-toggles-herramientas`.

---

### Task 1: Registro de features + defaults por tipo + tipo EventSettings

**Files:**
- Create: `lib/features.ts`
- Modify: `lib/event-types.ts` (archivo completo abajo)
- Modify: `lib/types.ts:82-95` (tipo `EventSettings`)

- [ ] **Step 1: Crear `lib/features.ts`**

```ts
import type React from 'react'
import { LayoutGrid, Gift, Images, Music2, UtensilsCrossed } from 'lucide-react'
import { EVENT_TYPES } from './event-types'

export type FeatureKey = 'mesas' | 'regalos' | 'album' | 'playlist' | 'comida'

export type EnabledFeatures = Partial<Record<FeatureKey, boolean>>

export interface FeatureConfig {
  key: FeatureKey
  label: string
  description: string
  icon: React.ElementType
  navPaths: string[]
}

export const FEATURES: FeatureConfig[] = [
  { key: 'mesas',    label: 'Mesas y check-in',      description: 'Asigna lugares y registra llegadas el día del evento',        icon: LayoutGrid,      navPaths: ['/mesas'] },
  { key: 'regalos',  label: 'Mesa de regalos',        description: 'Regalos, fondos y sobres con un link público para invitados', icon: Gift,            navPaths: ['/mesa-regalos'] },
  { key: 'album',    label: 'Álbum de fotos',         description: 'Tus invitados suben fotos escaneando un QR',                  icon: Images,          navPaths: ['/album'] },
  { key: 'playlist', label: 'Playlist',               description: 'Playlist colaborativa con sugerencias de los invitados',      icon: Music2,          navPaths: ['/playlist'] },
  { key: 'comida',   label: 'Planificador de comida', description: 'Planea menú y compras por persona y por día',                 icon: UtensilsCrossed, navPaths: ['/comida'] },
]

export const ALWAYS_ON_FEATURES = ['Invitados', 'Mensajes', 'Timeline', 'Finanzas'] as const

// Eventos existentes (columna null): exactamente el nav actual — comida oculta
export const LEGACY_FEATURES: Record<FeatureKey, boolean> = {
  mesas: true, regalos: true, album: true, playlist: true, comida: false,
}

export function getDefaultFeatures(eventTypeValue: string | null): Record<FeatureKey, boolean> {
  const config =
    EVENT_TYPES.find(t => t.value === eventTypeValue) ??
    EVENT_TYPES.find(t => t.value === 'otro')!
  const defaults = config.defaultFeatures ?? []
  return {
    mesas:    defaults.includes('mesas'),
    regalos:  defaults.includes('regalos'),
    album:    defaults.includes('album'),
    playlist: defaults.includes('playlist'),
    comida:   defaults.includes('comida'),
  }
}

export function resolveFeatures(
  eventTypeValue: string | null,
  enabled: EnabledFeatures | null | undefined,
): Record<FeatureKey, boolean> {
  if (enabled == null) return { ...LEGACY_FEATURES }
  const defaults = getDefaultFeatures(eventTypeValue)
  return {
    mesas:    enabled.mesas    ?? defaults.mesas,
    regalos:  enabled.regalos  ?? defaults.regalos,
    album:    enabled.album    ?? defaults.album,
    playlist: enabled.playlist ?? defaults.playlist,
    comida:   enabled.comida   ?? defaults.comida,
  }
}
```

- [ ] **Step 2: Reemplazar `lib/event-types.ts` completo** (gana `defaultFeatures` por tipo; el import de `FeatureKey` es type-only, así que el ciclo features↔event-types es benigno)

```ts
import type React from 'react'
import {
  Gem, Crown, Cake, GraduationCap, Sun, PartyPopper, Wine,
  Presentation, Monitor, UsersRound, Rocket, Building2,
  Tent, Mic, Flame, HeartHandshake, CalendarDays,
} from 'lucide-react'
import type { FeatureKey } from './features'

export type EventCategory = 'social' | 'corporativo' | 'impacto'

export interface EventTypeConfig {
  value: string
  label: string
  category: EventCategory
  icon: React.ElementType
  hostLabel?: string
  host2Label?: string
  showOrg?: boolean
  showVenue?: boolean
  defaultFeatures?: FeatureKey[]
}

export const EVENT_TYPES: EventTypeConfig[] = [
  { value: 'boda',         label: 'Boda',          category: 'social',      icon: Gem,            hostLabel: 'Novia',                 host2Label: 'Novio',  showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album', 'playlist'] },
  { value: 'xv',           label: 'XV años',        category: 'social',      icon: Crown,          hostLabel: 'Festejada',             showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album', 'playlist'] },
  { value: 'cumpleanos',   label: 'Cumpleaños',     category: 'social',      icon: Cake,           hostLabel: 'Festejado/a',           showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album', 'playlist'] },
  { value: 'graduacion',   label: 'Graduación',     category: 'social',      icon: GraduationCap,  hostLabel: 'Graduado/a',            showVenue: true, defaultFeatures: ['mesas', 'album', 'playlist'] },
  { value: 'bautizo',      label: 'Bautizo',        category: 'social',      icon: Sun,            hostLabel: 'Nombre del bautizado/a', showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album'] },
  { value: 'fiesta',       label: 'Fiesta',         category: 'social',      icon: PartyPopper,    hostLabel: 'Anfitrión/a',           showVenue: true, defaultFeatures: ['album', 'playlist', 'comida'] },
  { value: 'despedida',    label: 'Despedida',      category: 'social',      icon: Wine,           hostLabel: 'Festejado/a',           showVenue: true, defaultFeatures: ['regalos', 'album', 'playlist'] },
  { value: 'conferencia',  label: 'Conferencia',    category: 'corporativo', icon: Presentation,   hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas'] },
  { value: 'capacitacion', label: 'Capacitación',   category: 'corporativo', icon: Monitor,        hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['comida'] },
  { value: 'teambuilding', label: 'Team Building',  category: 'corporativo', icon: UsersRound,     hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['album', 'comida'] },
  { value: 'lanzamiento',  label: 'Lanzamiento',    category: 'corporativo', icon: Rocket,         hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas', 'album'] },
  { value: 'asamblea',     label: 'Asamblea',       category: 'corporativo', icon: Building2,      hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas'] },
  { value: 'retiro',       label: 'Retiro',         category: 'impacto',     icon: Tent,           hostLabel: 'Organizador principal',  defaultFeatures: ['album', 'comida'] },
  { value: 'congreso',     label: 'Congreso',       category: 'impacto',     icon: Mic,            hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas'] },
  { value: 'campamento',   label: 'Campamento',     category: 'impacto',     icon: Flame,          hostLabel: 'Organizador principal',  defaultFeatures: ['album', 'playlist', 'comida'] },
  { value: 'caridad',      label: 'Caridad',        category: 'impacto',     icon: HeartHandshake, hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas', 'album'] },
  { value: 'otro',         label: 'Otro',           category: 'social',      icon: CalendarDays,   hostLabel: 'Anfitrión/a',           showVenue: true, defaultFeatures: ['mesas', 'album', 'playlist'] },
]

export const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: 'social',      label: 'Social' },
  { value: 'corporativo', label: 'Corporativo' },
  { value: 'impacto',     label: 'Impacto' },
]
```

- [ ] **Step 3: Agregar `enabled_features` al tipo `EventSettings` en `lib/types.ts`**

Edit — old:
```ts
export type EventSettings = {
  id: string
  event_id: string
  message_templates: string[] | null
  template_names: string[] | null
  album_url: string | null
  playlist_token: string | null
  playlist_categories: string[] | null
  registry_token: string | null
  registry_payment_info: RegistryPaymentInfo | null
  registry_external_links: RegistryExternalLink[] | null
  created_at: string
  updated_at: string
}
```
new:
```ts
export type EventSettings = {
  id: string
  event_id: string
  message_templates: string[] | null
  template_names: string[] | null
  album_url: string | null
  playlist_token: string | null
  playlist_categories: string[] | null
  registry_token: string | null
  registry_payment_info: RegistryPaymentInfo | null
  registry_external_links: RegistryExternalLink[] | null
  enabled_features: Partial<Record<'mesas' | 'regalos' | 'album' | 'playlist' | 'comida', boolean>> | null
  created_at: string
  updated_at: string
}
```
(Inline literal en vez de importar `EnabledFeatures` para no acoplar `types.ts` a `features.ts`. Campo aditivo y nullable — no rompe a ningún consumidor existente de `EventSettings`.)

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores (warnings de librerías externas se ignoran).

- [ ] **Step 5: Commit**

```bash
git add lib/features.ts lib/event-types.ts lib/types.ts
git commit -m "feat(ANF-050): feature registry with per-event-type defaults and resolveFeatures"
```

---

### Task 2: Context — cargar y actualizar features en EventAccessProvider

**Files:**
- Modify: `lib/event-access-context.tsx` (archivo completo abajo)

- [ ] **Step 1: Reemplazar `lib/event-access-context.tsx` completo**

```tsx
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { resolveFeatures, type FeatureKey } from '@/lib/features'
import { logAction } from '@/lib/audit'

// ============================================
// Roles disponibles — owner es implícito (events.user_id)
// ============================================
export type CollaboratorRole = 'owner' | 'admin' | 'editor' | 'viewer'

// ============================================
// Lo que expone el context a toda la app
// ============================================
interface EventAccessContextType {
  role: CollaboratorRole | null
  isOwner: boolean
  canEdit: boolean      // owner + admin + editor
  canAdmin: boolean     // owner + admin
  canInvite: boolean    // owner + admin
  isLoading: boolean
  hasAccess: boolean
  features: Record<FeatureKey, boolean> | null   // null mientras carga
  updateFeatures: (next: Record<FeatureKey, boolean>) => Promise<boolean>
}

const EventAccessContext = createContext<EventAccessContextType>({
  role: null,
  isOwner: false,
  canEdit: false,
  canAdmin: false,
  canInvite: false,
  isLoading: true,
  hasAccess: false,
  features: null,
  updateFeatures: async () => false,
})

// ============================================
// Provider — va en events/[id]/layout.tsx
// Hace UNA query, todos los hijos la consumen del context
// ============================================
export function EventAccessProvider({
  children,
  eventId,
}: {
  children: ReactNode
  eventId: string
}) {
  const [role, setRole] = useState<CollaboratorRole | null>(null)
  const [features, setFeatures] = useState<Record<FeatureKey, boolean> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkAccess() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Si la columna enabled_features aun no existe en la DB, la query de
        // settings regresa error y data null -> resolveFeatures(type, null) = legacy
        const [{ data: event }, { data: settings }] = await Promise.all([
          supabase.from('events').select('user_id, event_type').eq('id', eventId).single(),
          supabase.from('event_settings').select('enabled_features').eq('event_id', eventId).maybeSingle(),
        ])

        if (event) {
          setFeatures(resolveFeatures(event.event_type, settings?.enabled_features ?? null))
        }

        if (event?.user_id === user.id) {
          setRole('owner')
          return
        }

        const { data: collaborator } = await supabase
          .from('event_collaborators')
          .select('role, status')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single()

        if (collaborator) {
          setRole(collaborator.role as CollaboratorRole)
        }
      } catch {
        console.error('[event-access] Error verificando acceso')
      } finally {
        setIsLoading(false)
      }
    }

    checkAccess()
  }, [eventId])

  // Persiste el JSON completo (las 5 claves explicitas) y actualiza el estado local
  const updateFeatures = async (next: Record<FeatureKey, boolean>) => {
    const old = features
    const { error } = await supabase
      .from('event_settings')
      .upsert(
        { event_id: eventId, enabled_features: next, updated_at: new Date().toISOString() },
        { onConflict: 'event_id' },
      )
    if (error) {
      console.error('[event-access] Error guardando herramientas:', error.message)
      return false
    }
    setFeatures(next)
    logAction({
      eventId,
      action: 'event.settings_updated',
      entityType: 'settings',
      entityLabel: 'Herramientas del evento',
      oldValue: old ?? undefined,
      newValue: next,
    })
    return true
  }

  // Derivar permisos del rol — una sola fuente de verdad
  const isOwner = role === 'owner'
  const canAdmin = role === 'owner' || role === 'admin'
  const canEdit = role === 'owner' || role === 'admin' || role === 'editor'
  const canInvite = role === 'owner' || role === 'admin'
  const hasAccess = role !== null

  return (
    <EventAccessContext.Provider value={{
      role,
      isOwner,
      canEdit,
      canAdmin,
      canInvite,
      isLoading,
      hasAccess,
      features,
      updateFeatures,
    }}>
      {children}
    </EventAccessContext.Provider>
  )
}

// ============================================
// Hook — lo que usan todos los componentes hijos
// ============================================
export function useEventAccess() {
  return useContext(EventAccessContext)
}
```

Notas para el executor:
- `maybeSingle()` en settings: si no hay fila no es error.
- `logAction` ya existe en `lib/audit.ts`, es silent-fail; `'event.settings_updated'` y `'settings'` son valores válidos de `AuditAction`/`AuditEntityType` (verificado en `lib/audit.ts:22,32`).
- El `select('enabled_features')` fallará con error (no excepción) mientras la columna no exista en la DB — el código queda desplegable ANTES del SQL.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/event-access-context.tsx
git commit -m "feat(ANF-050): expose resolved features and updateFeatures via event access context"
```

---

### Task 3: NewEventModal — paso 3 de herramientas

**Files:**
- Modify: `app/components/NewEventModal.tsx`

- [ ] **Step 1: Imports y estado**

Edit — old:
```tsx
import { EVENT_TYPES, CATEGORIES, EventTypeConfig, EventCategory } from '@/lib/event-types'
```
new:
```tsx
import { EVENT_TYPES, CATEGORIES, EventTypeConfig, EventCategory } from '@/lib/event-types'
import { FEATURES, ALWAYS_ON_FEATURES, getDefaultFeatures, type FeatureKey } from '@/lib/features'
```

Edit — old:
```tsx
  const [step, setStep]                   = useState<1 | 2>(1)
```
new:
```tsx
  const [step, setStep]                   = useState<1 | 2 | 3>(1)
```

Edit — old:
```tsx
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
```
new:
```tsx
  const [features, setFeatures]           = useState<Record<FeatureKey, boolean>>(getDefaultFeatures('otro'))

  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
```

- [ ] **Step 2: Handlers — reset, selección de tipo (re-inicializa toggles), back, next**

Edit — old:
```tsx
    setName(''); setHostName(''); setHostName2(''); setOrganization('')
    setDate(''); setTime(''); setVenue('')
    setError('')
```
new:
```tsx
    setName(''); setHostName(''); setHostName2(''); setOrganization('')
    setDate(''); setTime(''); setVenue('')
    setFeatures(getDefaultFeatures('otro'))
    setError('')
```

Edit — old:
```tsx
  const handleSelectType = (type: EventTypeConfig) => {
    setEventType(type)
    setStep(2)
    setError('')
  }

  const handleBack = () => {
    setStep(1)
    setError('')
  }
```
new (al cambiar de tipo, los ajustes manuales del paso 3 se descartan — el tipo manda, según spec §6):
```tsx
  const handleSelectType = (type: EventTypeConfig) => {
    setEventType(type)
    setFeatures(getDefaultFeatures(type.value))
    setStep(2)
    setError('')
  }

  const handleBack = () => {
    setStep(prev => (prev === 3 ? 2 : 1))
    setError('')
  }

  const handleNext = () => {
    if (!name.trim()) { setError('El nombre del evento es obligatorio'); return }
    if (!date)        { setError('La fecha del evento es obligatoria'); return }
    setError('')
    setStep(3)
  }
```

- [ ] **Step 3: Guardar `enabled_features` en el insert de event_settings**

Edit — old:
```tsx
      .insert({
        event_id:          eventData.id,
        playlist_token:    generatePlaylistToken(),
        message_templates: [],
        template_names:    [],
      })
```
new:
```tsx
      .insert({
        event_id:          eventData.id,
        playlist_token:    generatePlaylistToken(),
        message_templates: [],
        template_names:    [],
        enabled_features:  features,
      })
```

Nota: mientras la columna no exista en la DB, este insert fallará — el flujo actual ya tolera ese error (`console.error` y sigue). Aceptable SOLO en local; en prod el SQL se corre inmediatamente después del deploy (Task 8).

- [ ] **Step 4: Agregar `renderStep3` después de `renderStep2` (después de la línea que cierra `renderStep2`, antes de `// ─── Render ───`)**

```tsx
  // ─── Paso 3 — Herramientas ───────────────────────────────────────────────

  const renderStep3 = () => {
    if (!eventType) return null
    const defaults = getDefaultFeatures(eventType.value)

    return (
      <div className="flex flex-col gap-4">

        <div>
          <p className="mb-2 text-xs font-medium text-[#555]">Siempre incluidas</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {ALWAYS_ON_FEATURES.map(label => (
              <span
                key={label}
                className="rounded-full border border-[#e8e8e8] bg-[#f8f8f8] px-2.5 py-1 text-[11px] font-medium text-[#888]"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-[#555]">Activa lo que tu evento necesita</p>
          <div className="flex flex-col gap-2">
            {FEATURES.map(f => {
              const Icon = f.icon
              const on = features[f.key]
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFeatures(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                  className={
                    'flex items-center gap-3 rounded-xl border p-3 text-left transition ' +
                    (on ? 'border-[#c8ede7] bg-[#f0fdfb]' : 'border-[#e8e8e8] bg-white hover:border-[#d0d0d0]')
                  }
                >
                  <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + (on ? 'bg-[#d0f5ec]' : 'bg-[#f4f4f4]')}>
                    <Icon size={18} className={on ? 'text-[#0F6E56]' : 'text-[#888]'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#1D1E20]">{f.label}</p>
                      {defaults[f.key] && (
                        <span className="rounded-full border border-[#f0e2c0] bg-[#fffbf0] px-2 py-0.5 text-[10px] font-semibold text-[#c49a3a]">
                          Recomendado
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#888]">{f.description}</p>
                  </div>
                  <div className={'relative h-6 w-11 shrink-0 rounded-full transition ' + (on ? 'bg-[#48C9B0]' : 'bg-[#e0e0e0]')}>
                    <span className={'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ' + (on ? 'left-[22px]' : 'left-0.5')} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <p className="text-center text-[11px] text-[#aaa]">Puedes cambiar esto después en Configuración</p>

      </div>
    )
  }
```

- [ ] **Step 5: Header — 3 indicadores de paso + subtítulo**

Edit — old (todo el bloque `{/* Steps */}` con sus dos indicadores):
```tsx
                  {/* Steps */}
                  <div className="flex items-center gap-2">
                    <div className={
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition ' +
                      (step === 1 ? 'bg-[#48C9B0] text-white' : 'bg-[#d0f5ec] text-[#0F6E56]')
                    }>
                      {step === 1 ? '1' : '✓'}
                    </div>
                    <span className={'text-xs font-medium ' + (step === 1 ? 'text-[#1D1E20]' : 'text-[#48C9B0]')}>
                      Tipo
                    </span>
                    <div className="h-px w-4 bg-[#e8e8e8]" />
                    <div className={
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition ' +
                      (step === 2 ? 'bg-[#48C9B0] text-white' : 'border border-[#e0e0e0] bg-white text-[#bbb]')
                    }>
                      2
                    </div>
                    <span className={'text-xs font-medium ' + (step === 2 ? 'text-[#1D1E20]' : 'text-[#bbb]')}>
                      Datos
                    </span>
                  </div>
```
new:
```tsx
                  {/* Steps */}
                  <div className="flex items-center gap-2">
                    {([[1, 'Tipo'], [2, 'Datos'], [3, 'Herramientas']] as [number, string][]).map(([n, label], i) => (
                      <div key={n} className="flex items-center gap-2">
                        {i > 0 && <div className="h-px w-4 bg-[#e8e8e8]" />}
                        <div className={
                          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition ' +
                          (step === n
                            ? 'bg-[#48C9B0] text-white'
                            : step > n
                              ? 'bg-[#d0f5ec] text-[#0F6E56]'
                              : 'border border-[#e0e0e0] bg-white text-[#bbb]')
                        }>
                          {step > n ? '✓' : n}
                        </div>
                        <span className={
                          'text-xs font-medium ' +
                          (step === n ? 'text-[#1D1E20]' : step > n ? 'hidden text-[#48C9B0] sm:inline' : 'hidden text-[#bbb] sm:inline')
                        }>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
```

Edit — old:
```tsx
              <p className="mt-0.5 text-xs text-[#888]">
                {step === 1
                  ? 'Elige el tipo para personalizar los campos'
                  : 'Completa los datos del evento'}
              </p>
```
new:
```tsx
              <p className="mt-0.5 text-xs text-[#888]">
                {step === 1
                  ? 'Elige el tipo para personalizar los campos'
                  : step === 2
                    ? 'Completa los datos del evento'
                    : 'Activa las herramientas de tu evento'}
              </p>
```

- [ ] **Step 6: Contenido y footer**

Edit — old:
```tsx
                  {step === 1 ? renderStep1() : renderStep2()}
```
new:
```tsx
                  {step === 1 ? renderStep1() : step === 2 ? renderStep2() : renderStep3()}
```

Edit — old (footer completo):
```tsx
            {/* Footer fijo — solo en paso 2 */}
            {step === 2 && (
              <div className="shrink-0 border-t border-[#e8e8e8] px-5 py-4">
                <div className="flex gap-3">
                  <button
                    onClick={handleBack}
                    disabled={loading}
                    className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-4 py-2.5 text-sm text-[#888] transition hover:bg-[#f5f5f5] disabled:opacity-40"
                  >
                    <ArrowLeft size={14} /> Atras
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="flex-1 rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-60"
                  >
                    {loading ? 'Creando evento...' : 'Crear evento'}
                  </button>
                </div>
              </div>
            )}
```
new:
```tsx
            {/* Footer fijo — pasos 2 y 3 */}
            {step > 1 && (
              <div className="shrink-0 border-t border-[#e8e8e8] px-5 py-4">
                <div className="flex gap-3">
                  <button
                    onClick={handleBack}
                    disabled={loading}
                    className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-4 py-2.5 text-sm text-[#888] transition hover:bg-[#f5f5f5] disabled:opacity-40"
                  >
                    <ArrowLeft size={14} /> Atras
                  </button>
                  {step === 2 ? (
                    <button
                      onClick={handleNext}
                      className="flex-1 rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
                    >
                      Siguiente
                    </button>
                  ) : (
                    <button
                      onClick={handleCreate}
                      disabled={loading}
                      className="flex-1 rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-60"
                    >
                      {loading ? 'Creando evento...' : 'Crear evento'}
                    </button>
                  )}
                </div>
              </div>
            )}
```

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add app/components/NewEventModal.tsx
git commit -m "feat(ANF-050): step 3 feature toggles in new event modal"
```

---

### Task 4: Nav filtrado por features + reintegración de Comida

**Files:**
- Modify: `app/events/[id]/layout.tsx`

- [ ] **Step 1: Imports**

Edit — old:
```tsx
import { Users, Images, Music2, Settings, LayoutGrid, PanelLeftClose, PanelLeftOpen, CalendarDays, House, User, LogOut, Wallet, Briefcase, Heart, MessageCircle, Receipt, Gift } from 'lucide-react'
```
new:
```tsx
import { Users, Images, Music2, Settings, LayoutGrid, PanelLeftClose, PanelLeftOpen, CalendarDays, House, User, LogOut, Wallet, Briefcase, Heart, MessageCircle, Receipt, Gift, UtensilsCrossed } from 'lucide-react'
import type { FeatureKey } from '@/lib/features'
import { LEGACY_FEATURES } from '@/lib/features'
```

- [ ] **Step 2: Entrada Comida en NAV_ITEMS (después de Timeline, antes de Mesa de regalos)**

Edit — old:
```tsx
  {
    type: 'item',
    label: 'Mesa de regalos', labelMobile: 'Regalos', path: '/mesa-regalos', adminOnly: false,
```
new:
```tsx
  {
    type: 'item',
    label: 'Comida', labelMobile: 'Comida', path: '/comida', adminOnly: false,
    iconOutline: <UtensilsCrossed width={18} height={18} strokeWidth={1.5} />,
    iconFilled:  <UtensilsCrossed width={18} height={18} strokeWidth={2.5} />,
  },
  {
    type: 'item',
    label: 'Mesa de regalos', labelMobile: 'Regalos', path: '/mesa-regalos', adminOnly: false,
```

- [ ] **Step 3: Función de filtrado (a nivel de módulo, después de la definición de `NAV_ITEMS`)**

```tsx
const FEATURE_BY_PATH: Record<string, FeatureKey> = {
  '/mesas':        'mesas',
  '/mesa-regalos': 'regalos',
  '/album':        'album',
  '/playlist':     'playlist',
  '/comida':       'comida',
}

function filterNavByFeatures(entries: NavEntry[], features: Record<FeatureKey, boolean> | null): NavEntry[] {
  const effective = features ?? LEGACY_FEATURES
  const result: NavEntry[] = []
  for (const entry of entries) {
    if (entry.type === 'item') {
      const fk = FEATURE_BY_PATH[entry.path]
      if (fk && !effective[fk]) continue
      result.push(entry)
    } else {
      const children = entry.children.filter(child => {
        const fk = FEATURE_BY_PATH[child.path]
        return !fk || effective[fk]
      })
      if (children.length === 0) continue
      result.push({
        ...entry,
        children,
        defaultPath: children.some(c => c.path === entry.defaultPath) ? entry.defaultPath : children[0].path,
      })
    }
  }
  return result
}
```

- [ ] **Step 4: Usar features del context en `EventLayoutInner`**

Edit — old:
```tsx
  const { canAdmin } = useEventAccess()
```
new:
```tsx
  const { canAdmin, features } = useEventAccess()
```

Edit — old:
```tsx
  const visibleEntries = NAV_ITEMS.filter(entry =>
    entry.type === 'item' ? (!entry.adminOnly || canAdmin) : true
  )
```
new:
```tsx
  const visibleEntries = filterNavByFeatures(
    NAV_ITEMS.filter(entry =>
      entry.type === 'item' ? (!entry.adminOnly || canAdmin) : true
    ),
    features,
  )
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

Comportamiento esperado (se prueba manual en Task 9): grupo Recuerdos desaparece si album y playlist están OFF; si solo album está OFF, `defaultPath` del grupo pasa a `/playlist`; Comida aparece solo con `comida: true`; mientras `features` es null (carga) el nav se ve como hoy (legacy).

- [ ] **Step 6: Commit**

```bash
git add "app/events/[id]/layout.tsx"
git commit -m "feat(ANF-050): filter event nav by enabled features and reintegrate Comida"
```

---

### Task 5: Configuración — sección "Herramientas del evento"

**Files:**
- Modify: `app/events/[id]/configuracion/page.tsx`

- [ ] **Step 1: Imports y context**

Edit — old:
```tsx
import { TabToggle, type TabItem } from '@/app/components/ui/TabToggle'
```
new:
```tsx
import { TabToggle, type TabItem } from '@/app/components/ui/TabToggle'
import { useEventAccess } from '@/lib/event-access-context'
import { FEATURES, ALWAYS_ON_FEATURES, getDefaultFeatures, type FeatureKey } from '@/lib/features'
```

Edit — old:
```tsx
export default function ConfiguracionPage() {
  const { id } = useParams()
```
new:
```tsx
export default function ConfiguracionPage() {
  const { id } = useParams()
  const { features, updateFeatures, canAdmin } = useEventAccess()
  const [featureSaving, setFeatureSaving] = useState<FeatureKey | null>(null)
```

- [ ] **Step 2: Handler de toggle (junto a `handleStatusChange`)**

Edit — old:
```tsx
  const handleStatusChange = async (newStatus: EventStatus) => {
```
new:
```tsx
  const handleToggleFeature = async (key: FeatureKey) => {
    if (!features || !canAdmin || featureSaving) return
    setFeatureSaving(key)
    await updateFeatures({ ...features, [key]: !features[key] })
    setFeatureSaving(null)
  }

  const handleStatusChange = async (newStatus: EventStatus) => {
```

- [ ] **Step 3: Sección al final del tab Evento**

Anchor exacto — old (cierre de "Datos generales" + cierre del tab `evento`, en `app/events/[id]/configuracion/page.tsx:802-809`):
```tsx
                  </div>

                </div>
              </div>


            </div>
          )}

          {/* ── TAB: WHATSAPP ── */}
```
new:
```tsx
                  </div>

                </div>
              </div>

              {/* Herramientas del evento */}
              <div>
                <h2 className="mb-1 text-sm font-semibold text-[#1D1E20]">Herramientas del evento</h2>
                <p className="mb-4 text-xs text-[#888]">
                  Activa solo lo que tu evento necesita. Apagar una herramienta no borra sus datos — solo la oculta del menú.
                </p>

                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  {ALWAYS_ON_FEATURES.map(label => (
                    <span key={label} className="rounded-full border border-[#e8e8e8] bg-[#f8f8f8] px-2.5 py-1 text-[11px] font-medium text-[#888]">
                      {label}
                    </span>
                  ))}
                  <span className="text-[11px] text-[#bbb]">siempre incluidas</span>
                </div>

                {features ? (
                  <div className="flex flex-col gap-2 sm:max-w-xl">
                    {FEATURES.map(f => {
                      const Icon = f.icon
                      const on = features[f.key]
                      const recommended = getDefaultFeatures(eventType)[f.key]
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => handleToggleFeature(f.key)}
                          disabled={!canAdmin || featureSaving !== null}
                          className={
                            'flex items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed ' +
                            (on ? 'border-[#c8ede7] bg-[#f0fdfb]' : 'border-[#e8e8e8] bg-white hover:border-[#d0d0d0]')
                          }
                        >
                          <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + (on ? 'bg-[#d0f5ec]' : 'bg-[#f4f4f4]')}>
                            <Icon size={18} className={on ? 'text-[#0F6E56]' : 'text-[#888]'} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-[#1D1E20]">{f.label}</p>
                              {recommended && (
                                <span className="rounded-full border border-[#f0e2c0] bg-[#fffbf0] px-2 py-0.5 text-[10px] font-semibold text-[#c49a3a]">
                                  Recomendado
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-[#888]">{f.description}</p>
                          </div>
                          {featureSaving === f.key ? (
                            <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
                          ) : (
                            <div className={'relative h-6 w-11 shrink-0 rounded-full transition ' + (on ? 'bg-[#48C9B0]' : 'bg-[#e0e0e0]')}>
                              <span className={'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ' + (on ? 'left-[22px]' : 'left-0.5')} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-[#aaa]">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
                    Cargando herramientas...
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── TAB: WHATSAPP ── */}
```

Notas: `eventType` es el estado local (string) que ya existe en la página. El guardado es inmediato vía `updateFeatures` (no pasa por el botón "Guardar" de la página) — igual que el cambio de estatus del evento. Como `updateFeatures` actualiza el context, el nav del layout se refresca al instante sin recargar.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add "app/events/[id]/configuracion/page.tsx"
git commit -m "feat(ANF-050): event tools section with instant toggles in configuracion"
```

---

### Task 6: FeatureGuard + guards suaves en las 5 páginas

**Files:**
- Create: `app/components/ui/FeatureGuard.tsx`
- Modify: `app/events/[id]/mesas/page.tsx:1224`
- Modify: `app/events/[id]/mesa-regalos/page.tsx:66`
- Modify: `app/events/[id]/album/page.tsx:8`
- Modify: `app/events/[id]/playlist/page.tsx:265`
- Modify: `app/events/[id]/comida/page.tsx:106`

- [ ] **Step 1: Crear `app/components/ui/FeatureGuard.tsx`**

```tsx
'use client'

import { useState, type ReactNode } from 'react'
import { useEventAccess } from '@/lib/event-access-context'
import { FEATURES, type FeatureKey } from '@/lib/features'

export default function FeatureGuard({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { features, canAdmin, updateFeatures } = useEventAccess()
  const [activating, setActivating] = useState(false)

  if (!features) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  if (features[feature]) return <>{children}</>

  const config = FEATURES.find(f => f.key === feature)!
  const Icon = config.icon

  const handleActivate = async () => {
    setActivating(true)
    await updateFeatures({ ...features, [feature]: true })
    setActivating(false)
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-white px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f4f4f4]">
        <Icon size={22} className="text-[#aaa]" />
      </div>
      <p className="text-sm font-semibold text-[#1D1E20]">Esta herramienta está desactivada para este evento</p>
      <p className="max-w-sm text-xs leading-relaxed text-[#888]">
        {config.label} no está activa.{' '}
        {canAdmin
          ? 'Puedes activarla aquí o desde Configuración — no se pierde ningún dato.'
          : 'Pide al organizador del evento que la active desde Configuración.'}
      </p>
      {canAdmin && (
        <button
          onClick={handleActivate}
          disabled={activating}
          className="mt-1 rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-60"
        >
          {activating ? 'Activando...' : 'Activar herramienta'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Envolver cada página (patrón idéntico en las 5)**

En cada archivo: (a) agregar el import, (b) renombrar el default export actual a `*Inner` quitándole `export default`, (c) agregar el nuevo default export al FINAL del archivo. Mientras la feature está OFF, el componente interno no se monta — no corre data loading.

`app/events/[id]/mesas/page.tsx` — agregar import junto a los demás imports:
```tsx
import FeatureGuard from '@/app/components/ui/FeatureGuard'
```
Edit — old: `export default function MesasPage() {` → new: `function MesasPageInner() {`
Al final del archivo:
```tsx
export default function MesasPage() {
  return (
    <FeatureGuard feature="mesas">
      <MesasPageInner />
    </FeatureGuard>
  )
}
```

`app/events/[id]/mesa-regalos/page.tsx`:
import igual; old: `export default function MesaRegalosPage() {` → new: `function MesaRegalosPageInner() {`
Al final:
```tsx
export default function MesaRegalosPage() {
  return (
    <FeatureGuard feature="regalos">
      <MesaRegalosPageInner />
    </FeatureGuard>
  )
}
```

`app/events/[id]/album/page.tsx`:
import igual; old: `export default function AlbumPage() {` → new: `function AlbumPageInner() {`
Al final:
```tsx
export default function AlbumPage() {
  return (
    <FeatureGuard feature="album">
      <AlbumPageInner />
    </FeatureGuard>
  )
}
```

`app/events/[id]/playlist/page.tsx`:
import igual; old: `export default function PlaylistPlannerPage() {` → new: `function PlaylistPlannerPageInner() {`
Al final:
```tsx
export default function PlaylistPlannerPage() {
  return (
    <FeatureGuard feature="playlist">
      <PlaylistPlannerPageInner />
    </FeatureGuard>
  )
}
```

`app/events/[id]/comida/page.tsx`:
import igual; old: `export default function ComidaPage() {` → new: `function ComidaPageInner() {`
Al final:
```tsx
export default function ComidaPage() {
  return (
    <FeatureGuard feature="comida">
      <ComidaPageInner />
    </FeatureGuard>
  )
}
```

IMPORTANTE: esto NO toca la página pública `/playlist/[token]` ni `/mesa/[token]` — los invitados siguen entrando aunque la herramienta esté apagada en el nav del planner. (Apagar nunca borra datos ni rompe links ya compartidos; si Diego quisiera bloquear también lo público, sería otra iteración.)

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/components/ui/FeatureGuard.tsx "app/events/[id]/mesas/page.tsx" "app/events/[id]/mesa-regalos/page.tsx" "app/events/[id]/album/page.tsx" "app/events/[id]/playlist/page.tsx" "app/events/[id]/comida/page.tsx"
git commit -m "feat(ANF-050): soft guard with inline activation on toggleable feature pages"
```

---

### Task 7: WhatsNew release

**Files:**
- Modify: `lib/changelog.ts`
- Modify: `app/components/WhatsNewModal.tsx:12-14` (ICON_MAP)

- [ ] **Step 1: `lib/changelog.ts` — bump de versión + release nuevo al inicio del array**

Edit — old:
```ts
export const CURRENT_VERSION = '2026-06-11'
```
new:
```ts
export const CURRENT_VERSION = '2026-06-12'
```

Edit — old:
```ts
export const changelog: Release[] = [
  {
    version: '2026-06-11',
```
new:
```ts
export const changelog: Release[] = [
  {
    version: '2026-06-12',
    date: '12 de junio, 2026',
    title: 'Herramientas a tu medida',
    subtitle: 'Cada evento con solo las herramientas que necesita.',
    features: [
      { icon: 'SlidersHorizontal', text: 'Nuevo paso al crear tu evento: activa o desactiva mesas, regalos, álbum, playlist y comida' },
      { icon: 'Sparkles',          text: 'Defaults inteligentes según el tipo — una boda no necesita lo mismo que una conferencia' },
      { icon: 'Settings2',         text: 'Cámbialo cuando quieras desde Configuración, sin perder ningún dato' },
      { icon: 'UtensilsCrossed',   text: 'El planificador de comida regresa al menú cuando lo activas' },
    ],
  },
  {
    version: '2026-06-11',
```

- [ ] **Step 2: ICON_MAP en `app/components/WhatsNewModal.tsx`**

Edit — old:
```tsx
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutList, User, Building2, AlertTriangle, Bell, Clock, Gift, Link2, Coins, Landmark, Heart,
}
```
new:
```tsx
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutList, User, Building2, AlertTriangle, Bell, Clock, Gift, Link2, Coins, Landmark, Heart,
  SlidersHorizontal, Sparkles, Settings2, UtensilsCrossed,
}
```
Y agregar `SlidersHorizontal, Sparkles, Settings2, UtensilsCrossed` al import de `lucide-react` existente en ese archivo.

Nota: el WhatsNewModal de ANF-049 muestra un mockup propio (`MesaRegalosMockup`) seleccionado por versión. Verificar cómo selecciona el visual por versión: si la versión `2026-06-12` no tiene mockup propio debe caer al layout genérico (sin mockup o con `gif`). Si el selector hace fallback solo, no hay nada que hacer; si el mockup de mesa de regalos se renderiza hardcodeado para toda versión, condicionar a `version === '2026-06-11'`. NO crear mockup nuevo en esta iteración.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add lib/changelog.ts app/components/WhatsNewModal.tsx
git commit -m "feat(ANF-050): whats-new release for per-event feature toggles"
```

---

### Task 8: SQL versionado (lo corre Diego DESPUÉS del push a main)

**Files:**
- Create: `docs/superpowers/plans/anf-050-toggles.sql`

- [ ] **Step 1: Crear el archivo SQL**

```sql
-- ANF-050: herramientas por evento (toggles)
-- ORDEN: correr DESPUES de que el codigo este en origin/main y deployado (regla de sincronia Supabase-Vercel).
-- La columna es nullable y aditiva: inerte para el codigo viejo, y el codigo nuevo tolera su ausencia.

-- ── PASO 0 (read-only, correr primero y revisar): grants actuales de event_settings ──
-- Si 'authenticated' tiene SELECT/INSERT/UPDATE a nivel de TABLA, no se necesita ningun grant extra.
-- Si los grants son por COLUMNA (como se hizo con 'anon' en ANF-049), agregar enabled_features
-- al grant de authenticated (NUNCA al de anon — la pagina publica no necesita esta columna).
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'event_settings'
order by grantee, privilege_type;

select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'event_settings'
order by grantee, column_name, privilege_type;

-- ── PASO 1: columna nueva ──
alter table public.event_settings
  add column if not exists enabled_features jsonb;

-- ── PASO 2 (SOLO si el paso 0 mostro grants por columna para authenticated): ──
-- grant select (enabled_features), insert (enabled_features), update (enabled_features)
--   on public.event_settings to authenticated;

-- ── Verificacion ──
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'event_settings' and column_name = 'enabled_features';
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/anf-050-toggles.sql
git commit -m "docs(ANF-050): sql for enabled_features column with grants inspection"
```

---

### Task 9: Verificación final EN LOCAL (antes de cualquier push)

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Lint y build**

Run: `npm run lint`
Expected: sin errores (warnings preexistentes OK).

Run: `npm run build`
Expected: build exitoso, todas las rutas compilan.

- [ ] **Step 2: Levantar dev y correr el checklist manual con Diego**

Run: `npm run dev` → http://localhost:3000

> Contexto: en local la columna `enabled_features` probablemente NO existe aún (Diego no ha corrido el SQL). Eso permite probar el modo legacy. Para probar el flujo completo de toggles en local, Diego puede correr el `ALTER TABLE` del Task 8 en Supabase ANTES del push — es seguro porque la columna es nullable e inerte para el código en prod (solo `select *` la ignora y nadie la escribe). Confirmar con él.

Checklist manual (lo valida Diego):
1. **Evento existente (columna null o inexistente):** nav idéntico al actual — Mesas, Mesa de regalos, Recuerdos (Album+Playlist) visibles, Comida NO aparece.
2. **Crear evento nuevo (boda):** paso 3 aparece con mesas/regalos/album/playlist ON + badge "Recomendado", comida OFF. Crear y verificar nav.
3. **Crear evento nuevo (conferencia):** paso 3 pre-enciende solo mesas. Apagar mesas y prender comida → nav del evento muestra Comida y NO muestra Mesas, grupo Recuerdos desaparece.
4. **Regresar de paso 3 a paso 1 y cambiar de tipo:** los toggles se re-inicializan al default del nuevo tipo.
5. **Configuración → Herramientas del evento:** toggles reflejan el estado; prender/apagar actualiza el nav al instante sin recargar; chips "siempre incluidas" visibles.
6. **URL directa a feature apagada** (ej. `/events/<id>/playlist` con playlist OFF): empty state "Esta herramienta está desactivada..."; como owner aparece botón "Activar herramienta" y al darle clic la página carga y el nav se actualiza.
7. **Página pública** `/mesa/[token]` y `/playlist/[token]` siguen funcionando con la feature apagada.
8. **Mobile:** bottom nav refleja el filtrado; paso 3 del modal usable con scroll; labels de steps no se rompen.
9. **WhatsNewModal:** aparece una vez con el release 2026-06-12 (borrar `anfiora_seen_version` de localStorage para forzarlo).

- [ ] **Step 3: STOP — pedir OK de Diego**

NO hacer `git push` sin permiso explícito. Tras su OK: push de la rama → preview de Vercel → Diego prueba preview → merge a main con su OK → Diego corre el SQL en prod (si no lo corrió antes en local/prod) → listo.

---

## Self-review (hecho al escribir el plan)

- Spec §2 alcance: 5 toggles + siempre-activas como chips → Tasks 1, 3, 5. ✓
- Spec §3 defaults por tipo: tabla completa transcrita a `defaultFeatures` → Task 1. ✓
- Spec §4 modelo de datos + 3 reglas: `resolveFeatures` (con ajuste acordado: null → comida OFF) → Task 1; columna SQL → Task 8. ✓
- Spec §5 registro: `lib/features.ts` + `defaultFeatures` en `EventTypeConfig` → Task 1. ✓
- Spec §6 UI: modal 3 pasos → Task 3; nav filtrado + Comida → Task 4; Configuración → Task 5; guard suave → Task 6. ✓
- Spec §7 exclusiones: OnboardingModal verificado (no crea eventos, sin cambios); sin toggles para Mensajes/Finanzas; sin features futuras. ✓
- Spec §8 fase 6: SQL → Task 8; WhatsNew → Task 7. ✓
- Consistencia de nombres: `FeatureKey`, `FEATURES`, `ALWAYS_ON_FEATURES`, `LEGACY_FEATURES`, `getDefaultFeatures`, `resolveFeatures`, `updateFeatures`, `FeatureGuard` usados igual en todas las tasks. ✓
- Sin placeholders: todo step de código trae el código. ✓
